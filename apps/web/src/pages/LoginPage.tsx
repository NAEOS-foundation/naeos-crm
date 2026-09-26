import React, { useState } from 'react'
import { useAuth } from '../auth'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (isAuthenticated) return null

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>NAEOS CRM</h1>
        <p className="login-subtitle">Sign in to continue</p>
        <form onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          login(email, password).catch((err: Error) => setError(err.message))
        }}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" minLength={15} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit">Sign in</button>
        </form>
      </div>
    </div>
  )
}
