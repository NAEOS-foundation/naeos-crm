import { createPublicKey } from 'node:crypto'
import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'

interface ControlPlaneSigningConfig {
  issuer: string
  audience: string
  keyId: string
  privateKey: string
  algorithm: 'RS256' | 'ES256'
  jwks: Record<string, unknown>
}

let cachedConfig: ControlPlaneSigningConfig | null = null
let cachedFingerprint = ''

function signingConfig(): ControlPlaneSigningConfig {
  const issuer = process.env.CONTROLPLANE_BFF_ISSUER?.trim() ?? ''
  const audience = process.env.CONTROLPLANE_BFF_AUDIENCE?.trim() ?? ''
  const keyId = process.env.CONTROLPLANE_BFF_KEY_ID?.trim() ?? ''
  const privateKey = (process.env.CONTROLPLANE_BFF_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')

  if (!issuer || !audience || !keyId || !privateKey) {
    throw new Error('Control Plane BFF signing is not configured')
  }

  let issuerUrl: URL
  try {
    issuerUrl = new URL(issuer)
  } catch {
    throw new Error('Control Plane BFF issuer is invalid')
  }
  if (issuerUrl.protocol !== 'https:' || issuerUrl.username || issuerUrl.password || issuerUrl.search || issuerUrl.hash || !['', '/'].includes(issuerUrl.pathname)) {
    throw new Error('Control Plane BFF issuer must be an HTTPS origin')
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId) || audience.length > 128) {
    throw new Error('Control Plane BFF signing identifiers are invalid')
  }

  const fingerprint = [issuer, audience, keyId, privateKey].join('\u0000')
  if (cachedConfig && cachedFingerprint === fingerprint) return cachedConfig

  let publicKey: ReturnType<typeof createPublicKey>
  try {
    publicKey = createPublicKey(privateKey)
  } catch {
    throw new Error('Control Plane BFF private key is invalid')
  }

  const details = publicKey.asymmetricKeyDetails
  let algorithm: 'RS256' | 'ES256'
  if (publicKey.asymmetricKeyType === 'rsa' || publicKey.asymmetricKeyType === 'rsa-pss') {
    if (!details?.modulusLength || details.modulusLength < 2048 || publicKey.asymmetricKeyType !== 'rsa') {
      throw new Error('Control Plane BFF RSA key must be at least 2048 bits and use RSASSA-PKCS1-v1_5')
    }
    algorithm = 'RS256'
  } else if (publicKey.asymmetricKeyType === 'ec' && details?.namedCurve === 'prime256v1') {
    algorithm = 'ES256'
  } else {
    throw new Error('Control Plane BFF key must be RSA-2048+ or P-256 EC')
  }

  const exported = publicKey.export({ format: 'jwk' })
  const jwks: Record<string, unknown> = {
    ...exported,
    kid: keyId,
    use: 'sig',
    alg: algorithm,
  }
  cachedConfig = { issuer, audience, keyId, privateKey, algorithm, jwks }
  cachedFingerprint = fingerprint
  return cachedConfig
}

/** Public signing keys only. The private key is never returned by this handler. */
export const controlPlaneJWKSHandler: RequestHandler = (_req, res) => {
  try {
    const config = signingConfig()
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.setHeader('Content-Type', 'application/json')
    res.json({ keys: [config.jwks] })
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ error: { code: 'CONTROL_PLANE_IDENTITY_UNAVAILABLE' } })
  }
}

/** Creates a 60-second, read-only assertion for the authenticated CRM actor. */
export function createControlPlaneAssertion(actorId: string): string {
  if (!actorId || actorId.trim() !== actorId || actorId.length > 256) {
    throw new Error('Authenticated CRM actor identity is invalid')
  }
  const config = signingConfig()
  return jwt.sign(
    { scope: 'control-plane:read' },
    config.privateKey,
    {
      algorithm: config.algorithm,
      keyid: config.keyId,
      issuer: config.issuer,
      audience: config.audience,
      subject: actorId,
      expiresIn: 60,
    },
  )
}
