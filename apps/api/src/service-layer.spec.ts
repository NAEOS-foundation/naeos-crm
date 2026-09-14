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
  PipelineStageFacade,
  OpportunityFacade,
  CampaignFacade,
  CampaignStepFacade,
  FollowUpFacade,
  PipelineAnalyticsFacade,
} from './service-layer'
import type {
  ActivityReadPort,
  CompanyReadPort,
  ContactReadPort,
  LeadReadPort,
  TaskReadPort,
  UserReadPort,
  PipelineStageReadPort,
  OpportunityReadPort,
  CampaignReadPort,
  CampaignStepReadPort,
  FollowUpReadPort,
  PipelineAnalyticsReadPort,
} from './domain-interfaces'
import type {
  Company,
  PipelineStage,
  Opportunity,
  Campaign,
  CampaignStep,
  FollowUp,
  PipelineAnalyticsSummary,
} from '@naeos-crm/domain'

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

function createPipelineStagePort(): PipelineStageReadPort & { storage: PipelineStage[] } {
  const storage: PipelineStage[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((s) => s.id === id) ?? null
    },
    async list() {
      return { data: [...storage], total: storage.length }
    },
    async create(input) {
      const stage: PipelineStage = {
        ...input,
        id: `stage-${storage.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      storage.push(stage)
      return stage
    },
    async update(id, input) {
      const index = storage.findIndex((s) => s.id === id)
      if (index === -1) return null
      storage[index] = { ...storage[index], ...input, updatedAt: new Date() }
      return storage[index]
    },
    async delete(id) {
      const index = storage.findIndex((s) => s.id === id)
      if (index === -1) return false
      storage.splice(index, 1)
      return true
    },
    async reorder(orderedIds) {
      const byId = new Map(storage.map((s) => [s.id, s]))
      const reordered = orderedIds.map((id, sequence) => {
        const stage = byId.get(id)
        if (!stage) throw new Error(`Missing stage ${id}`)
        return { ...stage, sequence }
      })
      return reordered
    },
  }
}

function createOpportunityPort(): OpportunityReadPort & { storage: Opportunity[] } {
  const storage: Opportunity[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((o) => o.id === id) ?? null
    },
    async list(params) {
      let result = [...storage]
      if (params?.stage) result = result.filter((o) => o.stage === params.stage)
      if (params?.companyId) result = result.filter((o) => o.companyId === params.companyId)
      if (params?.ownerId) result = result.filter((o) => o.ownerId === params.ownerId)
      return { data: result, total: result.length }
    },
    async listByCompany(companyId) {
      return { data: storage.filter((o) => o.companyId === companyId), total: storage.filter((o) => o.companyId === companyId).length }
    },
    async listByOwner(ownerId) {
      return { data: storage.filter((o) => o.ownerId === ownerId), total: storage.filter((o) => o.ownerId === ownerId).length }
    },
    async create(input) {
      const opportunity: Opportunity = {
        ...input,
        id: `opp-${storage.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      storage.push(opportunity)
      return opportunity
    },
    async update(id, input) {
      const index = storage.findIndex((o) => o.id === id)
      if (index === -1) return null
      storage[index] = { ...storage[index], ...input, updatedAt: new Date() }
      return storage[index]
    },
    async delete(id) {
      const index = storage.findIndex((o) => o.id === id)
      if (index === -1) return false
      storage.splice(index, 1)
      return true
    },
  }
}

function createCampaignPort(): CampaignReadPort & { storage: Campaign[] } {
  const storage: Campaign[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((c) => c.id === id) ?? null
    },
    async list(params) {
      let result = [...storage]
      if (params?.status) result = result.filter((c) => c.status === params.status)
      if (params?.type) result = result.filter((c) => c.type === params.type)
      if (params?.ownerId) result = result.filter((c) => c.ownerId === params.ownerId)
      return { data: result, total: result.length }
    },
    async listByOwner(ownerId) {
      return { data: storage.filter((c) => c.ownerId === ownerId), total: storage.filter((c) => c.ownerId === ownerId).length }
    },
    async create(input) {
      const campaign: Campaign = {
        ...input,
        id: `campaign-${storage.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      storage.push(campaign)
      return campaign
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

function createCampaignStepPort(): CampaignStepReadPort & { storage: CampaignStep[] } {
  const storage: CampaignStep[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((s) => s.id === id) ?? null
    },
    async listByCampaign(campaignId) {
      const steps = storage.filter((s) => s.campaignId === campaignId)
      return { data: steps, total: steps.length }
    },
    async create(input) {
      const step: CampaignStep = {
        ...input,
        id: `step-${storage.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      storage.push(step)
      return step
    },
    async update(id, input) {
      const index = storage.findIndex((s) => s.id === id)
      if (index === -1) return null
      storage[index] = { ...storage[index], ...input, updatedAt: new Date() }
      return storage[index]
    },
    async delete(id) {
      const index = storage.findIndex((s) => s.id === id)
      if (index === -1) return false
      storage.splice(index, 1)
      return true
    },
  }
}

function createFollowUpPort(): FollowUpReadPort & { storage: FollowUp[] } {
  const storage: FollowUp[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((f) => f.id === id) ?? null
    },
    async list(params) {
      let result = [...storage]
      if (params?.status) result = result.filter((f) => f.status === params.status)
      if (params?.ownerId) result = result.filter((f) => f.ownerId === params.ownerId)
      return { data: result, total: result.length }
    },
    async listByActivity(activityId) {
      return { data: storage.filter((f) => f.activityId === activityId), total: storage.filter((f) => f.activityId === activityId).length }
    },
    async listByOwner(ownerId) {
      return { data: storage.filter((f) => f.ownerId === ownerId), total: storage.filter((f) => f.ownerId === ownerId).length }
    },
    async create(input) {
      const followUp: FollowUp = {
        ...input,
        id: `followup-${storage.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      storage.push(followUp)
      return followUp
    },
    async update(id, input) {
      const index = storage.findIndex((f) => f.id === id)
      if (index === -1) return null
      storage[index] = { ...storage[index], ...input, updatedAt: new Date() }
      return storage[index]
    },
    async delete(id) {
      const index = storage.findIndex((f) => f.id === id)
      if (index === -1) return false
      storage.splice(index, 1)
      return true
    },
  }
}

function createAnalyticsPort(summary: PipelineAnalyticsSummary): PipelineAnalyticsReadPort {
  return {
    async getPipelineAnalytics() {
      return summary
    },
    async getCampaignAnalytics() {
      return { total: 1, byStatus: { ACTIVE: 1, DRAFT: 0, PAUSED: 0, COMPLETED: 0, ARCHIVED: 0 }, stepsPrepared: 0 }
    },
    async getFollowUpAnalytics() {
      return { openCount: 1, overdueCount: 0, dueTodayCount: 0 }
    },
  }
}

describe('Phase 2 pipeline and campaign write flow', () => {
  const adminMeta = {
    actorId: 'user-9',
    requestId: 'req-p2-1',
    actor: { id: 'user-9', roles: ['admin'] as string[] },
  }

  it('creates a pipeline stage and an opportunity, then records stage-changed events', async () => {
    const sink = noopSink()
    const audit = createAuditService(sink)
    const stageStore = createPipelineStagePort()
    const stageFacade = new PipelineStageFacade(stageStore, audit)

    const stage = await stageFacade.createStage(
      {
        stage: 'PROPOSAL',
        name: 'Proposal',
        sequence: 2,
        probability: 50,
      },
      adminMeta,
    )
    expect(stage.id).toBeTruthy()
    expect(sink.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'pipeline-stage.created' }))

    const companyStore = createCompanyPort()
    const oppStore = createOpportunityPort()
    const oppFacade = new OpportunityFacade(oppStore, audit, companyStore)

    const created = await oppFacade.createOpportunity(
      {
        companyId: 'company-1',
        name: 'Enterprise deal',
        stage: 'PROPOSAL',
        amount: 120000,
        closeDate: new Date('2026-12-31T00:00:00.000Z'),
        ownerId: 'user-9',
      },
      adminMeta,
    )
    expect(created.amount).toBe(120000)
    expect(sink.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'opportunity.created' }))

    const updated = await oppFacade.updateOpportunity(
      created.id,
      { stage: 'WON' },
      adminMeta,
    )
    expect(updated?.stage).toBe('WON')
    expect(sink.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'opportunity.stage-changed' }))
  })

  it('reorders pipeline stages through the facade', async () => {
    const audit = createAuditService()
    const store = createPipelineStagePort()
    const facade = new PipelineStageFacade(store, audit)

    const first = await facade.createStage({ stage: 'NEW', name: 'New', sequence: 0, probability: 10 }, adminMeta)
    const second = await facade.createStage({ stage: 'WON', name: 'Won', sequence: 1, probability: 100 }, adminMeta)

    const reordered = await facade.reorderStages([second.id, first.id], adminMeta)
    expect(reordered.map((s: { sequence: number }) => s.sequence)).toEqual([0, 1])
  })

  it('creates a campaign with nested steps and follow-ups', async () => {
    const sink = noopSink()
    const audit = createAuditService(sink)
    const campaignStore = createCampaignPort()
    const campaignFacade = new CampaignFacade(campaignStore, audit)

    const campaign = await campaignFacade.createCampaign(
      { name: 'Q4 Outbound', type: 'OUTBOUND', status: 'DRAFT', ownerId: 'user-9' },
      adminMeta,
    )
    expect(campaign.id).toBeTruthy()
    expect(sink.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'campaign.created' }))

    const stepStore = createCampaignStepPort()
    const stepFacade = new CampaignStepFacade(stepStore, campaignStore, audit)
    const step = await stepFacade.createStep(
      {
        campaignId: campaign.id,
        sequence: 1,
        actionType: 'EMAIL',
        subject: 'Intro email',
        status: 'PENDING',
      },
      adminMeta,
    )
    expect(step.id).toBeTruthy()
    expect(sink.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'campaign-step.created' }))

    const activityStore: ActivityReadPort = {
      async findById(id) {
        return id === 'activity-1'
          ? {
              id: 'activity-1',
              companyId: 'company-1',
              type: 'CALL',
              channel: 'phone',
              summary: 'Intro',
              occurredAt: new Date(),
              createdAt: new Date(),
            }
          : null
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
    const companyStore = createCompanyPort()
    const followUpStore = createFollowUpPort()
    const followUpFacade = new FollowUpFacade(followUpStore, audit, activityStore, companyStore)

    const followUp = await followUpFacade.createFollowUp(
      {
        activityId: 'activity-1',
        dueAt: new Date('2026-09-20T09:00:00.000Z'),
        status: 'OPEN',
        ownerId: 'user-9',
        notes: 'Circle back after review',
      },
      adminMeta,
    )
    expect(followUp.id).toBeTruthy()
    expect(followUp.status).toBe('OPEN')
    expect(sink.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'follow-up.created' }))
  })

  it('blocks members from creating follow-ups for companies they do not own', async () => {
    const audit = createAuditService()
    const activityStore: ActivityReadPort = {
      async findById() {
        return {
          id: 'activity-x',
          companyId: 'company-other',
          type: 'CALL',
          channel: 'phone',
          summary: 'x',
          occurredAt: new Date(),
          createdAt: new Date(),
        }
      },
      async list() {
        return { data: [], total: 0 }
      },
      async listByCompany() {
        return { data: [], total: 0 }
      },
      async create(input) {
        return { ...(input as any), id: 'activity-x', createdAt: new Date() }
      },
      async update(id, input) {
        return { ...(input as any), id, createdAt: new Date() }
      },
      async delete(_id) {
        return true
      },
    }
    const companyStore = createCompanyPort()
    companyStore.storage.push({
      id: 'company-other',
      name: 'Other Co',
      status: 'ACTIVE',
      ownerId: 'user-owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const followUpStore = createFollowUpPort()
    const followUpFacade = new FollowUpFacade(followUpStore, audit, activityStore, companyStore)
    const memberMeta = {
      actorId: 'user-member',
      requestId: 'req-p2-2',
      actor: { id: 'user-member', roles: ['member'] as string[] },
    }

    await expect(
      followUpFacade.createFollowUp(
        { activityId: 'activity-x', dueAt: new Date(), status: 'OPEN' },
        memberMeta,
      ),
    ).rejects.toThrow(/access/i)
  })

  it('computes pipeline, campaign, and follow-up analytics', async () => {
    const summary: PipelineAnalyticsSummary = {
      totalValue: 250000,
      weightedValue: 130000,
      openCount: 5,
      wonCount: 2,
      lostCount: 1,
      avgDealSize: 50000,
      byStage: [
        { stage: 'PROPOSAL', count: 2, amount: 100000, weightedAmount: 50000 },
        { stage: 'WON', count: 2, amount: 150000, weightedAmount: 150000 },
      ],
    }
    const facade = new PipelineAnalyticsFacade(createAnalyticsPort(summary))

    const pipeline = await facade.getPipelineAnalytics()
    expect(pipeline.totalValue).toBe(250000)
    expect(pipeline.byStage).toHaveLength(2)

    const campaigns = await facade.getCampaignAnalytics()
    expect(campaigns.total).toBe(1)
    expect(campaigns.byStatus.ACTIVE).toBe(1)

    const followUps = await facade.getFollowUpAnalytics()
    expect(followUps.overdueCount).toBe(0)
  })
})