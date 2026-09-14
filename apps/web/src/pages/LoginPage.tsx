import React, { useState } from 'react'
import { useAuth } from '../auth'

export function LoginPage() {
  const { loginDev, isAuthenticated } = useAuth()
  const [role, setRole] = useState<'admin' | 'manager' | 'member'>('admin')
  const [error, setError] = useState<string | null>(null)

  if (isAuthenticated) {
    return null
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>NAEOS CRM</h1>
        <p className="login-subtitle">Sign in to continue</p>
        <div className="form-group">
          <label htmlFor="role">Development role</label>
          <select id="role" value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="member">Member</option>
          </select>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button
          className="btn btn-primary btn-block"
          onClick={() => loginDev(role).catch((err: Error) => setError(err.message))}
        >
          Sign in
        </button>
      </div>
    </div>
  )
}