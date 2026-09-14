import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface Contributor {
  id: string
  name: string
  role: string
  status: string
  communityId?: string
}

interface ContributorForm {
  name: string
  role: string
  status: string
}

const EMPTY_FORM: ContributorForm = { name: '', role: 'DEVELOPER', status: 'ACTIVE' }
const ROLE_OPTIONS = ['DEVELOPER', 'DESIGNER', 'REVIEWER', 'MAINTAINER', 'ADVISOR']
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'ARCHIVED']

export function ContributorsPage() {
  const { data, loading, error, reload } = useFetch<{ data: Contributor[] }>('/api/v1/contributors')
  const communities = useFetch<{ data: { id: string; name: string }[] }>('/api/v1/communities')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<ContributorForm>(EMPTY_FORM)
  const [communityId, setCommunityId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (loading || communities.loading) return <LoadingState />
  if (error || !data || !communities.data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'contributor', 'write')
  const communityNames = new Map((communities.data?.data ?? []).map((community) => [community.id, community.name]))

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/contributors', {
        method: 'POST',
        body: {
          name: form.name,
          role: form.role,
          status: form.status,
          communityId: communityId || undefined,
        },
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
        title="Contributors"
        action={
          canWrite ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              New contributor
            </button>
          ) : undefined
        }
      />
      <Table columns={['Name', 'Role', 'Status', 'Community']}>
        {data.data.map((contributor) => (
          <tr key={contributor.id}>
            <td>{contributor.name}</td>
            <td>{contributor.role}</td>
            <td>
              <StatusBadge status={contributor.status} />
            </td>
            <td>{contributor.communityId ? communityNames.get(contributor.communityId) ?? '—' : '—'}</td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New contributor" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="contributor-name">Name</label>
            <input
              id="contributor-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="contributor-role">Role</label>
            <select
              id="contributor-role"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="contributor-status">Status</label>
            <select
              id="contributor-status"
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
          <div className="form-group">
            <label htmlFor="contributor-community">Community</label>
            <select id="contributor-community" value={communityId} onChange={(event) => setCommunityId(event.target.value)}>
              <option value="">— None —</option>
              {(communities.data?.data ?? []).map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create contributor
          </button>
        </Modal>
      )}
    </div>
  )
}