import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface FollowUp {
  id: string
  activityId: string
  dueAt: string
  status: string
  ownerId?: string
  notes?: string | null
}

interface FollowUpForm {
  dueAt: string
  status: string
  notes: string
}

const EMPTY_FORM: FollowUpForm = { dueAt: '', status: 'OPEN', notes: '' }

export function FollowUpsPage() {
  const { data, loading, error, reload } = useFetch<{ data: FollowUp[] }>('/api/v1/follow-ups')
  const activities = useFetch<{ data: { id: string; summary: string }[] }>('/api/v1/activities')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<FollowUpForm>(EMPTY_FORM)
  const [activityId, setActivityId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (loading || activities.loading) return <LoadingState />
  if (error || !data || !activities.data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'follow-up', 'write')
  const activitySummaries = new Map(
    (activities.data?.data ?? []).map((activity) => [activity.id, activity.summary]),
  )

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/follow-ups', {
        method: 'POST',
        body: {
          activityId,
          dueAt: new Date(form.dueAt).toISOString(),
          status: form.status,
          notes: form.notes || undefined,
        },
      })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  function formatDue(dueAt: string, status: string) {
    const date = new Date(dueAt)
    const isOverdue = new Date(dueAt) < new Date() && status !== 'DONE'
    return <span className={isOverdue ? 'text-warning' : undefined}>{date.toLocaleString()}</span>
  }

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        action={
          canWrite ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setActivityId(activities.data?.data?.[0]?.id ?? '')
                setShowCreate(true)
              }}
            >
              New follow-up
            </button>
          ) : undefined
        }
      />
      <Table columns={['Activity', 'Due', 'Status', 'Owner', 'Notes']}>
        {data.data.map((followUp) => (
          <tr key={followUp.id}>
            <td>{activitySummaries.get(followUp.activityId) ?? followUp.activityId}</td>
            <td>{formatDue(followUp.dueAt, followUp.status)}</td>
            <td>
              <StatusBadge status={followUp.status} />
            </td>
            <td>{followUp.ownerId ?? '—'}</td>
            <td>{followUp.notes ?? '—'}</td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New follow-up" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="followup-activity">Activity</label>
            <select
              id="followup-activity"
              value={activityId}
              onChange={(event) => setActivityId(event.target.value)}
            >
              {(activities.data?.data ?? []).map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.summary}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="followup-due">Due at</label>
            <input
              id="followup-due"
              type="datetime-local"
              value={form.dueAt}
              onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="followup-status">Status</label>
            <select
              id="followup-status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="OPEN">Open</option>
              <option value="DONE">Done</option>
              <option value="DEFERRED">Deferred</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="followup-notes">Notes</label>
            <textarea
              id="followup-notes"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create follow-up
          </button>
        </Modal>
      )}
    </div>
  )
}