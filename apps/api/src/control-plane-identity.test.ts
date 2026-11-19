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

  it('rejects RSA signing keys smaller than 2048 bits', () => {
    const weakPair = generateKeyPairSync('rsa', { modulusLength: 1024 })
    process.env.CONTROLPLANE_BFF_PRIVATE_KEY = weakPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    expect(() => createControlPlaneAssertion('crm-user-123')).toThrow(/2048 bits/)
  })
})
