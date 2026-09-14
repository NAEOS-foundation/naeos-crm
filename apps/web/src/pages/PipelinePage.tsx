import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface PipelineStage {
  id: string
  stage: string
  name: string
  sequence: number
  probability: number
}

interface StageForm {
  stage: string
  name: string
  sequence: string
  probability: string
}

const EMPTY_FORM: StageForm = { stage: 'NEW', name: '', sequence: '', probability: '20' }

export function PipelinePage() {
  const { data, loading, error, reload } = useFetch<{ data: PipelineStage[] }>('/api/v1/pipeline-stages')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<StageForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'pipeline', 'write')

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/pipeline-stages', {
        method: 'POST',
        body: {
          stage: form.stage,
          name: form.name,
          sequence: Number(form.sequence),
          probability: form.probability ? Number(form.probability) : 20,
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
        title="Pipeline stages"
        action={
          canWrite ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              New stage
            </button>
          ) : undefined
        }
      />
      <Table columns={['Sequence', 'Stage', 'Display name', 'Probability']}>
        {data.data.map((stage) => (
          <tr key={stage.id}>
            <td>{stage.sequence}</td>
            <td>{stage.stage}</td>
            <td>{stage.name}</td>
            <td>{stage.probability}%</td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New pipeline stage" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="stage-stage">Stage</label>
            <select
              id="stage-stage"
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
            <label htmlFor="stage-name">Display name</label>
            <input
              id="stage-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="stage-sequence">Sequence</label>
            <input
              id="stage-sequence"
              type="number"
              min={0}
              value={form.sequence}
              onChange={(event) => setForm({ ...form, sequence: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="stage-probability">Win probability (0-100)</label>
            <input
              id="stage-probability"
              type="number"
              min={0}
              max={100}
              value={form.probability}
              onChange={(event) => setForm({ ...form, probability: event.target.value })}
            />
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create stage
          </button>
        </Modal>
      )}
    </div>
  )
}