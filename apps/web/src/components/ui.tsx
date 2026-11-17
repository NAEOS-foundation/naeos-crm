import React, { useEffect, useId, useRef } from 'react'

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
  const titleId = useId()
  const modalRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const modal = modalRef.current
    const getFocusableElements = () => {
      if (!modal) return []
      return Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true')
    }

    const focusableElements = getFocusableElements()
    ;(focusableElements[0] ?? modal)?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !modal) return

      const elements = getFocusableElements()
      if (elements.length === 0) {
        event.preventDefault()
        modal.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label={`Close ${title} dialog`}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
