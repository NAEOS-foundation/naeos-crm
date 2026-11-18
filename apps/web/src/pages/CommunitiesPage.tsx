import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface Community {
  id: string
  name: string
  purpose?: string
  status: string
}

interface CommunityForm {
  name: string
  purpose: string
  status: string
}

const EMPTY_FORM: CommunityForm = { name: '', purpose: '', status: 'ACTIVE' }
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'ARCHIVED']

export function CommunitiesPage() {
  const { data, loading, error, reload } = useFetch<{ data: Community[] }>('/api/v1/communities')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CommunityForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'community', 'write')

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/communities', {
        method: 'POST',
        body: { name: form.name, purpose: form.purpose || undefined, status: form.status },
      })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Communities"
        action={
          canWrite ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              New community
            </button>
          ) : undefined
        }
      />
      <Table columns={['Name', 'Purpose', 'Status']}>
        {data.data.map((community) => (
          <tr key={community.id}>
            <td>{community.name}</td>
            <td>{community.purpose ?? '—'}</td>
            <td>
              <StatusBadge status={community.status} />
            </td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New community" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="community-name">Name</label>
            <input
              id="community-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="community-purpose">Purpose</label>
            <input
              id="community-purpose"
              value={form.purpose}
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="community-status">Status</label>
            <select
              id="community-status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create community
          </button>
        </Modal>
      )}
    </div>
  )
}