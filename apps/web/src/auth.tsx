import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError, Actor } from './api'
import { hasSupabaseAuthConfiguration, signInWithSupabase, signOutFromSupabase } from './supabase-auth'

interface AuthContextValue {
  actor: Actor | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [actor, setActor] = useState<Actor | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseAccessToken = useRef<string | null>(null)

  useEffect(() => {
    api<{ data: Actor }>('/api/v1/me')
      .then((result) => setActor(result.data))
      .catch(() => setActor(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!hasSupabaseAuthConfiguration()) {
      const result = await api<{ data: Actor }>('/api/v1/auth/login', {
        method: 'POST',
        body: { email: normalizedEmail, password },
      })
      setActor(result.data)
      return
    }

    const session = await signInWithSupabase(normalizedEmail, password)
    supabaseAccessToken.current = session.accessToken

    try {
      const headers = { Authorization: `Bearer ${session.accessToken}` }
      try {
        const result = await api<{ data: Actor }>('/api/v1/auth/supabase', { method: 'POST', headers })
        setActor(result.data)
        return
      } catch (error) {
        // A verified Supabase identity may not yet be linked to its legacy CRM account.
        // The linking endpoint independently verifies both the provider token and
        // the existing CRM password; email equality alone never links accounts.
        if (!(error instanceof ApiError) || error.status !== 401) throw error
      }

      try {
        const linked = await api<{ data: Actor }>('/api/v1/auth/link-supabase', {
          method: 'POST',
          headers,
          body: { email: normalizedEmail, password },
        })
        setActor(linked.data)
      } catch {
        throw new Error(
          'Supabase sign-in succeeded, but this identity is not linked to an active CRM account. ' +
          'Account linking requires the existing CRM password and a completed database migration. ' +
          'Contact the NAEOS administrator if you do not have that credential.',
        )
      }
    } catch (error) {
      supabaseAccessToken.current = null
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    const accessToken = supabaseAccessToken.current
    try {
      await api('/api/v1/auth/logout', { method: 'POST' })
    } finally {
      setActor(null)
      supabaseAccessToken.current = null
      if (accessToken) await signOutFromSupabase(accessToken).catch(() => undefined)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ actor, isAuthenticated: actor !== null, login, logout }),
    [actor, login, logout],
  )

  if (loading) return null

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
