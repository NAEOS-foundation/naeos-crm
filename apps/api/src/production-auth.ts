import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import type { AuthenticatedActor } from '@naeos-crm/auth'

const prisma = new PrismaClient()
const SESSION_COOKIE = 'naeos_session'
const SESSION_TTL_SECONDS = 60 * 60 * 8
const SCRYPT_N = 2 ** 17
const SCRYPT_R = 8
const SCRYPT_P = 1

const secret = () => {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters')
  return value
}

export function hashPassword(password: string): string {
  if (password.length < 15 || password.length > 128) throw new Error('Password must be 15-128 characters')
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 64, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 256 * 1024 * 1024 })
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export function verifyPassword(password: string, encoded: string): boolean {
  const match = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(encoded)
  if (!match) return false
  const [, n, r, p, saltText, hashText] = match
  try {
    const expected = Buffer.from(hashText, 'base64url')
    const actual = scryptSync(password, Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024,
    })
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

export function issueSession(actor: AuthenticatedActor): string {
  return jwt.sign(
    { sub: actor.id, email: actor.email, roles: actor.roles },
    secret(),
    { algorithm: 'HS256', expiresIn: SESSION_TTL_SECONDS, issuer: 'naeos-crm', audience: 'naeos-crm-web' },
  )
}

export function setSessionCookie(res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`,
  )
}

export function clearSessionCookie(res: Response) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`,
  )
}

export function getSessionToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  const cookieHeader = req.headers.cookie ?? ''
  const cookie = cookieHeader.split(';').map((v) => v.trim()).find((v) => v.startsWith(`${SESSION_COOKIE}=`))
  return cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : undefined
}

export async function authenticateCredentials(email: string, password: string): Promise<AuthenticatedActor | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (!user || user.status !== 'ACTIVE' || !user.passwordHash || !verifyPassword(password, user.passwordHash)) return null
  return { id: user.id, email: user.email, roles: user.roles.map((role) => role.toLowerCase() as AuthenticatedActor['roles'][number]) }
}

export async function bootstrapAuthUser(): Promise<void> {
  const email = process.env.AUTH_BOOTSTRAP_EMAIL?.trim().toLowerCase()
  const password = process.env.AUTH_BOOTSTRAP_PASSWORD
  if (!email && !password) return
  if (!email || !password) throw new Error('AUTH_BOOTSTRAP_EMAIL and AUTH_BOOTSTRAP_PASSWORD must be provided together')
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing?.passwordHash) return
  const hash = hashPassword(password)
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: hash, status: 'ACTIVE' } })
    return
  }
  await prisma.user.create({ data: { email, name: 'System Admin', roles: ['ADMIN'], status: 'ACTIVE', passwordHash: hash } })
}

export async function closeAuthDb() {
  await prisma.$disconnect()
}
