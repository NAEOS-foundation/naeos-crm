import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'
import { can } from '../permissions'

interface Campaign {
  id: string
  name: string
  type: string
  status: string
  ownerId?: string
}

interface CampaignStep {
  id: string
  campaignId: string
  sequence: number
  actionType: string
  subject?: string | null
  scheduledAt?: string | null
  status: string
}

interface CampaignForm {
  name: string
  type: string
  status: string
}

interface StepForm {
  sequence: string
  actionType: string
  subject: string
  status: string
}

const EMPTY_CAMPAIGN: CampaignForm = { name: '', type: 'OUTBOUND', status: 'DRAFT' }
const EMPTY_STEP: StepForm = { sequence: '', actionType: 'EMAIL', subject: '', status: 'PENDING' }

export function CampaignsPage() {
  const { data, loading, error, reload } = useFetch<{ data: Campaign[] }>('/api/v1/campaigns')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(EMPTY_CAMPAIGN)
  const [campaignError, setCampaignError] = useState<string | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [steps, setSteps] = useState<CampaignStep[]>([])
  const [stepsLoading, setStepsLoading] = useState(false)
  const [showStep, setShowStep] = useState(false)
  const [stepForm, setStepForm] = useState<StepForm>(EMPTY_STEP)
  const [stepError, setStepError] = useState<string | null>(null)

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = can(actor, 'campaign', 'write')

  async function openSteps(campaign: Campaign) {
    setSelectedCampaign(campaign)
    setStepsLoading(true)
    try {
      const result = await api<{ data: CampaignStep[] }>(`/api/v1/campaigns/${campaign.id}/steps`)
      setSteps(result.data)
    } catch (err) {
      setSteps([])
      setCampaignError((err as Error).message)
    } finally {
      setStepsLoading(false)
    }
  }

  async function createCampaign() {
    setCampaignError(null)
    try {
      await api('/api/v1/campaigns', {
        method: 'POST',
        body: {
          name: campaignForm.name,
          type: campaignForm.type,
          status: campaignForm.status,
        },
      })
      setShowCreate(false)
      setCampaignForm(EMPTY_CAMPAIGN)
      reload()
    } catch (err) {
      setCampaignError((err as Error).message)
    }
  }

  async function createStep() {
    if (!selectedCampaign) return
    setStepError(null)
    try {
      await api(`/api/v1/campaigns/${selectedCampaign.id}/steps`, {
        method: 'POST',
        body: {
          sequence: Number(stepForm.sequence),
          actionType: stepForm.actionType,
          subject: stepForm.subject || undefined,
          status: stepForm.status,
        },
      })
      setShowStep(false)
      setStepForm(EMPTY_STEP)
      await openSteps(selectedCampaign)
    } catch (err) {
      setStepError((err as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Campaigns"
        action={
          canWrite ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              New campaign
            </button>
          ) : undefined
        }
      />
      <Table columns={['Name', 'Type', 'Status', 'Owner', 'Sequences']}>
        {data.data.map((campaign) => (
          <tr key={campaign.id}>
            <td>{campaign.name}</td>
            <td>
              <StatusBadge status={campaign.type} />
            </td>
            <td>
              <StatusBadge status={campaign.status} />
            </td>
            <td>{campaign.ownerId ?? '—'}</td>
            <td>
              <button className="btn btn-ghost" onClick={() => openSteps(campaign)}>
                Steps
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New campaign" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="campaign-name">Name</label>
            <input
              id="campaign-name"
              value={campaignForm.name}
              onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="campaign-type">Type</label>
            <select
              id="campaign-type"
              value={campaignForm.type}
              onChange={(event) => setCampaignForm({ ...campaignForm, type: event.target.value })}
            >
              <option value="OUTBOUND">Outbound</option>
              <option value="INBOUND">Inbound</option>
              <option value="NURTURE">Nurture</option>
              <option value="EVENT">Event</option>
              <option value="PARTNER">Partner</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="campaign-status">Status</label>
            <select
              id="campaign-status"
              value={campaignForm.status}
              onChange={(event) => setCampaignForm({ ...campaignForm, status: event.target.value })}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          {campaignError && <p className="form-error">{campaignError}</p>}
          <button className="btn btn-primary btn-block" onClick={createCampaign}>
            Create campaign
          </button>
        </Modal>
      )}

      {selectedCampaign && (
        <Modal title={`Sequences · ${selectedCampaign.name}`} onClose={() => setSelectedCampaign(null)}>
          {stepsLoading ? (
            <LoadingState />
          ) : (
            <Table columns={['Seq', 'Action', 'Subject', 'Status']}>
              {steps.map((step) => (
                <tr key={step.id}>
                  <td>{step.sequence}</td>
                  <td>{step.actionType}</td>
                  <td>{step.subject ?? '—'}</td>
                  <td>
                    <StatusBadge status={step.status} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setShowStep(true)}>
              Add step
            </button>
          )}
          {showStep && (
            <div className="modal-inner-form">
              <div className="form-group">
                <label htmlFor="step-sequence">Sequence</label>
                <input
                  id="step-sequence"
                  type="number"
                  min={0}
                  value={stepForm.sequence}
                  onChange={(event) => setStepForm({ ...stepForm, sequence: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="step-action">Action</label>
                <select
                  id="step-action"
                  value={stepForm.actionType}
                  onChange={(event) => setStepForm({ ...stepForm, actionType: event.target.value })}
                >
                  <option value="EMAIL">Email</option>
                  <option value="CALL">Call</option>
                  <option value="TASK">Task</option>
                  <option value="WAIT">Wait</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="step-subject">Subject</label>
                <input
                  id="step-subject"
                  value={stepForm.subject}
                  onChange={(event) => setStepForm({ ...stepForm, subject: event.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="step-status">Status</label>
                <select
                  id="step-status"
                  value={stepForm.status}
                  onChange={(event) => setStepForm({ ...stepForm, status: event.target.value })}
                >
                  <option value="PENDING">Pending</option>
                  <option value="READY">Ready</option>
                  <option value="EXECUTING">Executing</option>
                  <option value="DONE">Done</option>
                  <option value="SKIPPED">Skipped</option>
                </select>
              </div>
              {stepError && <p className="form-error">{stepError}</p>}
              <button className="btn btn-primary btn-block" onClick={createStep}>
                Add step
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}