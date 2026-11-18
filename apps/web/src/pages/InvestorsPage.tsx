import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface Investor {
  id: string
  name: string
  investorType: string
  status: string
}

interface InvestorForm {
  name: string
  investorType: string
  status: string
}

const EMPTY_FORM: InvestorForm = { name: '', investorType: 'VENTURE', status: 'ACTIVE' }
const TYPE_OPTIONS = ['ANGEL', 'SEED', 'VENTURE', 'STRATEGIC', 'OTHER']
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'ARCHIVED']

export function InvestorsPage() {
  const { data, loading, error, reload } = useFetch<{ data: Investor[] }>('/api/v1/investors')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<InvestorForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'investor', 'write')

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/investors', { method: 'POST', body: form })
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
        title="Investors"
        action={
          canWrite ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              New investor
            </button>
          ) : undefined
        }
      />
      <Table columns={['Name', 'Type', 'Status']}>
        {data.data.map((investor) => (
          <tr key={investor.id}>
            <td>{investor.name}</td>
            <td>{investor.investorType}</td>
            <td>
              <StatusBadge status={investor.status} />
            </td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New investor" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="investor-name">Name</label>
            <input
              id="investor-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="investor-type">Type</label>
            <select
              id="investor-type"
              value={form.investorType}
              onChange={(event) => setForm({ ...form, investorType: event.target.value })}
            >
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="investor-status">Status</label>
            <select
              id="investor-status"
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
            Create investor
          </button>
        </Modal>
      )}
    </div>
  )
}