import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, Actor } from './api'

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

  useEffect(() => {
    api<{ data: Actor }>('/api/v1/me')
      .then((result) => setActor(result.data))
      .catch(() => setActor(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ data: Actor }>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setActor(result.data)
  }, [])

  const logout = useCallback(async () => {
    await api('/api/v1/auth/logout', { method: 'POST' })
    setActor(null)
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
