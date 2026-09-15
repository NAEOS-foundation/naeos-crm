import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface Partner {
  id: string
  name: string
  partnerType: string
  status: string
}

interface PartnerForm {
  name: string
  partnerType: string
  status: string
}

const EMPTY_FORM: PartnerForm = { name: '', partnerType: 'TECHNOLOGY', status: 'ACTIVE' }
const TYPE_OPTIONS = ['TECHNOLOGY', 'INTEGRATION', 'STRATEGIC', 'CHANNEL', 'RESELLER']
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'ARCHIVED']

export function PartnersPage() {
  const { data, loading, error, reload } = useFetch<{ data: Partner[] }>('/api/v1/partners')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'partner', 'write')

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/partners', { method: 'POST', body: form })
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
        title="Partners"
        action={
          canWrite ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              New partner
            </button>
          ) : undefined
        }
      />
      <Table columns={['Name', 'Type', 'Status']}>
        {data.data.map((partner) => (
          <tr key={partner.id}>
            <td>{partner.name}</td>
            <td>{partner.partnerType}</td>
            <td>
              <StatusBadge status={partner.status} />
            </td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New partner" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="partner-name">Name</label>
            <input
              id="partner-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="partner-type">Type</label>
            <select
              id="partner-type"
              value={form.partnerType}
              onChange={(event) => setForm({ ...form, partnerType: event.target.value })}
            >
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="partner-status">Status</label>
            <select
              id="partner-status"
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
            Create partner
          </button>
        </Modal>
      )}
    </div>
  )
}