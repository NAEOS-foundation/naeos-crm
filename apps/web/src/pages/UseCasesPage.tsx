import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface UseCase {
  id: string
  opportunityId: string
  title: string
  summary?: string | null
  value?: number | null
}

interface UseCaseForm {
  title: string
  summary: string
  value: string
}

const EMPTY_FORM: UseCaseForm = { title: '', summary: '', value: '' }

export function UseCasesPage() {
  const { data, loading, error, reload } = useFetch<{ data: UseCase[] }>('/api/v1/use-cases')
  const opportunities = useFetch<{ data: { id: string; name: string }[] }>('/api/v1/opportunities')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<UseCaseForm>(EMPTY_FORM)
  const [opportunityId, setOpportunityId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (loading || opportunities.loading) return <LoadingState />
  if (error || !data || !opportunities.data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'use-case', 'write')
  const opportunityNames = new Map((opportunities.data?.data ?? []).map((opportunity) => [opportunity.id, opportunity.name]))

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/use-cases', {
        method: 'POST',
        body: {
          opportunityId,
          title: form.title,
          summary: form.summary || undefined,
          value: form.value ? Number(form.value) : undefined,
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
        title="NAEOS Use Cases"
        action={
          canWrite ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setOpportunityId(opportunities.data?.data?.[0]?.id ?? '')
                setShowCreate(true)
              }}
            >
              New use case
            </button>
          ) : undefined
        }
      />
      <Table columns={['Title', 'Opportunity', 'Summary', 'Value']}>
        {data.data.map((useCase) => (
          <tr key={useCase.id}>
            <td>{useCase.title}</td>
            <td>{useCase.opportunityId ? opportunityNames.get(useCase.opportunityId) ?? useCase.opportunityId : '—'}</td>
            <td>{useCase.summary ?? '—'}</td>
            <td>{useCase.value != null ? `$${useCase.value.toLocaleString()}` : '—'}</td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New use case" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="usecase-opportunity">Opportunity</label>
            <select id="usecase-opportunity" value={opportunityId} onChange={(event) => setOpportunityId(event.target.value)}>
              {(opportunities.data?.data ?? []).map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="usecase-title">Title</label>
            <input
              id="usecase-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="usecase-summary">Summary</label>
            <input
              id="usecase-summary"
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="usecase-value">Value (USD)</label>
            <input
              id="usecase-value"
              type="number"
              min={0}
              value={form.value}
              onChange={(event) => setForm({ ...form, value: event.target.value })}
            />
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create use case
          </button>
        </Modal>
      )}
    </div>
  )
}