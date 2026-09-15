import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface PolicyRule {
  id: string
  resource: string
  action: string
  role: string
  effect: 'ALLOW' | 'DENY'
  priority: number
  enabled: boolean
  policyVersion: string
}

interface RuleForm {
  resource: string
  action: string
  role: string
  effect: 'ALLOW' | 'DENY'
  priority: string
  enabled: boolean
}

const EMPTY_FORM: RuleForm = { resource: 'go-gate', action: 'SEND_EMAIL', role: 'MEMBER', effect: 'DENY', priority: '0', enabled: true }

export function PoliciesPage() {
  const { data, loading, error, reload } = useFetch<{ data: PolicyRule[] }>('/api/v1/policy/rules')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'policy', 'write')
  const canDelete = can(actor, 'policy', 'delete')

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/policy/rules', {
        method: 'POST',
        body: {
          resource: form.resource,
          action: form.action,
          role: form.role,
          effect: form.effect,
          priority: form.priority ? Number(form.priority) : 0,
          enabled: form.enabled,
          policyVersion: '2026.09.17',
        },
      })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  async function toggle(rule: PolicyRule) {
    setBusyId(rule.id)
    try {
      await api(`/api/v1/policy/rules/${rule.id}`, { method: 'PUT', body: { enabled: !rule.enabled } })
      reload()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(rule: PolicyRule) {
    setBusyId(rule.id)
    try {
      await api(`/api/v1/policy/rules/${rule.id}`, { method: 'DELETE' })
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
        title="Policy Rules"
        action={
          canWrite ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              New rule
            </button>
          ) : undefined
        }
      />
      <Table columns={['Resource', 'Action', 'Role', 'Effect', 'Priority', 'Version', 'Enabled', 'Actions']}>
        {data.data.map((rule) => (
          <tr key={rule.id}>
            <td>{rule.resource}</td>
            <td>{rule.action}</td>
            <td>{rule.role}</td>
            <td>{rule.effect}</td>
            <td>{rule.priority}</td>
            <td>{rule.policyVersion}</td>
            <td>{rule.enabled ? 'yes' : 'no'}</td>
            <td>
              {canWrite && (
                <button className="btn btn-sm" disabled={busyId === rule.id} onClick={() => toggle(rule)}>
                  {rule.enabled ? 'Disable' : 'Enable'}
                </button>
              )}
              {canDelete && (
                <button className="btn btn-sm btn-danger" disabled={busyId === rule.id} onClick={() => remove(rule)}>
                  Delete
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New policy rule" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="rule-resource">Resource</label>
            <input id="rule-resource" value={form.resource} onChange={(event) => setForm({ ...form, resource: event.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="rule-action">Action</label>
            <input id="rule-action" value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="rule-role">Role</label>
            <select id="rule-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="MEMBER">MEMBER</option>
              <option value="*">* (any)</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="rule-effect">Effect</label>
            <select id="rule-effect" value={form.effect} onChange={(event) => setForm({ ...form, effect: event.target.value as 'ALLOW' | 'DENY' })}>
              <option value="ALLOW">ALLOW</option>
              <option value="DENY">DENY</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="rule-priority">Priority</label>
            <input id="rule-priority" type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} />
          </div>
          <div className="form-group form-check">
            <label htmlFor="rule-enabled">
              <input id="rule-enabled" type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
              Enabled
            </label>
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create rule
          </button>
        </Modal>
      )}
    </div>
  )
}