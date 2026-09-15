import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface GoGateRequest {
  id: string
  actionType: string
  target: string
  status: string
  policyVersion?: string | null
  reason?: string | null
  requestedBy?: string | null
  approvedBy?: string | null
  expiresAt?: string | null
  result?: string | null
}

const ACTION_TYPES = ['SEND_EMAIL', 'SEND_MESSAGE', 'PUBLISH_POST', 'CONTACT_PROSPECT', 'CREATE_ISSUE', 'TRIGGER_WORKFLOW', 'MODIFY_EXTERNAL_SYSTEM']

interface RequestForm {
  actionType: string
  target: string
  payload: string
}

const EMPTY_FORM: RequestForm = { actionType: ACTION_TYPES[0], target: '', payload: '' }

export function GoGatePage() {
  const { data, loading, error, reload } = useFetch<{ data: GoGateRequest[] }>('/api/v1/go-gate')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'go-gate', 'write')
  const canApprove = can(actor, 'go-gate', 'approve')
  const canExecute = can(actor, 'go-gate', 'execute')

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/go-gate', {
        method: 'POST',
        body: {
          actionType: form.actionType,
          target: form.target,
          payload: form.payload ? (JSON.parse(form.payload) as Record<string, unknown>) : undefined,
        },
      })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  async function act(id: string, path: string, body?: Record<string, unknown>) {
    setBusyId(id)
    try {
      await api(`/api/v1/go-gate/${id}/${path}`, { method: 'POST', body })
      reload()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="GO-Gate"
        action={
          canWrite ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              New request
            </button>
          ) : undefined
        }
      />
      <Table columns={['Action', 'Target', 'Status', 'Policy', 'Result', 'Actions']}>
        {data.data.map((request) => (
          <tr key={request.id}>
            <td>{request.actionType}</td>
            <td>{request.target}</td>
            <td>{request.status}</td>
            <td>{request.policyVersion ?? '—'}</td>
            <td>{request.result ?? '—'}</td>
            <td>
              {request.status === 'WAITING_FOR_GO' && canApprove && (
                <button className="btn btn-sm btn-primary" disabled={busyId === request.id} onClick={() => act(request.id, 'approve')}>
                  Approve
                </button>
              )}
              {request.status === 'WAITING_FOR_GO' && canApprove && (
                <button className="btn btn-sm btn-danger" disabled={busyId === request.id} onClick={() => act(request.id, 'reject')}>
                  Reject
                </button>
              )}
              {request.status === 'APPROVED' && canExecute && (
                <button className="btn btn-sm" disabled={busyId === request.id} onClick={() => act(request.id, 'execute')}>
                  Execute
                </button>
              )}
              {request.status !== 'WAITING_FOR_GO' && request.status !== 'APPROVED' && <span className="text-muted">—</span>}
            </td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New GO-Gate request" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="gogate-action">Action type</label>
            <select id="gogate-action" value={form.actionType} onChange={(event) => setForm({ ...form, actionType: event.target.value })}>
              {ACTION_TYPES.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {actionType}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="gogate-target">Target</label>
            <input id="gogate-target" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="gogate-payload">Payload (JSON, optional)</label>
            <input id="gogate-payload" value={form.payload} onChange={(event) => setForm({ ...form, payload: event.target.value })} />
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Submit request
          </button>
        </Modal>
      )}
    </div>
  )
}