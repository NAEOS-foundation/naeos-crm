import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api, initSession, setAuthToken, setDevActor, Actor } from './api'

interface AuthContextValue {
  actor: Actor | null
  isAuthenticated: boolean
  login: (token: string, actor: Actor) => Promise<void>
  loginDev: (role: 'admin' | 'manager' | 'member') => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [actor, setActor] = useState<Actor | null>(() => initSession())

  const login = useCallback(async (token: string, nextActor: Actor) => {
    setAuthToken(token)
    setDevActor(null)
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
    try {
      await api('/api/v1/me')
      setActor(nextActor)
    } catch (err) {
      localStorage.removeItem('naeos-actor')
      setDevActor(null)
      throw err
    }
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