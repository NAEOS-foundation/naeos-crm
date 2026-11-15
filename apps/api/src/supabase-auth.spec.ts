import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./prisma-ports', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { prisma } from './prisma-ports'
import { authenticateSupabaseAccessToken, hashPassword, linkSupabaseIdentity } from './production-auth'

const authUserId = 'b4d5f2a8-6c31-4f27-9d11-4a3a6f0e8b22'
const crmUser = {
  id: 'crm-user-cuid',
  supabaseAuthUserId: authUserId,
  email: 'linked@example.com',
  name: 'Linked User',
  roles: ['MEMBER'],
  status: 'ACTIVE',
  passwordHash: null,
  sessionVersion: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

const mockedFindUnique = vi.mocked(prisma.user.findUnique)
const mockedUpdateMany = vi.mocked(prisma.user.updateMany)

function mockSupabaseResponse(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ))
}

describe('authenticateSupabaseAccessToken', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://identity.example.supabase.co')
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key')
    mockedFindUnique.mockReset()
    mockedUpdateMany.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns the CRM actor for a verified, explicitly linked Supabase user', async () => {
    mockSupabaseResponse(200, { id: authUserId, email: 'linked@example.com' })
    mockedFindUnique.mockResolvedValue(crmUser as never)

    await expect(authenticateSupabaseAccessToken('verified-access-token')).resolves.toEqual({
      id: 'crm-user-cuid',
      email: 'linked@example.com',
      roles: ['member'],
    })
    expect(mockedFindUnique).toHaveBeenCalledWith({ where: { supabaseAuthUserId: authUserId } })
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://identity.example.supabase.co/auth/v1/user'),
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        headers: expect.objectContaining({
          apikey: 'test-publishable-key',
          Authorization: 'Bearer verified-access-token',
        }),
      }),
    )
  })

  it('links a CRM account only when both Supabase token and local credentials are verified', async () => {
    const password = 'correct horse battery staple'
    const userWithPassword = { ...crmUser, passwordHash: hashPassword(password) }
    mockSupabaseResponse(200, { id: authUserId, email: 'linked@example.com' })
    mockedFindUnique
      .mockResolvedValueOnce(userWithPassword as never)
      .mockResolvedValueOnce({ supabaseAuthUserId: null } as never)
    mockedUpdateMany.mockResolvedValue({ count: 1 } as never)

    await expect(linkSupabaseIdentity('verified-access-token', 'linked@example.com', password)).resolves.toEqual({
      id: 'crm-user-cuid',
      email: 'linked@example.com',
      roles: ['member'],
    })
    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 'crm-user-cuid', supabaseAuthUserId: null },
      data: { supabaseAuthUserId: authUserId },
    })
  })

  it('does not link accounts when verified provider and CRM emails differ', async () => {
    const password = 'correct horse battery staple'
    const userWithPassword = { ...crmUser, passwordHash: hashPassword(password) }
    mockSupabaseResponse(200, { id: authUserId, email: 'different@example.com' })
    mockedFindUnique.mockResolvedValueOnce(userWithPassword as never)

    await expect(linkSupabaseIdentity('verified-access-token', 'linked@example.com', password)).resolves.toBeNull()
    expect(mockedUpdateMany).not.toHaveBeenCalled()
  })

  it('does not overwrite an existing different Supabase identity link', async () => {
    const password = 'correct horse battery staple'
    const userWithPassword = { ...crmUser, passwordHash: hashPassword(password) }
    mockSupabaseResponse(200, { id: authUserId, email: 'linked@example.com' })
    mockedFindUnique
      .mockResolvedValueOnce(userWithPassword as never)
      .mockResolvedValueOnce({ supabaseAuthUserId: '7d4a9f26-2c18-4d3b-a312-0b2f9e6c8a41' } as never)

    await expect(linkSupabaseIdentity('verified-access-token', 'linked@example.com', password)).resolves.toBeNull()
    expect(mockedUpdateMany).not.toHaveBeenCalled()
  })

  it('rejects tokens not accepted by the Supabase Auth user endpoint', async () => {
    mockSupabaseResponse(401, { message: 'invalid token' })

    await expect(authenticateSupabaseAccessToken('invalid-token')).resolves.toBeNull()
    expect(mockedFindUnique).not.toHaveBeenCalled()
  })

  it('rejects valid Supabase users that are not explicitly linked to a CRM account', async () => {
    mockSupabaseResponse(200, { id: authUserId, email: 'linked@example.com' })
    mockedFindUnique.mockResolvedValue(null)

    await expect(authenticateSupabaseAccessToken('valid-but-unlinked-token')).resolves.toBeNull()
  })

  it('rejects inactive CRM accounts and email mismatches', async () => {
    mockSupabaseResponse(200, { id: authUserId, email: 'linked@example.com' })
    mockedFindUnique.mockResolvedValue({ ...crmUser, status: 'INACTIVE' } as never)
    await expect(authenticateSupabaseAccessToken('verified-access-token')).resolves.toBeNull()

    mockedFindUnique.mockResolvedValue({ ...crmUser, email: 'different@example.com' } as never)
    await expect(authenticateSupabaseAccessToken('verified-access-token')).resolves.toBeNull()
  })

  it('fails closed when the Supabase Auth configuration is absent', async () => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', '')

    await expect(authenticateSupabaseAccessToken('verified-access-token')).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(mockedFindUnique).not.toHaveBeenCalled()
  })

  it('returns a service-unavailable error when the Supabase Auth verifier is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))

    await expect(authenticateSupabaseAccessToken('verified-access-token')).rejects.toMatchObject({
      status: 503,
      code: 'SUPABASE_AUTH_UNAVAILABLE',
    })
    expect(mockedFindUnique).not.toHaveBeenCalled()
  })

  it('rejects non-HTTPS Supabase Auth endpoints', async () => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('SUPABASE_URL', 'http://identity.example.supabase.co')

    await expect(authenticateSupabaseAccessToken('verified-access-token')).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(mockedFindUnique).not.toHaveBeenCalled()
  })

  it('rejects malformed provider user identifiers', async () => {
    mockSupabaseResponse(200, { id: 'not-a-uuid', email: 'linked@example.com' })

    await expect(authenticateSupabaseAccessToken('verified-access-token')).resolves.toBeNull()
    expect(mockedFindUnique).not.toHaveBeenCalled()
  })
})
