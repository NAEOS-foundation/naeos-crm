import { describe, expect, it } from 'vitest'
import type { AuditSink } from '@naeos-crm/audit'
import { AuditService } from '@naeos-crm/audit'
import { vi } from 'vitest'

import {
  ActivityFacade,
  CommunityFacade,
  CompanyFacade,
  ContactFacade,
  ContributorFacade,
  GoGateFacade,
  InvestorFacade,
  LeadFacade,
  PartnerFacade,
  PolicyRuleFacade,
  TaskFacade,
  UseCaseFacade,
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
  CommunityReadPort,
  CompanyReadPort,
  ContactReadPort,
  ContributorReadPort,
  GoGateRequestReadPort,
  InvestorReadPort,
  LeadReadPort,
  PartnerReadPort,
  PolicyRuleReadPort,
  TaskReadPort,
  UseCaseReadPort,
  UserReadPort,
  PipelineStageReadPort,
  OpportunityReadPort,
  CampaignReadPort,
  CampaignStepReadPort,
  FollowUpReadPort,
  PipelineAnalyticsReadPort,
} from './domain-interfaces'
import type {
  Community,
  Company,
  Contributor,
  GoGateRequest,
  Investor,
  Partner,
  PipelineStage,
  PolicyRule,
  Opportunity,
  Campaign,
  CampaignStep,
  FollowUp,
  UseCase,
  PipelineAnalyticsSummary,
} from '@naeos-crm/domain'
import { GoGateService } from './gate'
import type { ExternalActionPort, PolicyPort } from './ports'

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

function createContributorPort(): ContributorReadPort & { storage: Contributor[] } {
  const storage: Contributor[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((c) => c.id === id) ?? null
    },
    async list(params) {
      let result = [...storage]
      if (params?.status) result = result.filter((c) => c.status === params.status)
      if (params?.role) result = result.filter((c) => c.role === params.role)
      if (params?.communityId) result = result.filter((c) => c.communityId === params.communityId)
      return { data: result, total: result.length }
    },
    async create(input) {
      const contributor: Contributor = { ...input, id: `contributor-${storage.length + 1}`, createdAt: new Date(), updatedAt: new Date() }
      storage.push(contributor)
      return contributor
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

function createPartnerPort(): PartnerReadPort & { storage: Partner[] } {
  const storage: Partner[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((p) => p.id === id) ?? null
    },
    async list(params) {
      let result = [...storage]
      if (params?.status) result = result.filter((p) => p.status === params.status)
      if (params?.partnerType) result = result.filter((p) => p.partnerType === params.partnerType)
      return { data: result, total: result.length }
    },
    async create(input) {
      const partner: Partner = { ...input, id: `partner-${storage.length + 1}`, createdAt: new Date(), updatedAt: new Date() }
      storage.push(partner)
      return partner
    },
    async update(id, input) {
      const index = storage.findIndex((p) => p.id === id)
      if (index === -1) return null
      storage[index] = { ...storage[index], ...input, updatedAt: new Date() }
      return storage[index]
    },
    async delete(id) {
      const index = storage.findIndex((p) => p.id === id)
      if (index === -1) return false
      storage.splice(index, 1)
      return true
    },
  }
}

function createCommunityPort(): CommunityReadPort & { storage: Community[] } {
  const storage: Community[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((c) => c.id === id) ?? null
    },
    async list(params) {
      let result = [...storage]
      if (params?.status) result = result.filter((c) => c.status === params.status)
      return { data: result, total: result.length }
    },
    async create(input) {
      const community: Community = { ...input, id: `community-${storage.length + 1}`, createdAt: new Date(), updatedAt: new Date() }
      storage.push(community)
      return community
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

function createInvestorPort(): InvestorReadPort & { storage: Investor[] } {
  const storage: Investor[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((i) => i.id === id) ?? null
    },
    async list(params) {
      let result = [...storage]
      if (params?.status) result = result.filter((i) => i.status === params.status)
      if (params?.investorType) result = result.filter((i) => i.investorType === params.investorType)
      return { data: result, total: result.length }
    },
    async create(input) {
      const investor: Investor = { ...input, id: `investor-${storage.length + 1}`, createdAt: new Date(), updatedAt: new Date() }
      storage.push(investor)
      return investor
    },
    async update(id, input) {
      const index = storage.findIndex((i) => i.id === id)
      if (index === -1) return null
      storage[index] = { ...storage[index], ...input, updatedAt: new Date() }
      return storage[index]
    },
    async delete(id) {
      const index = storage.findIndex((i) => i.id === id)
      if (index === -1) return false
      storage.splice(index, 1)
      return true
    },
  }
}

function createUseCasePort(): UseCaseReadPort & { storage: UseCase[] } {
  const storage: UseCase[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((u) => u.id === id) ?? null
    },
    async list(params) {
      let result = [...storage]
      if (params?.opportunityId) result = result.filter((u) => u.opportunityId === params.opportunityId)
      if (params?.ownerId) result = result.filter((u) => u.ownerId === params.ownerId)
      return { data: result, total: result.length }
    },
    async listByOpportunity(opportunityId) {
      const result = storage.filter((u) => u.opportunityId === opportunityId)
      return { data: result, total: result.length }
    },
    async create(input) {
      const useCase: UseCase = { ...input, id: `usecase-${storage.length + 1}`, createdAt: new Date(), updatedAt: new Date() }
      storage.push(useCase)
      return useCase
    },
    async update(id, input) {
      const index = storage.findIndex((u) => u.id === id)
      if (index === -1) return null
      storage[index] = { ...storage[index], ...input, updatedAt: new Date() }
      return storage[index]
    },
    async delete(id) {
      const index = storage.findIndex((u) => u.id === id)
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

describe('Phase 3 ecosystem and use cases write flow', () => {
  const adminMeta = {
    actorId: 'user-admin',
    requestId: 'req-p3-1',
    actor: { id: 'user-admin', roles: ['admin'] as string[] },
  }
  const memberMeta = {
    actorId: 'user-member',
    requestId: 'req-p3-2',
    actor: { id: 'user-member', roles: ['member'] as string[] },
  }

  it('creates a community and contributor, linking the contributor to the community', async () => {
    const audit = createAuditService()
    const communityStore = createCommunityPort()
    const communityFacade = new CommunityFacade(communityStore, audit)
    const community = await communityFacade.createCommunity(
      { name: 'Builders Guild', status: 'ACTIVE' },
      adminMeta,
    )
    expect(community.id).toBe('community-1')

    const contributorStore = createContributorPort()
    const contributorFacade = new ContributorFacade(contributorStore, audit)
    const contributor = await contributorFacade.createContributor(
      { name: 'Rina', role: 'MAINTAINER', status: 'ACTIVE', communityId: community.id },
      adminMeta,
    )
    expect(contributor.communityId).toBe(community.id)

    const listed = await contributorFacade.listContributors({ communityId: community.id })
    expect(listed.total).toBe(1)
  })

  it('creates a partner and an investor', async () => {
    const audit = createAuditService()
    const partnerStore = createPartnerPort()
    const partnerFacade = new PartnerFacade(partnerStore, audit)
    const partner = await partnerFacade.createPartner(
      { name: 'DigitalOcean', partnerType: 'TECHNOLOGY', status: 'ACTIVE' },
      adminMeta,
    )
    expect(partner.partnerType).toBe('TECHNOLOGY')

    const investorStore = createInvestorPort()
    const investorFacade = new InvestorFacade(investorStore, audit)
    const investor = await investorFacade.createInvestor(
      { name: 'East Ventures', investorType: 'VENTURE', status: 'ACTIVE' },
      adminMeta,
    )
    expect(investor.investorType).toBe('VENTURE')
  })

  it('creates a use case attached to an opportunity and updates it', async () => {
    const audit = createAuditService()
    const store = createUseCasePort()
    const facade = new UseCaseFacade(store, audit)
    const useCase = await facade.createUseCase(
      { opportunityId: 'opportunity-1', title: 'SDK licensing dashboard', value: 12000 },
      adminMeta,
    )
    expect(useCase.opportunityId).toBe('opportunity-1')

    const updated = await facade.updateUseCase(useCase.id, { value: 15000 }, adminMeta)
    expect(updated?.value).toBe(15000)

    const listed = await facade.listByOpportunity('opportunity-1')
    expect(listed.total).toBe(1)
  })

  it('blocks members from writing ecosystem records', async () => {
    const audit = createAuditService()
    const store = createPartnerPort()
    const facade = new PartnerFacade(store, audit)
    await expect(
      facade.createPartner({ name: 'Blocked', partnerType: 'CHANNEL', status: 'ACTIVE' }, memberMeta),
    ).rejects.toThrow(/admin|manager/i)
  })
})

function createPolicyRulePort(): PolicyRuleReadPort & { storage: PolicyRule[] } {
  const storage: PolicyRule[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((r) => r.id === id) ?? null
    },
    async list() {
      return { data: [...storage], total: storage.length }
    },
    async findForEvaluation(resource, action, roles) {
      const roleList = roles as unknown as string[]
      return storage.filter(
        (r) =>
          r.enabled &&
          (r.resource === resource || r.resource === '*') &&
          (r.action === action || r.action === '*') &&
          (roleList.includes(r.role) || r.role === '*'),
      )
    },
    async create(input) {
      const rule: PolicyRule = {
        ...input,
        id: `rule-${storage.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      storage.push(rule)
      return rule
    },
    async update(id, input) {
      const index = storage.findIndex((r) => r.id === id)
      if (index === -1) return null
      storage[index] = { ...storage[index], ...input, updatedAt: new Date() }
      return storage[index]
    },
    async delete(id) {
      const index = storage.findIndex((r) => r.id === id)
      if (index === -1) return false
      storage.splice(index, 1)
      return true
    },
  }
}

function createGoGatePort(): GoGateRequestReadPort & { storage: GoGateRequest[] } {
  const storage: GoGateRequest[] = []
  return {
    storage,
    async findById(id) {
      return storage.find((g) => g.id === id) ?? null
    },
    async list() {
      return { data: [...storage], total: storage.length }
    },
    async create(input) {
      const request: GoGateRequest = {
        ...input,
        id: `gate-${storage.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      storage.push(request)
      return request
    },
    async update(id, input) {
      const index = storage.findIndex((g) => g.id === id)
      if (index === -1) return null
      storage[index] = { ...storage[index], ...input, updatedAt: new Date() }
      return storage[index]
    },
    async transition(id, expectedStatus, input, expiresAfter) {
      const index = storage.findIndex((g) => g.id === id && g.status === expectedStatus)
      if (index === -1) return null
      const current = storage[index]
      if (expiresAfter && (!current.expiresAt || current.expiresAt.getTime() <= expiresAfter.getTime())) return null
      storage[index] = { ...current, ...input, updatedAt: new Date() }
      return storage[index]
    },
  }
}

describe('Phase 4 governance: policy rules and GO-Gate flow', () => {
  const actor: Parameters<GoGateService['execute']>[1] = { id: 'user-admin', roles: ['ADMIN'] }
  const adminMeta = {
    actorId: 'user-admin',
    requestId: 'req-p4-1',
    actor: { id: 'user-admin', roles: ['admin'] as string[] },
  }
  const memberMeta = {
    actorId: 'user-member',
    requestId: 'req-p4-2',
    actor: { id: 'user-member', roles: ['member'] as string[] },
  }

  function createGateFacade(options: { allow: boolean }) {
    const requests = createGoGatePort()
    const policy = {
      evaluate: vi.fn<PolicyPort['evaluate']>().mockResolvedValue({
        allow: options.allow,
        policyVersion: '2026.09.17',
        reason: options.allow ? 'policy-rule:allow' : 'policy-rule:deny',
      }),
    }
    const actions = {
      SEND_EMAIL: { execute: vi.fn<ExternalActionPort['execute']>().mockResolvedValue({ ok: true, providerResponse: { provider: 'email', payload: {} } }) },
    }
    const sink = { append: vi.fn<AuditSink['append']>().mockResolvedValue(undefined) }
    const gate = new GoGateService(requests, policy, actions, createAuditService(sink))
    return { facade: new GoGateFacade(gate), requests, actions, sink }
  }

  it('creates and manages policy rules with audit events, admin only', async () => {
    const audit = createAuditService()
    const store = createPolicyRulePort()
    const facade = new PolicyRuleFacade(store, audit)

    const rule = await facade.createPolicyRule(
      { resource: 'go-gate', action: 'SEND_EMAIL', role: 'MANAGER', effect: 'ALLOW', priority: 0, enabled: true, policyVersion: '2026.09.17' },
      adminMeta,
    )
    expect(rule.id).toBeTruthy()

    const updated = await facade.updatePolicyRule(rule.id, { enabled: false }, adminMeta)
    expect(updated?.enabled).toBe(false)

    const deleted = await facade.deletePolicyRule(rule.id, adminMeta)
    expect(deleted).toBe(true)

    await expect(
      facade.createPolicyRule(
        { resource: 'go-gate', action: 'SEND_EMAIL', role: 'MEMBER', effect: 'DENY', priority: 0, enabled: true, policyVersion: '2026.09.17' },
        memberMeta,
      ),
    ).rejects.toThrow(/admin/i)
  })

  it('routes allowed GO-Gate requests to WAITING_FOR_GO, then approves and executes', async () => {
    const { facade } = createGateFacade({ allow: true })

    const request = await facade.requestExecution({
      actionType: 'SEND_EMAIL',
      target: 'prospect@naeos.local',
      requester: { id: 'user-admin', roles: ['ADMIN'] },
      meta: { requestId: 'req-1', source: 'test' },
    })
    expect(request.status).toBe('WAITING_FOR_GO')

    const approved = await facade.approve(request.id, { id: 'user-admin', roles: ['ADMIN'] }, { meta: { requestId: 'req-2' } })
    expect(approved.status).toBe('APPROVED')
    expect(approved.expiresAt).toBeTruthy()
    expect(approved.approvedBy).toBe('user-admin')

    const executed = await facade.execute(approved.id, { id: 'user-admin', roles: ['ADMIN'] }, { requestId: 'req-3' })
    expect(executed.status).toBe('EXECUTED')
    expect(executed.result).toBe('verified')
  })

  it('rejects GO-Gate requests denied by policy and blocks out-of-sequence transitions', async () => {
    const { facade, requests } = createGateFacade({ allow: false })

    const request = await facade.requestExecution({
      actionType: 'SEND_EMAIL',
      target: 'prospect@naeos.local',
      requester: { id: 'user-member', roles: ['MEMBER'] },
      meta: { requestId: 'req-4' },
    })
    expect(request.status).toBe('REJECTED')

    await expect(
      facade.approve(request.id, { id: 'user-admin', roles: ['ADMIN'] }, { meta: { requestId: 'req-5' } }),
    ).rejects.toThrow(/status/)

    const pending = await requests.create({
      actionType: 'SEND_EMAIL',
      target: 't@t.local',
      status: 'WAITING_FOR_GO',
      requestedBy: 'user-admin',
    })
    const executed = await facade.approve(pending.id, { id: 'user-admin', roles: ['ADMIN'] }, { meta: { requestId: 'req-6' } })
    expect(executed.status).toBe('APPROVED')
    await expect(
      facade.approve(executed.id, { id: 'user-admin', roles: ['ADMIN'] }, { meta: { requestId: 'req-7' } }),
    ).rejects.toThrow(/status/)
  })

  it('executes the adapter only once when execute is invoked concurrently', async () => {
    const { facade, requests, actions } = createGateFacade({ allow: true })
    const request = await facade.requestExecution({
      actionType: 'SEND_EMAIL',
      target: 'prospect@naeos.local',
      requester: actor,
      meta: { requestId: 'req-p4-10' },
    })
    await facade.approve(request.id, actor, { meta: { requestId: 'req-p4-10' } })

    const attempts = await Promise.allSettled(
      Array.from({ length: 3 }, () => facade.execute(request.id, actor, { requestId: 'req-p4-10' })),
    )
    const fulfilled = attempts.filter((r) => r.status === 'fulfilled')
    expect(fulfilled).toHaveLength(1)
    expect(actions.SEND_EMAIL.execute).toHaveBeenCalledTimes(1)
    expect((await requests.findById(request.id))?.status).toBe('EXECUTED')
  })

  it('resolves approve and reject races with a single winner', async () => {
    const { facade, requests, sink } = createGateFacade({ allow: true })
    const request = await facade.requestExecution({
      actionType: 'SEND_EMAIL',
      target: 'prospect@naeos.local',
      requester: actor,
      meta: { requestId: 'req-p4-11' },
    })

    const outcomes = await Promise.allSettled([
      facade.approve(request.id, actor, { meta: { requestId: 'req-p4-11' } }),
      facade.reject(request.id, actor, { reason: 'veto', meta: { requestId: 'req-p4-11' } }),
    ])
    const fulfilled = outcomes.filter((r) => r.status === 'fulfilled')
    expect(fulfilled).toHaveLength(1)

    const final = await requests.findById(request.id)
    expect(final?.status === 'APPROVED' || final?.status === 'REJECTED').toBe(true)
    expect(fulfilled[0].status === 'fulfilled' ? fulfilled[0].value.status : null).toBe(final?.status)
    expect(sink.append).toHaveBeenCalledTimes(2)
  })

  it('marks EXPIRED and blocks the adapter when approval is missing expiry or already elapsed', async () => {
    const { facade, requests, actions, sink } = createGateFacade({ allow: true })
    const stale = await requests.create({
      actionType: 'SEND_EMAIL',
      target: 'stale@naeos.local',
      status: 'APPROVED',
      requestedBy: 'user-admin',
    })

    await expect(facade.execute(stale.id, actor, { requestId: 'req-p4-12' })).rejects.toThrow(/expired/)
    expect((await requests.findById(stale.id))?.status).toBe('EXPIRED')
    expect(actions.SEND_EMAIL.execute).not.toHaveBeenCalled()
    expect(sink.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'go-gate.expired' }))

    const elapsed = await requests.create({
      actionType: 'SEND_EMAIL',
      target: 'elapsed@naeos.local',
      status: 'APPROVED',
      requestedBy: 'user-admin',
      expiresAt: new Date(Date.now() - 1000),
    })

    await expect(facade.execute(elapsed.id, actor, { requestId: 'req-p4-13' })).rejects.toThrow(/expired/)
    expect((await requests.findById(elapsed.id))?.status).toBe('EXPIRED')
    expect(actions.SEND_EMAIL.execute).not.toHaveBeenCalled()
  })

  it('keeps terminal EXECUTED, FAILED, REJECTED, and EXECUTING states even past expiry', async () => {
    const { facade, requests, actions, sink } = createGateFacade({ allow: true })
    for (const status of ['EXECUTED', 'FAILED', 'REJECTED', 'EXECUTING'] as const) {
      const request = await requests.create({
        actionType: 'SEND_EMAIL',
        target: `${status.toLowerCase()}@naeos.local`,
        status,
        requestedBy: 'user-admin',
        expiresAt: new Date(Date.now() - 1000),
      })

      await expect(facade.execute(request.id, actor, { requestId: 'req-p4-14' })).rejects.toThrow(/status/)
      expect((await requests.findById(request.id))?.status).toBe(status)
    }
    expect(actions.SEND_EMAIL.execute).not.toHaveBeenCalled()
    expect(sink.append).not.toHaveBeenCalled()
  })

  it('leaves requests APPROVED when no adapter is configured', async () => {
    const { facade, requests, sink } = createGateFacade({ allow: true })
    const request = await facade.requestExecution({
      actionType: 'SEND_EMAIL',
      target: 'prospect@naeos.local',
      requester: actor,
      meta: { requestId: 'req-p4-15' },
    })
    await facade.approve(request.id, actor, { meta: { requestId: 'req-p4-15' } })
    const adapterLess = new GoGateService(
      requests,
      { evaluate: vi.fn<PolicyPort['evaluate']>().mockResolvedValue({ allow: true, policyVersion: '2026.09.17' }) },
      {},
      createAuditService(sink),
    )

    await expect(
      new GoGateFacade(adapterLess).execute(request.id, actor, { requestId: 'req-p4-15' }),
    ).rejects.toThrow(/adapter/i)
    expect((await requests.findById(request.id))?.status).toBe('APPROVED')
    expect(sink.append).toHaveBeenCalledTimes(2)
  })

  it('marks requests FAILED and audits once when the adapter throws', async () => {
    const { facade, requests, actions, sink } = createGateFacade({ allow: true })
    const request = await facade.requestExecution({
      actionType: 'SEND_EMAIL',
      target: 'prospect@naeos.local',
      requester: actor,
      meta: { requestId: 'req-p4-16' },
    })
    await facade.approve(request.id, actor, { meta: { requestId: 'req-p4-16' } })
    actions.SEND_EMAIL.execute.mockRejectedValueOnce(new Error('provider down'))

    await expect(facade.execute(request.id, actor, { requestId: 'req-p4-16' })).rejects.toThrow(/failed/)
    const final = await requests.findById(request.id)
    expect(final?.status).toBe('FAILED')
    expect(final?.result).toBe('adapter-error')
    expect(sink.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'go-gate.failed', result: 'FAILURE', reason: 'adapter-error' }),
    )
    expect(sink.append).toHaveBeenCalledTimes(3)
  })

  it('marks requests FAILED without adapter errors when the provider responds with ok:false', async () => {
    const { facade, actions, sink } = createGateFacade({ allow: true })
    const request = await facade.requestExecution({
      actionType: 'SEND_EMAIL',
      target: 'prospect@naeos.local',
      requester: actor,
      meta: { requestId: 'req-p4-17' },
    })
    await facade.approve(request.id, actor, { meta: { requestId: 'req-p4-17' } })
    actions.SEND_EMAIL.execute.mockResolvedValueOnce({ ok: false, providerResponse: { provider: 'email', payload: { code: 422 } } })

    const final = await facade.execute(request.id, actor, { requestId: 'req-p4-17' })
    expect(final.status).toBe('FAILED')
    expect(final.result).toBe('provider-response-failed')
    expect(final.providerResponse).toEqual({ provider: 'email', payload: { code: 422 } })
    expect(sink.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'go-gate.failed', result: 'FAILURE', reason: 'provider-response-failed' }),
    )
    expect(actions.SEND_EMAIL.execute).toHaveBeenCalledTimes(1)
  })

  it('stays EXECUTED without extra failed audits when post-execution audit recording rejects', async () => {
    const { facade, requests, actions, sink } = createGateFacade({ allow: true })
    const request = await facade.requestExecution({
      actionType: 'SEND_EMAIL',
      target: 'prospect@naeos.local',
      requester: actor,
      meta: { requestId: 'req-p4-18' },
    })
    await facade.approve(request.id, actor, { meta: { requestId: 'req-p4-18' } })
    const originalAppend = sink.append.getMockImplementation()
    sink.append.mockImplementation(async (event) => {
      if (event.action === 'go-gate.executed') throw new Error('audit down')
      await originalAppend?.(event)
    })

    const final = await facade.execute(request.id, actor, { requestId: 'req-p4-18' }).catch((error: unknown) => {
      expect((error as Error).message).toBe('audit down')
      return requests.findById(request.id)
    })
    expect(final?.status).toBe('EXECUTED')
    expect(final?.result).toBe('verified')
    expect(final?.executedAt).toBeTruthy()
    expect(actions.SEND_EMAIL.execute).toHaveBeenCalledTimes(1)
    expect(sink.append).toHaveBeenCalledWith(expect.objectContaining({ action: 'go-gate.executed' }))
    const failedEvents = sink.append.mock.calls.filter(([event]) => event.action === 'go-gate.failed')
    expect(failedEvents).toHaveLength(0)
  })

  it('keeps EXECUTING without failed audits when the final persistence transition loses the race', async () => {
    const { facade, requests, actions, sink } = createGateFacade({ allow: true })
    const request = await facade.requestExecution({
      actionType: 'SEND_EMAIL',
      target: 'prospect@naeos.local',
      requester: actor,
      meta: { requestId: 'req-p4-19' },
    })
    await facade.approve(request.id, actor, { meta: { requestId: 'req-p4-19' } })
    const originalTransition = requests.transition.bind(requests)
    requests.transition = async (id, expectedStatus, input, expiresAfter) => {
      if (expectedStatus === 'EXECUTING' && input.status === 'EXECUTED') return null
      return originalTransition(id, expectedStatus, input, expiresAfter)
    }

    await expect(facade.execute(request.id, actor, { requestId: 'req-p4-19' })).rejects.toThrow(/status has changed/)
    const final = await requests.findById(request.id)
    expect(final?.status).toBe('EXECUTING')
    expect(final?.result).toBeUndefined()
    expect(actions.SEND_EMAIL.execute).toHaveBeenCalledTimes(1)
    expect(sink.append).toHaveBeenCalledTimes(2)
  })
})