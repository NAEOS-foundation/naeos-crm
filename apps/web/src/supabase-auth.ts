export interface SupabasePasswordSession {
  accessToken: string
  expiresAt: number
}

interface SupabaseTokenResponse {
  access_token?: unknown
  expires_in?: unknown
  token_type?: unknown
}

export function hasSupabaseAuthConfiguration(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL?.trim() ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
  )
}

function configuration() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const apiKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim()

  if (!url || !apiKey) {
    throw new Error('Supabase Auth configuration is incomplete. Set VITE_SUPABASE_URL and a publishable/anon key.')
  }

  let base: URL
  try {
    base = new URL(url)
  } catch {
    throw new Error('Supabase Auth URL is invalid.')
  }
  if (base.protocol !== 'https:') {
    throw new Error('Supabase Auth must use HTTPS.')
  }

  return { base, apiKey }
}

export async function signInWithSupabase(email: string, password: string): Promise<SupabasePasswordSession> {
  const { base, apiKey } = configuration()
  const endpoint = new URL('/auth/v1/token?grant_type=password', base)

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
      redirect: 'error',
    })
  } catch {
    throw new Error('Supabase Auth is currently unreachable. Please try again.')
  }

  const payload = await response.json().catch(() => null) as SupabaseTokenResponse | null
  if (!response.ok) {
    throw new Error(
      response.status === 400 || response.status === 401
        ? 'Email or password is incorrect, or the Supabase account is not ready.'
        : 'Supabase Auth could not complete the sign-in request.',
    )
  }

  if (
    !payload ||
    typeof payload.access_token !== 'string' ||
    payload.access_token.length === 0 ||
    typeof payload.expires_in !== 'number' ||
    !Number.isFinite(payload.expires_in)
  ) {
    throw new Error('Supabase Auth returned an invalid session response.')
  }

  return {
    accessToken: payload.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + payload.expires_in,
  }
}

export async function signOutFromSupabase(accessToken: string): Promise<void> {
  const { base, apiKey } = configuration()
  const endpoint = new URL('/auth/v1/logout', base)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
    redirect: 'error',
  })
  if (!response.ok) throw new Error('Supabase sign-out failed.')
}
