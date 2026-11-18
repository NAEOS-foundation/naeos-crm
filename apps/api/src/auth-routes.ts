import { Router } from 'express'
import { z } from 'zod'
import { AuditService } from '@naeos-crm/audit'
import { PrismaAuditReadPort, PrismaAuditSink } from './prisma-ports'
import { asyncHandler } from './middleware'
import { authenticateCredentials, authenticateSupabaseAccessToken, clearSessionCookie, issueSession, linkSupabaseIdentity, revokeSession, setSessionCookie } from './production-auth'

const router = Router()
const audit = new AuditService(new PrismaAuditSink(), new PrismaAuditReadPort())
const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(15).max(128),
})

const linkSchema = loginSchema

const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

function allowed(key: string): boolean {
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  current.count += 1
  return current.count <= MAX_ATTEMPTS
}

router.post('/api/v1/auth/login', asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body)
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  if (!allowed(`ip:${ip}`) || !allowed(`user:${input.email.toLowerCase()}`)) {
    res.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts' } })
    return
  }

  const actor = await authenticateCredentials(input.email, input.password)
  if (!actor) {
    await audit.record({
      actorType: 'anonymous',
      action: 'auth.login.failure',
      entityType: 'authentication',
      entityId: 'unknown',
      requestId: req.requestId,
      source: 'api',
      result: 'FAILURE',
      reason: 'invalid-credentials',
    })
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials', requestId: req.requestId } })
    return
  }

  const token = await issueSession(actor)
  setSessionCookie(res, token)
  await audit.record({
    actorId: actor.id,
    actorType: 'user',
    action: 'auth.login.success',
    entityType: 'user',
    entityId: actor.id,
    requestId: req.requestId,
    source: 'api',
    result: 'SUCCESS',
  })
  res.json({ data: actor, meta: { requestId: req.requestId } })
}))

router.post('/api/v1/auth/link-supabase', asyncHandler(async (req, res) => {
  const input = linkSchema.parse(req.body)
  const authorization = req.headers.authorization
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  const emailKey = input.email.toLowerCase().trim()

  if (!accessToken || !allowed(`supabase-link-ip:${ip}`) || !allowed(`supabase-link-user:${emailKey}`)) {
    res.status(accessToken ? 429 : 401).json({
      error: {
        code: accessToken ? 'AUTH_RATE_LIMITED' : 'UNAUTHORIZED',
        message: accessToken ? 'Too many authentication attempts' : 'Supabase bearer token required',
      },
    })
    return
  }

  const actor = await linkSupabaseIdentity(accessToken, input.email, input.password)
  if (!actor) {
    await audit.record({
      actorType: 'anonymous',
      action: 'auth.supabase.identity-link.failure',
      entityType: 'authentication',
      entityId: 'unlinked',
      requestId: req.requestId,
      source: 'api',
      result: 'FAILURE',
      reason: 'invalid-credentials-or-account-link-conflict',
    })
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials', requestId: req.requestId } })
    return
  }

  const token = await issueSession(actor)
  setSessionCookie(res, token)
  await audit.record({
    actorId: actor.id,
    actorType: 'user',
    action: 'auth.supabase.identity-link.success',
    entityType: 'user',
    entityId: actor.id,
    requestId: req.requestId,
    source: 'api',
    result: 'SUCCESS',
  })
  res.json({ data: actor, meta: { requestId: req.requestId } })
}))

router.post('/api/v1/auth/supabase', asyncHandler(async (req, res) => {
  const authorization = req.headers.authorization
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  if (!accessToken || !allowed(`supabase-ip:${ip}`)) {
    res.status(accessToken ? 429 : 401).json({
      error: {
        code: accessToken ? 'AUTH_RATE_LIMITED' : 'UNAUTHORIZED',
        message: accessToken ? 'Too many authentication attempts' : 'Supabase bearer token required',
      },
    })
    return
  }

  const actor = await authenticateSupabaseAccessToken(accessToken)
  if (!actor) {
    await audit.record({
      actorType: 'supabase-auth-user',
      action: 'auth.supabase.login.failure',
      entityType: 'authentication',
      entityId: 'unlinked',
      requestId: req.requestId,
      source: 'api',
      result: 'FAILURE',
      reason: 'invalid-token-or-unlinked-account',
    })
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials', requestId: req.requestId } })
    return
  }

  const token = await issueSession(actor)
  setSessionCookie(res, token)
  await audit.record({
    actorId: actor.id,
    actorType: 'user',
    action: 'auth.supabase.login.success',
    entityType: 'user',
    entityId: actor.id,
    requestId: req.requestId,
    source: 'api',
    result: 'SUCCESS',
  })
  res.json({ data: actor, meta: { requestId: req.requestId } })
}))

router.post('/api/v1/auth/logout', asyncHandler(async (req, res) => {
  await revokeSession(req)
  clearSessionCookie(res)
  res.status(204).send()
}))

export { router as authRouter }
