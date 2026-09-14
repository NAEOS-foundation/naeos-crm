import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api, setAuthToken, setDevActor, Actor } from './api'

interface AuthContextValue {
  actor: Actor | null
  isAuthenticated: boolean
  login: (token: string, actor: Actor) => Promise<void>
  loginDev: (role: 'admin' | 'manager' | 'member') => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [actor, setActor] = useState<Actor | null>(() => {
    const stored = localStorage.getItem('naeos-actor')
    return stored ? (JSON.parse(stored) as Actor) : null
  })

  const login = useCallback(async (token: string, nextActor: Actor) => {
    setAuthToken(token)
    localStorage.setItem('naeos-token', token)
    localStorage.setItem('naeos-actor', JSON.stringify(nextActor))
    setActor(nextActor)
  }, [])

  const loginDev = useCallback(async (role: 'admin' | 'manager' | 'member') => {
    const nextActor: Actor = {
      id: `dev-${role}`,
      email: `dev-${role}@naeos.local`,
      roles: [role],
    }
    setAuthToken(null)
    setDevActor(nextActor)
    localStorage.setItem('naeos-actor', JSON.stringify(nextActor))
    setActor(nextActor)
    await api('/health').catch(() => undefined)
  }, [])

  const logout = useCallback(() => {
    setAuthToken(null)
    setDevActor(null)
    localStorage.removeItem('naeos-token')
    localStorage.removeItem('naeos-actor')
    setActor(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      actor,
      isAuthenticated: actor !== null,
      login,
      loginDev,
      logout,
    }),
    [actor, login, loginDev, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}