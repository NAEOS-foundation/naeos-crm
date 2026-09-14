import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface Lead {
  id: string
  companyId: string
  source: string
  status: string
  ownerId?: string
  score?: number
}

interface LeadForm {
  source: string
  status: string
  score: string
}

const EMPTY_FORM: LeadForm = { source: '', status: 'NEW', score: '' }

export function LeadsPage() {
  const { data, loading, error, reload } = useFetch<{ data: Lead[] }>('/api/v1/leads')
  const companies = useFetch<{ data: { id: string; name: string }[] }>('/api/v1/companies')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM)
  const [companyId, setCompanyId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (loading || companies.loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'lead', 'write')
  const companyNames = new Map((companies.data?.data ?? []).map((company) => [company.id, company.name]))

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/leads', {
        method: 'POST',
        body: {
          companyId,
          source: form.source,
          status: form.status,
          score: form.score ? Number(form.score) : undefined,
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
        title="Leads"
        action={
          canWrite ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setCompanyId(companies.data?.data[0]?.id ?? '')
                setShowCreate(true)
              }}
            >
              New lead
            </button>
          ) : undefined
        }
      />
      <Table columns={['Company', 'Source', 'Status', 'Score', 'Owner']}>
        {data.data.map((lead) => (
          <tr key={lead.id}>
            <td>{companyNames.get(lead.companyId) ?? lead.companyId}</td>
            <td>{lead.source}</td>
            <td>
              <StatusBadge status={lead.status} />
            </td>
            <td>{lead.score ?? '—'}</td>
            <td>{lead.ownerId ?? '—'}</td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New lead" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="lead-company">Company</label>
            <select id="lead-company" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              {(companies.data?.data ?? []).map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="lead-source">Source</label>
            <input
              id="lead-source"
              value={form.source}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="lead-status">Status</label>
            <select
              id="lead-status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="NEW">New</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="NURTURE">Nurture</option>
              <option value="DISQUALIFIED">Disqualified</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="lead-score">Score (0-100)</label>
            <input
              id="lead-score"
              type="number"
              min={0}
              max={100}
              value={form.score}
              onChange={(event) => setForm({ ...form, score: event.target.value })}
            />
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create lead
          </button>
        </Modal>
      )}
    </div>
  )
}