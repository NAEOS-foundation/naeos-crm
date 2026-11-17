import { afterEach, describe, expect, it, vi } from 'vitest'
import { signInWithSupabase, signOutFromSupabase } from './supabase-auth'

describe('Supabase browser authentication', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('requests a password-grant session from the configured HTTPS project', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://identity.example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-test-key')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'supabase-access-token',
      expires_in: 3600,
      token_type: 'bearer',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const session = await signInWithSupabase('founder@example.com', 'correct-password')

    expect(session.accessToken).toBe('supabase-access-token')
    expect(session.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://identity.example.supabase.co/auth/v1/token?grant_type=password'),
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        headers: expect.objectContaining({
          apikey: 'public-test-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ email: 'founder@example.com', password: 'correct-password' }),
      }),
    )
  })

  it('fails closed when public Supabase configuration is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(signInWithSupabase('founder@example.com', 'password')).rejects.toThrow(
      'Supabase Auth configuration is incomplete',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects non-HTTPS Supabase endpoints', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://identity.example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-test-key')

    await expect(signInWithSupabase('founder@example.com', 'password')).rejects.toThrow('must use HTTPS')
  })

  it('does not expose provider response details for invalid credentials', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://identity.example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error_description: 'sensitive provider detail' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )))

    await expect(signInWithSupabase('founder@example.com', 'wrong-password')).rejects.toThrow(
      'Email or password is incorrect',
    )
  })

  it('requests provider sign-out using the in-memory bearer token', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://identity.example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-test-key')
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await signOutFromSupabase('supabase-access-token')

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://identity.example.supabase.co/auth/v1/logout'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'public-test-key',
          Authorization: 'Bearer supabase-access-token',
        }),
      }),
    )
  })
})
