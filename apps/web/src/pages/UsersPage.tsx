import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'

interface User {
  id: string
  email: string
  name: string
  roles: string[]
  status: string
}

interface UserForm {
  name: string
  status: string
}

const EMPTY_FORM: UserForm = { name: '', status: 'ACTIVE' }

export function UsersPage() {
  const { data, loading, error, reload } = useFetch<{ data: User[] }>('/api/v1/users')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/users', {
        method: 'POST',
        body: { ...form, email },
      })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      setEmail('')
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        action={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            New user
          </button>
        }
      />
      <Table columns={['Name', 'Email', 'Roles', 'Status']}>
        {data.data.map((user) => (
          <tr key={user.id}>
            <td>{user.name}</td>
            <td>{user.email}</td>
            <td>{user.roles.join(', ')}</td>
            <td>
              <StatusBadge status={user.status} />
            </td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New user" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="user-name">Name</label>
            <input
              id="user-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="user-email">Email</label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="user-status">Status</label>
            <select
              id="user-status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create user
          </button>
        </Modal>
      )}
    </div>
  )
}