import React, { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import { ErrorState, LoadingState, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'

interface ControlPlaneOverview {
  environment: string
  status: string
  observed_at: string
  last_sequence: number
  decision_count: number
  allow_count: number
  deny_count: number
  pending_count: number
}

interface ControlPlaneDecision {
  sequence: number
  id: string
  timestamp: string
  request_id?: string
  decision_id?: string
  agent_id: string
  capability?: string
  event_type: string
  decision?: string
  reason?: string
}

interface ControlPlaneDecisionPage {
  environment: string
  observed_at: string
  items: ControlPlaneDecision[]
  next_cursor?: string
}

function formatTimestamp(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

export function ControlPlanePage() {
  const overview = useFetch<{ data: ControlPlaneOverview }>('/api/v1/control-plane/overview')
  const [items, setItems] = useState<ControlPlaneDecision[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [decisionsLoading, setDecisionsLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [decisionsError, setDecisionsError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loadInitial = useCallback(async () => {
    setDecisionsLoading(true)
    setDecisionsError(null)
    try {
      const page = await api<{ data: ControlPlaneDecisionPage }>('/api/v1/control-plane/decisions?limit=50')
      setItems(page.data.items)
      setNextCursor(page.data.next_cursor)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load decision history'
      setDecisionsError(message)
      setItems([])
      setNextCursor(undefined)
    } finally {
      setDecisionsLoading(false)
    }
  }, [reloadKey])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setDecisionsError(null)
    try {
      const page = await api<{ data: ControlPlaneDecisionPage }>(
        `/api/v1/control-plane/decisions?limit=50&after=${encodeURIComponent(nextCursor)}`,
      )
      setItems((current) => [...current, ...page.data.items])
      setNextCursor(page.data.next_cursor)
    } catch (error) {
      setDecisionsError(error instanceof ApiError ? error.message : 'Unable to load more decisions')
    } finally {
      setLoadingMore(false)
    }
  }

  const refresh = () => {
    overview.reload()
    setReloadKey((value) => value + 1)
  }

  if (overview.loading && !overview.data) return <LoadingState />
  if (overview.error || !overview.data) {
    return <ErrorState message={overview.error ?? 'Control Plane overview unavailable'} onRetry={refresh} />
  }

  const summary = overview.data.data

  return (
    <div className="control-plane-page">
      <PageHeader
        title="Control Plane"
        action={<button className="btn" onClick={refresh}>Refresh data</button>}
      />

      <div className="control-plane-intro">
        <div>
          <span className="control-plane-eyebrow">Internal operations</span>
          <p>Read-only view of the verified authorization decision ledger.</p>
        </div>
        <span className="control-plane-readonly">READ ONLY</span>
      </div>

      <div className="control-plane-meta">
        <div>
          <span className="stat-label">Environment</span>
          <strong>{summary.environment || 'Unknown'}</strong>
        </div>
        <div>
          <span className="stat-label">Ledger integrity</span>
          <StatusBadge status={summary.status} />
        </div>
        <div>
          <span className="stat-label">Last sequence</span>
          <strong>{summary.last_sequence.toLocaleString()}</strong>
        </div>
        <div>
          <span className="stat-label">Observed at</span>
          <strong>{formatTimestamp(summary.observed_at)}</strong>
        </div>
      </div>

      <h2 className="section-title">Decision summary</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total decisions</span>
          <span className="stat-value">{summary.decision_count.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Allowed</span>
          <span className="stat-value control-plane-allow">{summary.allow_count.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Denied</span>
          <span className="stat-value control-plane-deny">{summary.deny_count.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending</span>
          <span className="stat-value control-plane-pending">{summary.pending_count.toLocaleString()}</span>
        </div>
      </div>

      <div className="control-plane-section-header">
        <div>
          <h2>Decision history</h2>
          <p>Latest authorization decisions recorded in the append-only ledger.</p>
        </div>
        <span className="control-plane-count">{items.length.toLocaleString()} loaded</span>
      </div>

      {decisionsLoading ? (
        <LoadingState />
      ) : decisionsError ? (
        <ErrorState message={decisionsError} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : items.length === 0 ? (
        <div className="empty-state">No authorization decisions recorded yet.</div>
      ) : (
        <>
          <Table columns={['Sequence', 'Timestamp', 'Agent', 'Capability', 'Decision', 'Reason']}>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="control-plane-sequence">#{item.sequence.toLocaleString()}</td>
                <td>{formatTimestamp(item.timestamp)}</td>
                <td className="control-plane-agent">{item.agent_id}</td>
                <td>{item.capability ?? '—'}</td>
                <td><StatusBadge status={item.decision ?? item.event_type} /></td>
                <td className="control-plane-reason">{item.reason ?? '—'}</td>
              </tr>
            ))}
          </Table>
          {nextCursor && (
            <div className="control-plane-load-more">
              <button className="btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more decisions'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
