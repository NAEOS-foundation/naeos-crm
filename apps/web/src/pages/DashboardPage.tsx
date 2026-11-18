import React from 'react'
import { PageHeader, ErrorState, LoadingState } from '../components/ui'
import { useFetch } from '../useFetch'

interface DashboardSummary {
  companies: { total: number; active: number }
  contacts: { total: number }
  leads: { total: number; byStatus: Record<string, number> }
  activities: { total: number; recent: number }
  tasks: { total: number; open: number; overdue: number }
}

export function DashboardPage() {
  const { data, loading, error, reload } = useFetch<{ data: DashboardSummary }>('/api/v1/dashboard')

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const summary = data.data

  const cards = [
    { label: 'Companies', value: `${summary.companies.active}/${summary.companies.total} active` },
    { label: 'Contacts', value: String(summary.contacts.total) },
    { label: 'Leads', value: String(summary.leads.total) },
    { label: 'Activities', value: `${summary.activities.recent} in 30 days` },
    { label: 'Open tasks', value: String(summary.tasks.open) },
    { label: 'Overdue tasks', value: String(summary.tasks.overdue) },
  ]

  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="stat-grid">
        {cards.map((card) => (
          <div key={card.label} className="stat-card">
            <span className="stat-label">{card.label}</span>
            <span className="stat-value">{card.value}</span>
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>Leads by status</h2>
        <div className="bar-list">
          {Object.entries(summary.leads.byStatus).map(([status, count]) => (
            <div key={status} className="bar-row">
              <span className="bar-label">{status}</span>
              <span className="bar-count">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}