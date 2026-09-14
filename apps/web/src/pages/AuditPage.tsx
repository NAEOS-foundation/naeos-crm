import React from 'react'
import { ErrorState, LoadingState, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'

interface AuditEvent {
  id: string
  actorId?: string
  action: string
  entityType: string
  entityId: string
  requestId?: string
  result: string
  createdAt: string
}

export function AuditPage() {
  const { data, loading, error, reload } = useFetch<{ data: AuditEvent[] }>('/api/v1/audit')

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  return (
    <div>
      <PageHeader title="Audit log" />
      <Table columns={['Timestamp', 'Actor', 'Action', 'Entity', 'Result']}>
        {data.data.map((event) => (
          <tr key={event.id}>
            <td>{new Date(event.createdAt).toLocaleString()}</td>
            <td>{event.actorId ?? 'system'}</td>
            <td>{event.action}</td>
            <td>
              {event.entityType}:{event.entityId.slice(0, 8)}
            </td>
            <td>
              <StatusBadge status={event.result} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  )
}