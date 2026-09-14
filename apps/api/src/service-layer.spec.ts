import { describe, expect, it } from 'vitest'
import type { AuditSink } from '@naeos-crm/audit'
import { AuditService } from '@naeos-crm/audit'
import { vi } from 'vitest'

import {
  ActivityFacade,
  CompanyFacade,
  ContactFacade,
  LeadFacade,
  TaskFacade,
  UserFacade,
} from './service-layer'
import type {
  ActivityReadPort,
  CompanyReadPort,
  ContactReadPort,
  LeadReadPort,
  TaskReadPort,
  UserReadPort,
} from './domain-interfaces'
import type { Company } from '@naeos-crm/domain'

function noopSink(): AuditSink {
  return { append: vi.fn().mockResolvedValue(undefined) }
}

function createAuditService(sink: AuditSink = noopSink()) {
  return new AuditService(sink)
}

function createCompanyPort(): CompanyReadPort & { storage: Company[] } {
  const storage: Company[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((c) => c.id === id) ?? null
    },
    async list() {
      return { data: [...storage], total: storage.length }
    },
    async create(input) {
      const company: Company = {
        ...input,
        id: `company-${storage.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      storage.push(company)
      return company
    },
    async update(id, input) {
      const index = storage.findIndex((c) => c.id === id)
      if (index === -1) return null
      storage[index] = { ...storage[index], ...input, updatedAt: new Date() }
      return storage[index]
    },
    async delete(id) {
      const index = storage.findIndex((c) => c.id === id)
      if (index === -1) return false
      storage.splice(index, 1)
      return true
    },
  }
}

function createControllablePort(): CompanyReadPort {
  const base = createCompanyPort()
  return {
    ...base,
    async create() {
      throw new Error('boom')
    },
  }
}

describe('Phase 1 write flow', () => {
  it('creates a company through the facade and emits an audit event', async () => {
    const sink = noopSink()
    const audit = createAuditService(sink)
    const store = createCompanyPort()
    const facade = new CompanyFacade(store, audit)

    const company = await facade.createCompany(
      {
        name: 'NewCo',
        industry: 'AI',
        region: 'NA',
        status: 'ACTIVE',
        ownerId: 'user-9',
      },
      { actorId: 'user-9', requestId: 'req-1' },
    )

    expect(company.id).toBeTruthy()
    expect(company.name).toBe('NewCo')
    expect(sink.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'company.created', entityType: 'company' }),
    )
  })

  it('creates contact, lead, activity, and task entries', async () => {
    const audit = createAuditService()

    const contactStore: ContactReadPort = {
      async findById(_id) {
        return null
      },
      async list() {
        return { data: [], total: 0 }
      },
      async listByCompany() {
        return { data: [], total: 0 }
      },
      async create(input) {
        return { ...(input as any), id: 'contact-1', createdAt: new Date(), updatedAt: new Date() }
      },
      async update(id, input) {
        return { ...(input as any), id, createdAt: new Date(), updatedAt: new Date() }
      },
      async delete(_id) {
        return true
      },
    }
    const leadStore: LeadReadPort = {
      async findById(_id) {
        return null
      },
      async list() {
        return { data: [], total: 0 }
      },
      async listByCompany() {
        return { data: [], total: 0 }
      },
      async create(input) {
        return { ...(input as any), id: 'lead-1', createdAt: new Date(), updatedAt: new Date() }
      },
      async update(id, input) {
        return { ...(input as any), id, createdAt: new Date(), updatedAt: new Date() }
      },
      async delete(_id) {
        return true
      },
    }
    const activityStore: ActivityReadPort = {
      async findById(_id) {
        return null
      },
      async list() {
        return { data: [], total: 0 }
      },
      async listByCompany() {
        return { data: [], total: 0 }
      },
      async create(input) {
        return { ...(input as any), id: 'activity-1', createdAt: new Date() }
      },
      async update(id, input) {
        return { ...(input as any), id, createdAt: new Date() }
      },
      async delete(_id) {
        return true
      },
    }
    const taskStore: TaskReadPort = {
      async findById(_id) {
        return null
      },
      async list() {
        return { data: [], total: 0 }
      },
      async listByCompany() {
        return { data: [], total: 0 }
      },
      async create(input) {
        return { ...(input as any), id: 'task-1', createdAt: new Date(), updatedAt: new Date() }
      },
      async update(id, input) {
        return { ...(input as any), id, createdAt: new Date(), updatedAt: new Date() }
      },
      async delete(_id) {
        return true
      },
    }

    const meta = {
      actorId: 'user-9',
      requestId: 'req-1',
      actor: { id: 'user-9', roles: ['admin'] as string[] },
    }
    const companyStore = createCompanyPort()
    const contactFacade = new ContactFacade(contactStore, audit, companyStore)
    const leadFacade = new LeadFacade(leadStore, audit)
    const activityFacade = new ActivityFacade(activityStore, audit, companyStore)
    const taskFacade = new TaskFacade(taskStore, audit, companyStore)

    const contact = await contactFacade.createContact(
      {
        companyId: 'company-1',
        fullName: 'Nina Chen',
        email: 'nina@example.com',
        role: 'PM',
        status: 'ACTIVE',
      },
      meta,
    )

    const lead = await leadFacade.createLead(
      {
        companyId: 'company-1',
        source: 'Referral',
        status: 'NEW',
        ownerId: 'user-9',
        score: 70,
      },
      meta,
    )

    const activity = await activityFacade.createActivity(
      {
        companyId: 'company-1',
        type: 'MEETING',
        channel: 'video',
        summary: 'Stakeholder sync',
        occurredAt: new Date('2026-09-15T09:00:00.000Z'),
        ownerId: 'user-9',
      },
      meta,
    )

    const task = await taskFacade.createTask(
      {
        companyId: 'company-1',
        assigneeId: 'user-9',
        subject: 'Validate follow-up notes',
        dueAt: new Date('2026-09-16T09:00:00.000Z'),
        status: 'OPEN',
      },
      meta,
    )

    expect(contact.id).toBeTruthy()
    expect(lead.id).toBeTruthy()
    expect(activity.id).toBeTruthy()
    expect(task.id).toBeTruthy()
  })

  it('updates and deletes a company through the facade with audit', async () => {
    const sink = noopSink()
    const audit = createAuditService(sink)
    const store = createCompanyPort()
    const facade = new CompanyFacade(store, audit)

    const created = await facade.createCompany(
      {
        name: 'Acme Corp',
        industry: 'Retail',
        region: 'LATAM',
        status: 'ACTIVE',
        ownerId: 'user-10',
      },
      { actorId: 'user-10', requestId: 'req-2' },
    )

    const updated = await facade.updateCompany(
      created.id,
      { name: 'Acme Corp Updated', status: 'INACTIVE' },
      { actorId: 'user-10', requestId: 'req-2' },
    )

    expect(updated).not.toBeNull()
    expect(updated?.name).toBe('Acme Corp Updated')
    expect(updated?.status).toBe('INACTIVE')

    const deleted = await facade.deleteCompany(created.id, { actorId: 'user-10', requestId: 'req-2' })

    expect(deleted).toBe(true)
    expect(await facade.getCompany(created.id)).toBeNull()
    expect(sink.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'company.deleted' }))
  })

  it('records a user with the user facade', async () => {
    const sink = noopSink()
    const audit = createAuditService(sink)
    const userStore: UserReadPort = {
      async findById(_id) {
        return null
      },
      async findByEmail(_email) {
        return null
      },
      async list() {
        return []
      },
      async create(input) {
        return { ...(input as any), id: 'user-1', createdAt: new Date(), updatedAt: new Date() }
      },
      async update(id, input) {
        return { ...(input as any), id, createdAt: new Date(), updatedAt: new Date() }
      },
      async delete(_id) {
        return true
      },
    }

    const facade = new UserFacade(userStore, audit)
    const user = await facade.createUser(
      { email: 'a@b.com', name: 'Alice', roles: ['MEMBER'], status: 'ACTIVE' },
      { actorId: 'admin-1', requestId: 'req-3' },
    )

    expect(user.id).toBeTruthy()
    expect(sink.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.created' }))
  })

  it('propagates write failures without emitting success audit events', async () => {
    const sink = noopSink()
    const audit = createAuditService(sink)
    const store = createControllablePort()
    const facade = new CompanyFacade(store, audit)

    await expect(
      facade.createCompany(
        { name: 'x', status: 'ACTIVE' },
        { actorId: 'user-1', requestId: 'req-4' },
      ),
    ).rejects.toThrow('boom')
  })
})