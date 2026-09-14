import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'

interface Task {
  id: string
  companyId?: string
  assigneeId?: string
  subject: string
  dueAt?: string
  status: string
}

interface TaskForm {
  subject: string
  status: string
  dueAt: string
}

const EMPTY_FORM: TaskForm = { subject: '', status: 'OPEN', dueAt: '' }

export function TasksPage() {
  const { data, loading, error, reload } = useFetch<{ data: Task[] }>('/api/v1/tasks')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/tasks', {
        method: 'POST',
        body: {
          subject: form.subject,
          status: form.status,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
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
        title="Tasks"
        action={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            New task
          </button>
        }
      />
      <Table columns={['Subject', 'Status', 'Due', 'Assignee']}>
        {data.data.map((task) => (
          <tr key={task.id}>
            <td>{task.subject}</td>
            <td>
              <StatusBadge status={task.status} />
            </td>
            <td>{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : '—'}</td>
            <td>{task.assigneeId ?? '—'}</td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New task" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="task-subject">Subject</label>
            <input
              id="task-subject"
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="task-status">Status</label>
            <select
              id="task-status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="task-due">Due date</label>
            <input
              id="task-due"
              type="date"
              value={form.dueAt}
              onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
            />
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create task
          </button>
        </Modal>
      )}
    </div>
  )
}