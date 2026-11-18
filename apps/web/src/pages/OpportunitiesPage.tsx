import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface Opportunity {
  id: string
  companyId: string
  name: string
  stage: string
  amount: number
  closeDate?: string | null
  ownerId?: string
}

interface OpportunityForm {
  name: string
  stage: string
  amount: string
  closeDate: string
}

const EMPTY_FORM: OpportunityForm = { name: '', stage: 'NEW', amount: '', closeDate: '' }

export function OpportunitiesPage() {
  const { data, loading, error, reload } = useFetch<{ data: Opportunity[] }>('/api/v1/opportunities')
  const companies = useFetch<{ data: { id: string; name: string }[] }>('/api/v1/companies')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<OpportunityForm>(EMPTY_FORM)
  const [companyId, setCompanyId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (loading || companies.loading) return <LoadingState />
  if (error || !data || !companies.data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'opportunity', 'write')
  const companyNames = new Map((companies.data?.data ?? []).map((company) => [company.id, company.name]))

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/opportunities', {
        method: 'POST',
        body: {
          companyId,
          name: form.name,
          stage: form.stage,
          amount: form.amount ? Number(form.amount) : 0,
          closeDate: form.closeDate ? new Date(form.closeDate).toISOString() : null,
        },
      })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  function formatAmount(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
  }

  return (
    <div>
      <PageHeader
        title="Opportunities"
        action={
          canWrite ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setCompanyId(companies.data?.data?.[0]?.id ?? '')
                setShowCreate(true)
              }}
            >
              New opportunity
            </button>
          ) : undefined
        }
      />
      <Table columns={['Company', 'Name', 'Stage', 'Amount', 'Close date', 'Owner']}>
        {data.data.map((opportunity) => (
          <tr key={opportunity.id}>
            <td>{companyNames.get(opportunity.companyId) ?? opportunity.companyId}</td>
            <td>{opportunity.name}</td>
            <td>
              <StatusBadge status={opportunity.stage} />
            </td>
            <td>{formatAmount(opportunity.amount)}</td>
            <td>{opportunity.closeDate ? new Date(opportunity.closeDate).toLocaleDateString() : '—'}</td>
            <td>{opportunity.ownerId ?? '—'}</td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New opportunity" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="opportunity-company">Company</label>
            <select
              id="opportunity-company"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              {(companies.data?.data ?? []).map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="opportunity-name">Name</label>
            <input
              id="opportunity-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="opportunity-stage">Stage</label>
            <select
              id="opportunity-stage"
              value={form.stage}
              onChange={(event) => setForm({ ...form, stage: event.target.value })}
            >
              <option value="NEW">New</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="PROPOSAL">Proposal</option>
              <option value="NEGOTIATION">Negotiation</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="opportunity-amount">Amount (USD)</label>
            <input
              id="opportunity-amount"
              type="number"
              min={0}
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="opportunity-close-date">Close date</label>
            <input
              id="opportunity-close-date"
              type="date"
              value={form.closeDate}
              onChange={(event) => setForm({ ...form, closeDate: event.target.value })}
            />
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create opportunity
          </button>
        </Modal>
      )}
    </div>
  )
}