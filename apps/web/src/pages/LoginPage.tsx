import React, { useState } from 'react'
import { useAuth } from '../auth'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) return null

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src="/naeos-brand-mark.svg" alt="NAEOS" className="login-brand-mark" />
        <h1>NAEOS CRM</h1>
        <p className="login-subtitle">Sign in with your NAEOS identity</p>
        <form onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          setSubmitting(true)
          login(email, password)
            .catch((err: Error) => setError(err.message))
            .finally(() => setSubmitting(false))
        }}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={submitting} />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={submitting} />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
