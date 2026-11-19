import { generateKeyPairSync } from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DefaultAuthorizationService } from '@naeos-crm/auth'
import { controlPlaneJWKSHandler, createControlPlaneAssertion } from './control-plane-identity'

const envKeys = [
  'CONTROLPLANE_BFF_ISSUER',
  'CONTROLPLANE_BFF_AUDIENCE',
  'CONTROLPLANE_BFF_KEY_ID',
  'CONTROLPLANE_BFF_PRIVATE_KEY',
  'CONTROLPLANE_BFF_KEYS_JSON',
] as const

const previous = new Map<string, string | undefined>()
let publicKey = ''

beforeEach(() => {
  for (const key of envKeys) previous.set(key, process.env[key])
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 })
  publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  process.env.CONTROLPLANE_BFF_ISSUER = 'https://crm-api.example.test'
  process.env.CONTROLPLANE_BFF_AUDIENCE = 'naeos-control-plane'
  process.env.CONTROLPLANE_BFF_KEY_ID = 'crm-bff-test-1'
  process.env.CONTROLPLANE_BFF_PRIVATE_KEY = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
})

afterEach(() => {
  for (const key of envKeys) {
    const value = previous.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  previous.clear()
})

describe('Control Plane BFF identity', () => {
  it('issues a short-lived RS256 assertion with only the read scope and CRM actor subject', () => {
    const token = createControlPlaneAssertion('crm-user-123')
    const claims = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'https://crm-api.example.test',
      audience: 'naeos-control-plane',
    }) as jwt.JwtPayload

    expect(claims.sub).toBe('crm-user-123')
    expect(claims.scope).toBe('control-plane:read')
    expect(claims.exp! - claims.iat!).toBeLessThanOrEqual(60)
    expect(jwt.decode(token, { complete: true })?.header.kid).toBe('crm-bff-test-1')
  })

  it('supports P-256 ES256 service assertions', () => {
    const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    process.env.CONTROLPLANE_BFF_PRIVATE_KEY = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const token = createControlPlaneAssertion('crm-user-es256')
    const claims = jwt.verify(token, pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), {
      algorithms: ['ES256'],
      issuer: 'https://crm-api.example.test',
      audience: 'naeos-control-plane',
    }) as jwt.JwtPayload
    expect(claims.sub).toBe('crm-user-es256')
    expect(jwt.decode(token, { complete: true })?.header.alg).toBe('ES256')
  })

  it('publishes only the derived public key as a JWKS signing key', async () => {
    const app = express()
    app.get('/.well-known/jwks.json', controlPlaneJWKSHandler)

    const response = await request(app).get('/.well-known/jwks.json').expect(200)
    expect(response.body.keys).toHaveLength(1)
    expect(response.body.keys[0]).toMatchObject({ kid: 'crm-bff-test-1', use: 'sig', alg: 'RS256', kty: 'RSA' })
    expect(response.body.keys[0]).not.toHaveProperty('d')
    expect(response.body.keys[0]).not.toHaveProperty('p')
    expect(response.headers['cache-control']).toContain('max-age=300')
  })

  it('fails closed when signing configuration is absent', async () => {
    delete process.env.CONTROLPLANE_BFF_PRIVATE_KEY
    const app = express()
    app.get('/.well-known/jwks.json', controlPlaneJWKSHandler)

    const response = await request(app).get('/.well-known/jwks.json').expect(503)
    expect(response.body.error.code).toBe('CONTROL_PLANE_IDENTITY_UNAVAILABLE')
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('grants the dedicated permission only to administrators by default', () => {
    const authorization = new DefaultAuthorizationService()
    expect(authorization.authorize({ id: 'admin', email: 'admin@example.test', roles: ['admin'] }, 'control-plane', 'read').allow).toBe(true)
    expect(authorization.authorize({ id: 'manager', email: 'manager@example.test', roles: ['manager'] }, 'control-plane', 'read').allow).toBe(false)
    expect(authorization.authorize({ id: 'member', email: 'member@example.test', roles: ['member'] }, 'control-plane', 'read').allow).toBe(false)
  })

  it('rejects malformed actor identities', () => {
    expect(() => createControlPlaneAssertion('')).toThrow()
    expect(() => createControlPlaneAssertion(' actor-id ')).toThrow()
  })

  it('publishes overlapping old and new public keys and signs with the active key', async () => {
    const oldPair = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const newPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const oldPrivate = oldPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const newPrivate = newPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.CONTROLPLANE_BFF_KEY_ID = 'crm-bff-active-2'
    process.env.CONTROLPLANE_BFF_KEYS_JSON = JSON.stringify([
      { key_id: 'crm-bff-old-1', private_key: oldPrivate },
      { key_id: 'crm-bff-active-2', private_key: newPrivate },
    ])
    delete process.env.CONTROLPLANE_BFF_PRIVATE_KEY

    const app = express()
    app.get('/.well-known/jwks.json', controlPlaneJWKSHandler)
    const response = await request(app).get('/.well-known/jwks.json').expect(200)
    expect(response.body.keys.map((key: { kid: string }) => key.kid).sort()).toEqual(['crm-bff-active-2', 'crm-bff-old-1'])

    const token = createControlPlaneAssertion('rotation-test-actor')
    expect(jwt.decode(token, { complete: true })?.header.kid).toBe('crm-bff-active-2')
    const claims = jwt.verify(token, newPair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), {
      algorithms: ['ES256'],
      issuer: 'https://crm-api.example.test',
      audience: 'naeos-control-plane',
    }) as jwt.JwtPayload
    expect(claims.scope).toBe('control-plane:read')
  })

  it('rejects duplicate key IDs and missing active key in overlap configuration', () => {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.CONTROLPLANE_BFF_KEYS_JSON = JSON.stringify([
      { key_id: 'duplicate', private_key: privateKey },
      { key_id: 'duplicate', private_key: privateKey },
    ])
    expect(() => createControlPlaneAssertion('actor')).toThrow(/unique/)
    process.env.CONTROLPLANE_BFF_KEYS_JSON = JSON.stringify([{ key_id: 'not-active', private_key: privateKey }])
    expect(() => createControlPlaneAssertion('actor')).toThrow(/Active/)
  })

  it('rejects RSA signing keys smaller than 2048 bits', () => {
    const weakPair = generateKeyPairSync('rsa', { modulusLength: 1024 })
    process.env.CONTROLPLANE_BFF_PRIVATE_KEY = weakPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    expect(() => createControlPlaneAssertion('crm-user-123')).toThrow(/2048 bits/)
  })
})
