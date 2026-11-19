import { createPublicKey } from 'node:crypto'
import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'

interface SigningKey {
  keyId: string
  privateKey: string
  algorithm: 'RS256' | 'ES256'
  jwk: Record<string, unknown>
}
interface ControlPlaneSigningConfig {
  issuer: string
  audience: string
  activeKeyId: string
  activeKey: SigningKey
  keys: SigningKey[]
}

let cachedConfig: ControlPlaneSigningConfig | null = null
let cachedFingerprint = ''

function parseKeySet(activeKeyId: string, singlePrivateKey: string): Array<{ keyId: string; privateKey: string }> {
  const json = process.env.CONTROLPLANE_BFF_KEYS_JSON?.trim()
  if (json) {
    let parsed: unknown
    try { parsed = JSON.parse(json) } catch { throw new Error('Control Plane BFF key set JSON is invalid') }
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 5) {
      throw new Error('Control Plane BFF key set must contain between 1 and 5 keys')
    }
    const keys = parsed.map((entry) => {
      if (!entry || typeof entry !== 'object') throw new Error('Control Plane BFF key entry is invalid')
      const candidate = entry as Record<string, unknown>
      const keyId = candidate.key_id
      const privateKey = candidate.private_key
      if (typeof keyId !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(keyId) || typeof privateKey !== 'string' || !privateKey.trim()) {
        throw new Error('Control Plane BFF key entry is invalid')
      }
      return { keyId, privateKey: privateKey.replace(/\\n/g, '\n') }
    })
    if (new Set(keys.map((key) => key.keyId).size !== keys.length) {
      throw new Error('Control Plane BFF key IDs must be unique')
    }
    if (!keys.some((key) => key.keyId === activeKeyId)) throw new Error('Active Control Plane BFF key is missing from key set')
    return keys
  }
  const normalized = singlePrivateKey.replace(/\\n/g, '\n')
  if (!normalized) throw new Error('Control Plane BFF signing is not configured')
  return [{ keyId: activeKeyId, privateKey: normalized }]
}

function signingConfig(): ControlPlaneSigningConfig {
  const issuer = process.env.CONTROLPLANE_BFF_ISSUER?.trim() ?? ''
  const audience = process.env.CONTROLPLANE_BFF_AUDIENCE?.trim() ?? ''
  const activeKeyId = process.env.CONTROLPLANE_BFF_KEY_ID?.trim() ?? ''
  const singlePrivateKey = process.env.CONTROLPLANE_BFF_PRIVATE_KEY ?? ''

  if (!issuer || !audience || !activeKeyId || (!singlePrivateKey && !process.env.CONTROLPLANE_BFF_KEYS_JSON)) {
    throw new Error('Control Plane BFF signing is not configured')
  }
  let issuerUrl: URL
  try { issuerUrl = new URL(issuer) } catch { throw new Error('Control Plane BFF issuer is invalid') }
  if (issuerUrl.protocol !== 'https:' || issuerUrl.username || issuerUrl.password || issuerUrl.search || issuerUrl.hash || !['', '/'].includes(issuerUrl.pathname)) {
    throw new Error('Control Plane BFF issuer must be an HTTPS origin')
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(activeKeyId) || audience.length > 128) {
    throw new Error('Control Plane BFF signing identifiers are invalid')
  }

  const rawKeys = parseKeySet(activeKeyId, singlePrivateKey)
  const fingerprint = [issuer, audience, activeKeyId, rawKeys.map((key) => key.keyId + '\\u0000' + key.privateKey).join('\\u0001')].join('\\u0000')
  if (cachedConfig && cachedFingerprint === fingerprint) return cachedConfig

  const keys = rawKeys.map(({ keyId, privateKey }) => {
    let publicKey: ReturnType<typeof createPublicKey>
    try { publicKey = createPublicKey(privateKey) } catch { throw new Error('Control Plane BFF private key is invalid') }
    const details = publicKey.asymmetricKeyDetails
    let algorithm: 'RS256' | 'ES256'
    if (publicKey.asymmetricKeyType === 'rsa') {
      if (!details?.modulusLength || details.modulusLength < 2048) throw new Error('Control Plane BFF RSA key must be at least 2048 bits')
      algorithm = 'RS256'
    } else if (publicKey.asymmetricKeyType === 'ec' && details?.namedCurve === 'prime256v1') {
      algorithm = 'ES256'
    } else {
      throw new Error('Control Plane BFF key must be RSA-2048+ or P-256 EC')
    }
    const jwk: Record<string, unknown> = { ...publicKey.export({ format: 'jwk' }), kid: keyId, use: 'sig', alg: algorithm }
    return { keyId, privateKey, algorithm, jwk }
  })
  const activeKey = keys.find((key) => key.keyId === activeKeyId)
  if (!activeKey) throw new Error('Active Control Plane BFF key is missing')
  cachedConfig = { issuer, audience, activeKeyId, activeKey, keys }
  cachedFingerprint = fingerprint
  return cachedConfig
}

/** Publishes public signing keys only, allowing safe overlap during rotation. */
export const controlPlaneJWKSHandler: RequestHandler = (_req, res) => {
  try {
    const config = signingConfig()
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.setHeader('Content-Type', 'application/json')
    res.json({ keys: config.keys.map((key) => key.jwk) })
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ error: { code: 'CONTROL_PLANE_IDENTITY_UNAVAILABLE' } })
  }
}

/** Creates a 60-second read-only assertion using the configured active key. */
export function createControlPlaneAssertion(actorId: string): string {
  if (!actorId || actorId.trim() !== actorId || actorId.length > 256) throw new Error('Authenticated CRM actor identity is invalid')
  const config = signingConfig()
  return jwt.sign(
    { scope: 'control-plane:read' },
    config.activeKey.privateKey,
    {
      algorithm: config.activeKey.algorithm,
      keyid: config.activeKey.keyId,
      issuer: config.issuer,
      audience: config.audience,
      subject: actorId,
      expiresIn: 60,
    },
  )
}
