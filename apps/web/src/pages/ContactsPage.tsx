import React, { useState } from 'react'
import { api } from '../api'
import { ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Table } from '../components/ui'
import { useFetch } from '../useFetch'
import { useAuth } from '../auth'

interface Contact {
  id: string
  companyId: string
  fullName: string
  email?: string
  role?: string
  status: string
}

interface ContactForm {
  fullName: string
  email: string
  role: string
  status: string
}

const EMPTY_FORM: ContactForm = { fullName: '', email: '', role: '', status: 'ACTIVE' }

export function ContactsPage() {
  const { data, loading, error, reload } = useFetch<{ data: Contact[] }>('/api/v1/contacts')
  const companies = useFetch<{ data: { id: string; name: string }[] }>('/api/v1/companies')
  const { actor } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM)
  const [companyId, setCompanyId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (loading || companies.loading) return <LoadingState />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  const canWrite = actor?.roles.some((role) => ['admin', 'manager'].includes(role.toLowerCase()) || role.toLowerCase() === 'member')

  const companyNames = new Map((companies.data?.data ?? []).map((company) => [company.id, company.name]))

  async function submit() {
    setFormError(null)
    try {
      await api('/api/v1/contacts', {
        method: 'POST',
        body: { ...form, companyId },
      })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      setCompanyId('')
      reload()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        action={
          canWrite ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setCompanyId(companies.data?.data[0]?.id ?? '')
                setShowCreate(true)
              }}
            >
              New contact
            </button>
          ) : undefined
        }
      />
      <Table columns={['Name', 'Company', 'Email', 'Role', 'Status']}>
        {data.data.map((contact) => (
          <tr key={contact.id}>
            <td>{contact.fullName}</td>
            <td>{companyNames.get(contact.companyId) ?? contact.companyId}</td>
            <td>{contact.email ?? '—'}</td>
            <td>{contact.role ?? '—'}</td>
            <td>
              <StatusBadge status={contact.status} />
            </td>
          </tr>
        ))}
      </Table>

      {showCreate && (
        <Modal title="New contact" onClose={() => setShowCreate(false)}>
          <div className="form-group">
            <label htmlFor="contact-company">Company</label>
            <select id="contact-company" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              {(companies.data?.data ?? []).map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="contact-name">Full name</label>
            <input
              id="contact-name"
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-role">Role</label>
            <input
              id="contact-role"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="contact-status">Status</label>
            <select
              id="contact-status"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="btn btn-primary btn-block" onClick={submit}>
            Create contact
          </button>
        </Modal>
      )}
    </div>
  )
}