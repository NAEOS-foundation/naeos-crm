import React from 'react'
import { ErrorState, LoadingState, PageHeader, Table } from '../components/ui'
import { useFetch } from '../useFetch'

interface PipelineStageBreakdown {
  stage: string
  count: number
  amount: number
  weightedAmount: number
}

interface PipelineAnalytics {
  totalValue: number
  weightedValue: number
  openCount: number
  wonCount: number
  lostCount: number
  avgDealSize: number
  byStage: PipelineStageBreakdown[]
}

interface CampaignAnalytics {
  total: number
  byStatus: Record<string, number>
  stepsPrepared: number
}

interface FollowUpAnalytics {
  openCount: number
  overdueCount: number
  dueTodayCount: number
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

export function AnalyticsPage() {
  const pipeline = useFetch<{ data: PipelineAnalytics }>('/api/v1/analytics/pipeline')
  const campaigns = useFetch<{ data: CampaignAnalytics }>('/api/v1/analytics/campaigns')
  const followUps = useFetch<{ data: FollowUpAnalytics }>('/api/v1/analytics/follow-ups')

  if (pipeline.loading || campaigns.loading || followUps.loading) return <LoadingState />
  const error = pipeline.error || campaigns.error || followUps.error
  if (error || !pipeline.data || !campaigns.data || !followUps.data) {
    return <ErrorState message={error ?? 'No data'} onRetry={pipeline.reload} />
  }

  const pipe = pipeline.data.data
  const camp = campaigns.data.data
  const fu = followUps.data.data

  return (
    <div>
      <PageHeader title="Analytics" />

      <h2 className="section-title">Pipeline</h2>
      <div className="stat-grid">
        <StatCard label="Open value" value={formatAmount(pipe.totalValue)} hint={`${pipe.openCount} open`} />
        <StatCard label="Weighted value" value={formatAmount(pipe.weightedValue)} hint="probability adjusted" />
        <StatCard label="Won" value={String(pipe.wonCount)} />
        <StatCard label="Lost" value={String(pipe.lostCount)} />
        <StatCard label="Avg deal size" value={formatAmount(pipe.avgDealSize)} />
      </div>

      <Table columns={['Stage', 'Count', 'Amount', 'Weighted amount']}>
        {pipe.byStage.map((stage) => (
          <tr key={stage.stage}>
            <td>{stage.stage}</td>
            <td>{stage.count}</td>
            <td>{formatAmount(stage.amount)}</td>
            <td>{formatAmount(stage.weightedAmount)}</td>
          </tr>
        ))}
      </Table>

      <h2 className="section-title">Campaigns</h2>
      <div className="stat-grid">
        <StatCard label="Total campaigns" value={String(camp.total)} />
        <StatCard label="Active" value={String(camp.byStatus.ACTIVE ?? 0)} />
        <StatCard label="Draft" value={String(camp.byStatus.DRAFT ?? 0)} />
        <StatCard label="Steps prepared" value={String(camp.stepsPrepared)} />
      </div>

      <h2 className="section-title">Follow-ups</h2>
      <div className="stat-grid">
        <StatCard label="Open" value={String(fu.openCount)} />
        <StatCard label="Overdue" value={String(fu.overdueCount)} />
        <StatCard label="Due today" value={String(fu.dueTodayCount)} />
      </div>
    </div>
  )
}