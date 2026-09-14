import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'

interface Activity {
  id: string
  companyId?: string
  contactId?: string
  type: string
  channel?: string
  summary: string
  occurredAt: string
  ownerId?: string
}

interface ActivityForm {
  type: string
  channel: string
  summary: string
}

const EMPTY_FORM: ActivityForm = { type: 'EMAIL', channel: '', summary: '' }

export function ActivitiesPage() {
  const { data, loading, error, reload } = useFetch<{ data: Activity[] }>('/api/v1/activities')
  const companies = useFetch<{ data: { id: string; name: string }[] }>('/api/v1/companies')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<ActivityForm>(EMPTY_FORM)
  const [companyId, setCompanyId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (loading || companies.loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const companyNames = new Map((companies.data?.data ?? []).map((company) => [company.id, company.name]))

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/activities', {
        method: 'POST',
        body: {
          companyId: companyId || undefined,
          type: form.type,
          channel: form.channel || undefined,
          summary: form.summary,
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
        title="Activities"
        action={
          <button
            className="btn btn-primary"
            onClick={() => {
              setCompanyId(companies.data?.data[0]?.id ?? '')
              setShowCreate(true)
            }}
          >
            New activity
          </button>
        }
      />
      <Table columns={['Date', 'Type', 'Company', 'Channel', 'Summary']}>
        {data.data.map((activity) => (
          <tr key={activity.id}>
            <td>{new Date(activity.occurredAt).toLocaleString()}</td>
            <td>
              <StatusBadge status={activity.type} />
            </td>
            <td>{activity.companyId ? (companyNames.get(activity.companyId) ?? activity.companyId) : '—'}</td>
            <td>{activity.channel ?? '—'}</td>
            <td>{activity.summary}</td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New activity" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="activity-type">Type</label>
            <select
              id="activity-type"
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
            >
              <option value="EMAIL">Email</option>
              <option value="CALL">Call</option>
              <option value="MEETING">Meeting</option>
              <option value="TASK">Task</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="activity-company">Company</label>
            <select id="activity-company" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              <option value="">None</option>
              {(companies.data?.data ?? []).map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="activity-channel">Channel</label>
            <input
              id="activity-channel"
              value={form.channel}
              onChange={(event) => setForm({ ...form, channel: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="activity-summary">Summary</label>
            <input
              id="activity-summary"
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
            />
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create activity
          </button>
        </Modal>
      )}
    </div>
  )
}