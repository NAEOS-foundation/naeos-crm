import { PrismaClient, Prisma } from '@prisma/client'
import type { AuditEvent } from '@naeos-crm/audit'
import type {
  Activity,
  Campaign,
  CampaignAnalyticsSummary,
  CampaignStatus,
  CampaignStep,
  Company,
  Contact,
  DashboardSummary,
  FollowUp,
  FollowUpAnalyticsSummary,
  Lead,
  Opportunity,
  OpportunityStage,
  PipelineAnalyticsSummary,
  PipelineStage,
  Task,
  User,
} from '@naeos-crm/domain'

import type {
  ActivityReadPort,
  AuditReadPort,
  CampaignReadPort,
  CampaignStepReadPort,
  CompanyReadPort,
  ContactReadPort,
  DashboardReadPort,
  FollowUpReadPort,
  LeadReadPort,
  OpportunityReadPort,
  PipelineAnalyticsReadPort,
  PipelineStageReadPort,
  TaskReadPort,
  UserReadPort,
} from './domain-interfaces'
import { conflict, HttpError, invalidReference } from './errors'

export const prisma = new PrismaClient()

export interface PageQuery {
  limit?: number
  offset?: number
}

const isPrismaNotFound = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025'

function translatePrismaError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      throw conflict('A record with the same unique value already exists')
    }
    if (err.code === 'P2003') {
      throw invalidReference('The referenced record does not exist')
    }
  }
  throw err
}

const normalizeUser = (user: any): User => ({
  id: user.id,
  email: user.email,
  name: user.name,
  roles: user.roles,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

const normalizeCompany = (company: any): Company => ({
  id: company.id,
  name: company.name,
  industry: company.industry ?? undefined,
  region: company.region ?? undefined,
  status: company.status,
  ownerId: company.ownerId ?? undefined,
  createdAt: company.createdAt,
  updatedAt: company.updatedAt,
})

const normalizeContact = (contact: any): Contact => ({
  id: contact.id,
  companyId: contact.companyId,
  fullName: contact.fullName,
  email: contact.email ?? undefined,
  role: contact.role ?? undefined,
  status: contact.status,
  createdAt: contact.createdAt,
  updatedAt: contact.updatedAt,
})

const normalizeLead = (lead: any): Lead => ({
  id: lead.id,
  companyId: lead.companyId,
  source: lead.source,
  status: lead.status,
  ownerId: lead.ownerId ?? undefined,
  score: lead.score ?? undefined,
  createdAt: lead.createdAt,
  updatedAt: lead.updatedAt,
})

const normalizeActivity = (activity: any): Activity => ({
  id: activity.id,
  companyId: activity.companyId ?? undefined,
  contactId: activity.contactId ?? undefined,
  type: activity.type,
  channel: activity.channel ?? undefined,
  summary: activity.summary,
  occurredAt: activity.occurredAt,
  ownerId: activity.ownerId ?? undefined,
  createdAt: activity.createdAt,
})

const normalizeTask = (task: any): Task => ({
  id: task.id,
  companyId: task.companyId ?? undefined,
  assigneeId: task.assigneeId ?? undefined,
  subject: task.subject,
  dueAt: task.dueAt ?? undefined,
  status: task.status,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
})

const normalizePipelineStage = (stage: any): PipelineStage => ({
  id: stage.id,
  stage: stage.stage,
  name: stage.name,
  sequence: stage.sequence,
  probability: stage.probability,
  createdAt: stage.createdAt,
  updatedAt: stage.updatedAt,
})

const normalizeOpportunity = (opportunity: any): Opportunity => ({
  id: opportunity.id,
  companyId: opportunity.companyId,
  name: opportunity.name,
  stage: opportunity.stage,
  amount: Number(opportunity.amount),
  closeDate: opportunity.closeDate ?? undefined,
  ownerId: opportunity.ownerId ?? undefined,
  createdAt: opportunity.createdAt,
  updatedAt: opportunity.updatedAt,
})

const normalizeCampaign = (campaign: any): Campaign => ({
  id: campaign.id,
  name: campaign.name,
  type: campaign.type,
  status: campaign.status,
  ownerId: campaign.ownerId ?? undefined,
  createdAt: campaign.createdAt,
  updatedAt: campaign.updatedAt,
})

const normalizeCampaignStep = (step: any): CampaignStep => ({
  id: step.id,
  campaignId: step.campaignId,
  sequence: step.sequence,
  actionType: step.actionType,
  subject: step.subject ?? undefined,
  scheduledAt: step.scheduledAt ?? undefined,
  status: step.status,
  createdAt: step.createdAt,
  updatedAt: step.updatedAt,
})

const normalizeFollowUp = (followUp: any): FollowUp => ({
  id: followUp.id,
  activityId: followUp.activityId,
  dueAt: followUp.dueAt,
  status: followUp.status,
  ownerId: followUp.ownerId ?? undefined,
  notes: followUp.notes ?? undefined,
  createdAt: followUp.createdAt,
  updatedAt: followUp.updatedAt,
})

export class PrismaUserReadPort implements UserReadPort {
  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { id } })
    return user ? normalizeUser(user) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { email } })
    return user ? normalizeUser(user) : null
  }

  async list(): Promise<User[]> {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
    return users.map(normalizeUser)
  }

  async create(input: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    try {
      const user = await prisma.user.create({ data: input })
      return normalizeUser(user)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<User>): Promise<User | null> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeUser(user)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }
}

export class PrismaCompanyReadPort implements CompanyReadPort {
  async findById(id: string): Promise<Company | null> {
    const company = await prisma.company.findUnique({ where: { id } })
    return company ? normalizeCompany(company) : null
  }

  async list(params?: {
    status?: Company['status']
    limit?: number
    offset?: number
  }): Promise<{ data: Company[]; total: number }> {
    const where = params?.status ? { status: params.status } : {}
    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.company.count({ where }),
    ])
    return { data: companies.map(normalizeCompany), total }
  }

  async create(input: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
    try {
      const company = await prisma.company.create({ data: input })
      return normalizeCompany(company)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<Company>): Promise<Company | null> {
    try {
      const company = await prisma.company.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeCompany(company)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const [contacts, leads, activities, tasks] = await Promise.all([
        prisma.contact.count({ where: { companyId: id } }),
        prisma.lead.count({ where: { companyId: id } }),
        prisma.activity.count({ where: { companyId: id } }),
        prisma.task.count({ where: { companyId: id } }),
      ])
      const related = contacts + leads + activities + tasks
      if (related > 0) {
        throw new HttpError(
          409,
          'COMPANY_HAS_RELATIONS',
          `Cannot delete: company has ${related} related contact, lead, activity, or task record(s). Move or delete them first.`,
        )
      }
      await prisma.company.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }
}

export class PrismaContactReadPort implements ContactReadPort {
  async findById(id: string): Promise<Contact | null> {
    const contact = await prisma.contact.findUnique({ where: { id } })
    return contact ? normalizeContact(contact) : null
  }

  async list(params?: PageQuery): Promise<{ data: Contact[]; total: number }> {
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.contact.count(),
    ])
    return { data: contacts.map(normalizeContact), total }
  }

  async listByCompany(
    companyId: string,
    params?: PageQuery,
  ): Promise<{ data: Contact[]; total: number }> {
    const where = { companyId }
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.contact.count({ where }),
    ])
    return { data: contacts.map(normalizeContact), total }
  }

  async create(input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
    try {
      const contact = await prisma.contact.create({ data: input })
      return normalizeContact(contact)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<Contact>): Promise<Contact | null> {
    try {
      const contact = await prisma.contact.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeContact(contact)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.contact.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }
}

export class PrismaLeadReadPort implements LeadReadPort {
  async findById(id: string): Promise<Lead | null> {
    const lead = await prisma.lead.findUnique({ where: { id } })
    return lead ? normalizeLead(lead) : null
  }

  async list(params?: PageQuery): Promise<{ data: Lead[]; total: number }> {
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.lead.count(),
    ])
    return { data: leads.map(normalizeLead), total }
  }

  async listByCompany(
    companyId: string,
    params?: PageQuery,
  ): Promise<{ data: Lead[]; total: number }> {
    const where = { companyId }
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.lead.count({ where }),
    ])
    return { data: leads.map(normalizeLead), total }
  }

  async create(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    try {
      const lead = await prisma.lead.create({ data: input })
      return normalizeLead(lead)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<Lead>): Promise<Lead | null> {
    try {
      const lead = await prisma.lead.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeLead(lead)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.lead.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }
}

export class PrismaActivityReadPort implements ActivityReadPort {
  async findById(id: string): Promise<Activity | null> {
    const activity = await prisma.activity.findUnique({ where: { id } })
    return activity ? normalizeActivity(activity) : null
  }

  async list(params?: PageQuery): Promise<{ data: Activity[]; total: number }> {
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        orderBy: { occurredAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.activity.count(),
    ])
    return { data: activities.map(normalizeActivity), total }
  }

  async listByCompany(
    companyId: string,
    params?: PageQuery,
  ): Promise<{ data: Activity[]; total: number }> {
    const where = { companyId }
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.activity.count({ where }),
    ])
    return { data: activities.map(normalizeActivity), total }
  }

  async create(input: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
    try {
      const activity = await prisma.activity.create({ data: input })
      return normalizeActivity(activity)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<Activity>): Promise<Activity | null> {
    try {
      const activity = await prisma.activity.update({
        where: { id },
        data: input,
      })
      return normalizeActivity(activity)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.activity.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }
}

export class PrismaTaskReadPort implements TaskReadPort {
  async findById(id: string): Promise<Task | null> {
    const task = await prisma.task.findUnique({ where: { id } })
    return task ? normalizeTask(task) : null
  }

  async list(params?: PageQuery): Promise<{ data: Task[]; total: number }> {
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.task.count(),
    ])
    return { data: tasks.map(normalizeTask), total }
  }

  async listByCompany(
    companyId: string,
    params?: PageQuery,
  ): Promise<{ data: Task[]; total: number }> {
    const where = { companyId }
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.task.count({ where }),
    ])
    return { data: tasks.map(normalizeTask), total }
  }

  async create(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    try {
      const task = await prisma.task.create({ data: input })
      return normalizeTask(task)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<Task>): Promise<Task | null> {
    try {
      const task = await prisma.task.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeTask(task)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.task.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }
}

export class PrismaPipelineStageReadPort implements PipelineStageReadPort {
  async findById(id: string): Promise<PipelineStage | null> {
    const stage = await prisma.pipelineStage.findUnique({ where: { id } })
    return stage ? normalizePipelineStage(stage) : null
  }

  async list(params?: PageQuery): Promise<{ data: PipelineStage[]; total: number }> {
    const [stages, total] = await Promise.all([
      prisma.pipelineStage.findMany({
        orderBy: { sequence: 'asc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.pipelineStage.count(),
    ])
    return { data: stages.map(normalizePipelineStage), total }
  }

  async create(input: Omit<PipelineStage, 'id' | 'createdAt' | 'updatedAt'>): Promise<PipelineStage> {
    try {
      const stage = await prisma.pipelineStage.create({ data: input })
      return normalizePipelineStage(stage)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<PipelineStage>): Promise<PipelineStage | null> {
    try {
      const stage = await prisma.pipelineStage.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizePipelineStage(stage)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.pipelineStage.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }

  async reorder(orderedIds: string[]): Promise<PipelineStage[]> {
    const stages = await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.pipelineStage.update({
          where: { id },
          data: { sequence: index, updatedAt: new Date() },
        }),
      ),
    )
    return stages
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map(normalizePipelineStage)
  }
}

export class PrismaOpportunityReadPort implements OpportunityReadPort {
  async findById(id: string): Promise<Opportunity | null> {
    const opportunity = await prisma.opportunity.findUnique({ where: { id } })
    return opportunity ? normalizeOpportunity(opportunity) : null
  }

  async list(
    params?: { stage?: Opportunity['stage']; companyId?: string; ownerId?: string } & PageQuery,
  ): Promise<{ data: Opportunity[]; total: number }> {
    const where: any = {}
    if (params?.stage) where.stage = params.stage
    if (params?.companyId) where.companyId = params.companyId
    if (params?.ownerId) where.ownerId = params.ownerId

    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.opportunity.count({ where }),
    ])
    return { data: opportunities.map(normalizeOpportunity), total }
  }

  async listByCompany(
    companyId: string,
    params?: PageQuery,
  ): Promise<{ data: Opportunity[]; total: number }> {
    const where = { companyId }
    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.opportunity.count({ where }),
    ])
    return { data: opportunities.map(normalizeOpportunity), total }
  }

  async listByOwner(
    ownerId: string,
    params?: PageQuery,
  ): Promise<{ data: Opportunity[]; total: number }> {
    const where = { ownerId }
    const [opportunities, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.opportunity.count({ where }),
    ])
    return { data: opportunities.map(normalizeOpportunity), total }
  }

  async create(input: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Opportunity> {
    try {
      const opportunity = await prisma.opportunity.create({ data: input })
      return normalizeOpportunity(opportunity)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<Opportunity>): Promise<Opportunity | null> {
    try {
      const opportunity = await prisma.opportunity.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeOpportunity(opportunity)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.opportunity.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }
}

export class PrismaCampaignReadPort implements CampaignReadPort {
  async findById(id: string): Promise<Campaign | null> {
    const campaign = await prisma.campaign.findUnique({ where: { id } })
    return campaign ? normalizeCampaign(campaign) : null
  }

  async list(
    params?: { status?: Campaign['status']; type?: Campaign['type']; ownerId?: string } & PageQuery,
  ): Promise<{ data: Campaign[]; total: number }> {
    const where: any = {}
    if (params?.status) where.status = params.status
    if (params?.type) where.type = params.type
    if (params?.ownerId) where.ownerId = params.ownerId

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.campaign.count({ where }),
    ])
    return { data: campaigns.map(normalizeCampaign), total }
  }

  async listByOwner(
    ownerId: string,
    params?: PageQuery,
  ): Promise<{ data: Campaign[]; total: number }> {
    const where = { ownerId }
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.campaign.count({ where }),
    ])
    return { data: campaigns.map(normalizeCampaign), total }
  }

  async create(input: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign> {
    try {
      const campaign = await prisma.campaign.create({ data: input })
      return normalizeCampaign(campaign)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<Campaign>): Promise<Campaign | null> {
    try {
      const campaign = await prisma.campaign.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeCampaign(campaign)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.campaign.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }
}

export class PrismaCampaignStepReadPort implements CampaignStepReadPort {
  async findById(id: string): Promise<CampaignStep | null> {
    const step = await prisma.campaignStep.findUnique({ where: { id } })
    return step ? normalizeCampaignStep(step) : null
  }

  async listByCampaign(
    campaignId: string,
    params?: PageQuery,
  ): Promise<{ data: CampaignStep[]; total: number }> {
    const where = { campaignId }
    const [steps, total] = await Promise.all([
      prisma.campaignStep.findMany({
        where,
        orderBy: { sequence: 'asc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.campaignStep.count({ where }),
    ])
    return { data: steps.map(normalizeCampaignStep), total }
  }

  async create(input: Omit<CampaignStep, 'id' | 'createdAt' | 'updatedAt'>): Promise<CampaignStep> {
    try {
      const step = await prisma.campaignStep.create({ data: input })
      return normalizeCampaignStep(step)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<CampaignStep>): Promise<CampaignStep | null> {
    try {
      const step = await prisma.campaignStep.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeCampaignStep(step)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.campaignStep.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }
}

export class PrismaFollowUpReadPort implements FollowUpReadPort {
  async findById(id: string): Promise<FollowUp | null> {
    const followUp = await prisma.followUp.findUnique({ where: { id } })
    return followUp ? normalizeFollowUp(followUp) : null
  }

  async list(
    params?: { status?: FollowUp['status']; ownerId?: string } & PageQuery,
  ): Promise<{ data: FollowUp[]; total: number }> {
    const where: any = {}
    if (params?.status) where.status = params.status
    if (params?.ownerId) where.ownerId = params.ownerId

    const [followUps, total] = await Promise.all([
      prisma.followUp.findMany({
        where,
        orderBy: { dueAt: 'asc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.followUp.count({ where }),
    ])
    return { data: followUps.map(normalizeFollowUp), total }
  }

  async listByActivity(
    activityId: string,
    params?: PageQuery,
  ): Promise<{ data: FollowUp[]; total: number }> {
    const where = { activityId }
    const [followUps, total] = await Promise.all([
      prisma.followUp.findMany({
        where,
        orderBy: { dueAt: 'asc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.followUp.count({ where }),
    ])
    return { data: followUps.map(normalizeFollowUp), total }
  }

  async listByOwner(
    ownerId: string,
    params?: PageQuery,
  ): Promise<{ data: FollowUp[]; total: number }> {
    const where = { ownerId }
    const [followUps, total] = await Promise.all([
      prisma.followUp.findMany({
        where,
        orderBy: { dueAt: 'asc' },
        take: params?.limit,
        skip: params?.offset,
      }),
      prisma.followUp.count({ where }),
    ])
    return { data: followUps.map(normalizeFollowUp), total }
  }

  async create(input: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>): Promise<FollowUp> {
    try {
      const followUp = await prisma.followUp.create({ data: input })
      return normalizeFollowUp(followUp)
    } catch (err) {
      throw translatePrismaError(err)
    }
  }

  async update(id: string, input: Partial<FollowUp>): Promise<FollowUp | null> {
    try {
      const followUp = await prisma.followUp.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeFollowUp(followUp)
    } catch (err) {
      if (isPrismaNotFound(err)) return null
      throw translatePrismaError(err)
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.followUp.delete({ where: { id } })
      return true
    } catch (err) {
      if (isPrismaNotFound(err)) return false
      throw translatePrismaError(err)
    }
  }
}

export class PrismaPipelineAnalyticsReadPort implements PipelineAnalyticsReadPort {
  async getPipelineAnalytics(): Promise<PipelineAnalyticsSummary> {
    const [opportunities, stages] = await Promise.all([
      prisma.opportunity.findMany({ select: { stage: true, amount: true } }),
      prisma.pipelineStage.findMany({ select: { stage: true, probability: true } }),
    ])

    const configProbability: Partial<Record<OpportunityStage, number>> = {}
    for (const s of stages) configProbability[s.stage] = s.probability

    const allStages: OpportunityStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']
    const probabilityFor = (stage: OpportunityStage): number => configProbability[stage] ?? 0

    const byStage = allStages.map((stage) => {
      const items = opportunities.filter((opportunity) => opportunity.stage === stage)
      const amount = items.reduce((sum, op) => sum + Number(op.amount), 0)
      const isOpen = stage !== 'WON' && stage !== 'LOST'
      return {
        stage,
        count: items.length,
        amount,
        weightedAmount: isOpen ? (amount * probabilityFor(stage)) / 100 : amount,
      }
    })

    const openItems = opportunities.filter((op) => op.stage !== 'WON' && op.stage !== 'LOST')
    const totalValue = opportunities.reduce((sum, op) => sum + Number(op.amount), 0)
    const weightedValue = openItems.reduce(
      (sum, op) => sum + (Number(op.amount) * probabilityFor(op.stage)) / 100,
      0,
    )
    const wonCount = opportunities.filter((op) => op.stage === 'WON').length
    const lostCount = opportunities.filter((op) => op.stage === 'LOST').length

    return {
      totalValue,
      weightedValue,
      openCount: openItems.length,
      wonCount,
      lostCount,
      avgDealSize: opportunities.length > 0 ? totalValue / opportunities.length : 0,
      byStage,
    }
  }

  async getCampaignAnalytics(): Promise<CampaignAnalyticsSummary> {
    const [campaigns, steps] = await Promise.all([
      prisma.campaign.findMany({ select: { status: true } }),
      prisma.campaignStep.count({ where: { status: 'READY' } }),
    ])

    const byStatus: Record<CampaignStatus, number> = {
      DRAFT: 0,
      ACTIVE: 0,
      PAUSED: 0,
      COMPLETED: 0,
      ARCHIVED: 0,
    }
    for (const campaign of campaigns) {
      if (campaign.status in byStatus) {
        byStatus[campaign.status as keyof typeof byStatus] += 1
      }
    }

    return { total: campaigns.length, byStatus, stepsPrepared: steps }
  }

  async getFollowUpAnalytics(): Promise<FollowUpAnalyticsSummary> {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

    const [openCount, overdueCount, dueTodayCount] = await Promise.all([
      prisma.followUp.count({ where: { status: 'OPEN' } }),
      prisma.followUp.count({ where: { status: 'OPEN', dueAt: { lt: now } } }),
      prisma.followUp.count({ where: { status: 'OPEN', dueAt: { gte: startOfToday, lt: endOfToday } } }),
    ])

    return { openCount, overdueCount, dueTodayCount }
  }
}

export class PrismaDashboardReadPort implements DashboardReadPort {
  async getSummary(): Promise<DashboardSummary> {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      companies,
      contacts,
      leads,
      activities,
      tasks,
      recentActivities,
    ] = await Promise.all([
      prisma.company.findMany({ select: { status: true } }),
      prisma.contact.count(),
      prisma.lead.findMany({ select: { status: true } }),
      prisma.activity.count(),
      prisma.task.findMany({ select: { status: true, dueAt: true } }),
      prisma.activity.count({ where: { occurredAt: { gte: thirtyDaysAgo } } }),
    ])

    const leadStatuses: DashboardSummary['leads']['byStatus'] = {
      NEW: 0,
      QUALIFIED: 0,
      NURTURE: 0,
      DISQUALIFIED: 0,
    }
    for (const lead of leads) {
      if (lead.status in leadStatuses) {
        leadStatuses[lead.status as keyof typeof leadStatuses] += 1
      }
    }

    const openTasks = tasks.filter((task) => task.status === 'OPEN' || task.status === 'IN_PROGRESS')
    const overdueTasks = tasks.filter((task) => task.dueAt && task.dueAt < now && task.status !== 'DONE')

    return {
      companies: {
        total: companies.length,
        active: companies.filter((company) => company.status === 'ACTIVE').length,
      },
      contacts: { total: contacts },
      leads: { total: leads.length, byStatus: leadStatuses },
      activities: { total: activities, recent: recentActivities },
      tasks: { total: tasks.length, open: openTasks.length, overdue: overdueTasks.length },
    }
  }
}

export class PrismaAuditSink {
  async append(event: AuditEvent): Promise<void> {
    await prisma.auditEvent.create({
      data: {
        id: event.id,
        actorId: event.actorId,
        actorType: event.actorType,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        requestId: event.requestId,
        source: event.source,
        result: event.result,
        reason: event.reason,
        policyVersion: event.policyVersion,
        previousState: event.previousState as unknown as Prisma.InputJsonValue,
        newState: event.newState as unknown as Prisma.InputJsonValue,
        authorization: event.authorization as unknown as Prisma.InputJsonValue,
      },
    })
  }
}

const normalizeAuditEvent = (event: any): AuditEvent => ({
  id: event.id,
  actorId: event.actorId ?? undefined,
  actorType: event.actorType ?? undefined,
  action: event.action,
  entityType: event.entityType,
  entityId: event.entityId,
  requestId: event.requestId ?? undefined,
  source: event.source ?? undefined,
  result: event.result as AuditEvent['result'],
  reason: event.reason ?? undefined,
  policyVersion: event.policyVersion ?? undefined,
  previousState: (event.previousState as Record<string, unknown>) ?? undefined,
  newState: (event.newState as Record<string, unknown>) ?? undefined,
  authorization: (event.authorization as Record<string, unknown>) ?? undefined,
  createdAt: event.createdAt,
})

export class PrismaAuditReadPort implements AuditReadPort {
  async list(params: {
    entityType?: string
    entityId?: string
    actorId?: string
    requestId?: string
    limit: number
    offset: number
  }): Promise<{ events: AuditEvent[]; total: number }> {
    const where: any = {}

    if (params.entityType) where.entityType = params.entityType
    if (params.entityId) where.entityId = params.entityId
    if (params.actorId) where.actorId = params.actorId
    if (params.requestId) where.requestId = params.requestId

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: params.offset,
      }),
      prisma.auditEvent.count({ where }),
    ])

    return { events: events.map(normalizeAuditEvent), total }
  }
}