import React from 'react'

interface StatusBadgeProps {
  status: string
}

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'status-active',
  OPEN: 'status-active',
  DONE: 'status-active',
  QUALIFIED: 'status-active',
  SUCCESS: 'status-active',
  WON: 'status-active',
  COMPLETED: 'status-active',
  READY: 'status-active',
  EXECUTING: 'status-active',
  PENDING: 'status-pending',
  NEW: 'status-pending',
  IN_PROGRESS: 'status-pending',
  PROPOSAL: 'status-pending',
  NEGOTIATION: 'status-pending',
  DRAFT: 'status-pending',
  PAUSED: 'status-pending',
  DEFERRED: 'status-pending',
  SKIPPED: 'status-pending',
  INACTIVE: 'status-inactive',
  DISQUALIFIED: 'status-inactive',
  FAILURE: 'status-inactive',
  LOST: 'status-inactive',
  ARCHIVED: 'status-inactive',
  CANCELLED: 'status-inactive',
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`badge ${STATUS_CLASS[status] ?? 'status-neutral'}`}>{status}</span>
}

export function Table({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {action}
    </div>
  )
}

export function LoadingState() {
  return <div className="empty-state">Loading...</div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty-state error-state">
      <p>{message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}