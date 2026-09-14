import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthenticatedActor } from '@naeos-crm/auth'
import { generateRequestId, buildErrorResponse } from '@naeos-crm/shared'

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.AUTH_DEV_SECRET || 'dev-secret'
const authDisabled = () => process.env.AUTH_DISABLED === 'true'

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

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.requestId = (req.headers['x-request-id'] as string) || generateRequestId()
  next()
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (authDisabled()) {
    const devUserHeader = req.headers['x-naeos-dev-user']
    if (devUserHeader && typeof devUserHeader === 'string') {
      try {
        req.actor = JSON.parse(devUserHeader) as AuthenticatedActor
      } catch {
        req.actor = {
          id: 'dev-user',
          email: 'dev@naeos.local',
          roles: ['admin'],
        }
      }
    } else {
      req.actor = {
        id: 'dev-user',
        email: 'dev@naeos.local',
        roles: ['admin'],
      }
    }
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json(buildErrorResponse('UNAUTHORIZED', 'Missing or invalid authorization header', req.requestId))
    return
  }

  const token = authHeader.slice(7)

  try {
    const decoded = jwt.verify(token, AUTH_SECRET) as { sub: string; email: string; roles?: string[] }
    req.actor = {
      id: decoded.sub,
      email: decoded.email,
      roles: (decoded.roles as any[]) || ['member'],
    }
    next()
  } catch {
    res.status(401).json(buildErrorResponse('UNAUTHORIZED', 'Invalid or expired token', req.requestId))
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error('[API Error]', req.requestId, err.message)

  if (err.name === 'ZodError') {
    res.status(400).json(
      buildErrorResponse('VALIDATION_ERROR', err.message, req.requestId),
    )
    return
  }

  res.status(500).json(
    buildErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', req.requestId),
  )
}
