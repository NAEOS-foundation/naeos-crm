import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'

interface Company {
  id: string
  name: string
  industry?: string
  region?: string
  status: string
  ownerId?: string
  createdAt: string
}

interface CompanyForm {
  name: string
  industry: string
  region: string
  status: string
}

const EMPTY_FORM: CompanyForm = { name: '', industry: '', region: '', status: 'ACTIVE' }

export function CompaniesPage() {
  const { data, loading, error, reload } = useFetch<{ data: Company[] }>('/api/v1/companies')
  const { actor } = useAuth()
  const [editing, setEditing] = useState<Company | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = actor?.roles.some((role) => ['admin', 'manager'].includes(role.toLowerCase()))
  const canDelete = actor?.roles.some((role) => role.toLowerCase() === 'admin')

  async function submit() {
    setFormError(null)
    try {
      if (editing) {
        await api(`/api/v1/companies/${editing.id}`, { method: 'PUT', body: form })
      } else {
        await api('/api/v1/companies', { method: 'POST', body: form })
      }
      setShowCreate(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  async function remove(company: Company) {
    if (!window.confirm(`Delete ${company.name}?`)) return
    await api(`/api/v1/companies/${company.id}`, { method: 'DELETE' })
    reload()
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        action={
          canWrite ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditing(null)
                setForm(EMPTY_FORM)
                setShowCreate(true)
              }}
            >
              New company
            </button>
          ) : undefined
        }
      />
      <Table columns={['Name', 'Industry', 'Region', 'Status', 'Created', 'Actions']}>
        {data.data.map((company) => (
          <tr key={company.id}>
            <td>{company.name}</td>
            <td>{company.industry ?? '—'}</td>
            <td>{company.region ?? '—'}</td>
            <td>
              <StatusBadge status={company.status} />
            </td>
            <td>{new Date(company.createdAt).toLocaleDateString()}</td>
            <td className="row-actions">
              {canWrite && (
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setEditing(company)
                    setForm({
                      name: company.name,
                      industry: company.industry ?? '',
                      region: company.region ?? '',
                      status: company.status,
                    })
                    setShowCreate(true)
                  }}
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button className="btn btn-sm btn-danger" onClick={() => remove(company)}>
                  Delete
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title={editing ? `Edit ${editing.name}` : 'New company'} onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="company-name">Name</label>
            <input
              id="company-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="company-industry">Industry</label>
            <input
              id="company-industry"
              value={form.industry}
              onChange={(event) => setForm({ ...form, industry: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="company-region">Region</label>
            <input
              id="company-region"
              value={form.region}
              onChange={(event) => setForm({ ...form, region: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="company-status">Status</label>
            <select
              id="company-status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            {editing ? 'Save changes' : 'Create company'}
          </button>
        </Modal>
      )}
    </div>
  )
}