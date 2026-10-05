import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthenticatedActor } from '@naeos-crm/auth'
import { generateRequestId, buildErrorResponse } from '@naeos-crm/shared'
import { HttpError } from './errors'

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.AUTH_DEV_SECRET
const isProduction = () => (process.env.NODE_ENV ?? 'development') === 'production'
const authDisabled = () => process.env.AUTH_DISABLED === 'true' && !isProduction()

function parseCookies(header?: string): Record<string, string> {
  return Object.fromEntries(
    (header ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=')
        return index > 0 ? [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))] : null
      })
      .filter((entry): entry is [string, string] => entry !== null),
  )
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string
      actor?: AuthenticatedActor
    }
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id']
  const requestId = typeof incoming === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming)
    ? incoming
    : generateRequestId()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
}

export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (isProduction()) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
}

const rateWindowMs = 60_000
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 120)
const rateBuckets = new Map<string, { startedAt: number; count: number }>()

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const now = Date.now()
  const key = req.ip || req.socket.remoteAddress || 'unknown'
  const bucket = rateBuckets.get(key)
  if (!bucket || now - bucket.startedAt >= rateWindowMs) {
    rateBuckets.set(key, { startedAt: now, count: 1 })
    res.setHeader('X-RateLimit-Limit', rateLimitMax)
    return next()
  }
  bucket.count += 1
  res.setHeader('X-RateLimit-Limit', rateLimitMax)
  res.setHeader('X-RateLimit-Remaining', Math.max(0, rateLimitMax - bucket.count))
  if (bucket.count > rateLimitMax) {
    res.setHeader('Retry-After', '60')
    res.status(429).json(buildErrorResponse('RATE_LIMITED', 'Too many requests', req.requestId))
    return
  }
  next()
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (authDisabled()) {
    const devUserHeader = req.headers['x-naeos-dev-user']
    if (devUserHeader && typeof devUserHeader === 'string') {
      try {
        req.actor = JSON.parse(devUserHeader) as AuthenticatedActor
      } catch {
        req.actor = { id: 'dev-user', email: 'dev@naeos.local', roles: ['admin'] }
      }
    } else {
      req.actor = { id: 'dev-user', email: 'dev@naeos.local', roles: ['admin'] }
    }
    return next()
  }

  if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
    res.status(500).json(buildErrorResponse('AUTH_CONFIGURATION_ERROR', 'Authentication is not configured securely', req.requestId))
    return
  }

  const authHeader = req.headers.authorization
  const cookies = parseCookies(req.headers.cookie)
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : cookies['naeos_session']

  if (!token) {
    res.status(401).json(buildErrorResponse('UNAUTHORIZED', 'Authentication required', req.requestId))
    return
  }

  try {
    const decoded = jwt.verify(token, AUTH_SECRET, {
      algorithms: ['HS256'],
      issuer: 'naeos-crm',
      audience: 'naeos-crm-web',
    }) as { sub: string; email: string; roles?: string[] }

    if (!decoded.sub || !decoded.email || !Array.isArray(decoded.roles)) {
      throw new Error('Invalid session claims')
    }

    req.actor = {
      id: decoded.sub,
      email: decoded.email,
      roles: decoded.roles as AuthenticatedActor['roles'],
    }
    next()
  } catch {
    res.status(401).json(buildErrorResponse('UNAUTHORIZED', 'Invalid or expired session', req.requestId))
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error('[API Error]', req.requestId, err.message)

  if (err instanceof HttpError) {
    res.status(err.status).json(buildErrorResponse(err.code, err.message, req.requestId))
    return
  }

  if (err.name === 'ZodError') {
    res.status(400).json(buildErrorResponse('VALIDATION_ERROR', err.message, req.requestId))
    return
  }

  const bodyParserError = err as Error & { type?: string; status?: number }
  if (bodyParserError.type === 'entity.too.large') {
    res.status(413).json(buildErrorResponse('PAYLOAD_TOO_LARGE', 'Request body is too large', req.requestId))
    return
  }
  if (err instanceof SyntaxError && bodyParserError.status === 400) {
    res.status(400).json(buildErrorResponse('BAD_REQUEST', 'Malformed JSON body', req.requestId))
    return
  }

  res.status(500).json(buildErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', req.requestId))
}
