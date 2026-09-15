import type {
  Activity,
  Campaign,
  CampaignAnalyticsSummary,
  CampaignStep,
  Company,
  Community,
  Contact,
  Contributor,
  FollowUp,
  FollowUpAnalyticsSummary,
  GoGateRequest,
  Investor,
  Lead,
  Opportunity,
  Partner,
  PipelineAnalyticsSummary,
  PipelineStage,
  PolicyRule,
  Task,
  User,
  UseCase,
  DashboardSummary,
} from '@naeos-crm/domain'
import type { AuditService, AuditEvent } from '@naeos-crm/audit'

import type {
  ActivityReadPort,
  AuditReadPort,
  CampaignReadPort,
  CampaignStepReadPort,
  CommunityReadPort,
  CompanyReadPort,
  ContactReadPort,
  ContributorReadPort,
  DashboardReadPort,
  FollowUpReadPort,
  InvestorReadPort,
  LeadReadPort,
  OpportunityReadPort,
  PageQuery,
  PartnerReadPort,
  PipelineAnalyticsReadPort,
  PipelineStageReadPort,
  PolicyRuleReadPort,
  TaskReadPort,
  UseCaseReadPort,
  UserReadPort,
} from './domain-interfaces'
import { GoGateService } from './gate'
import { forbidden, HttpError } from './errors'

interface AuditMetadata {
  actorId?: string
  requestId?: string
  actor?: { id: string; roles: string[] }
}

async function auditSafely(
  audit: AuditService,
  event: Parameters<AuditService['record']>[0],
): Promise<void> {
  try {
    await audit.record(event)
  } catch (err) {
    console.error('[audit] Failed to record event', err)
  }
}

function isPrivileged(actor?: { id: string; roles: string[] }): boolean {
  return (
    actor?.roles.some((role) => {
      const normalized = role.toLowerCase()
      return normalized === 'admin' || normalized === 'manager'
    }) ?? false
  )
}

async function assertCompanyAccess(
  companyReadPort: CompanyReadPort,
  actor: AuditMetadata['actor'],
  companyId: string,
) {
  if (!actor) throw forbidden('No authenticated actor')
  if (isPrivileged(actor)) return
  const company = await companyReadPort.findById(companyId)
  if (!company) {
    throw new HttpError(404, 'COMPANY_NOT_FOUND', `Company ${companyId} was not found`)
  }
  if (company.ownerId === actor.id) return
  throw forbidden('You do not have access to records for this company')
}

function assertSelfScoped(
  actor: AuditMetadata['actor'],
  field: 'ownerId' | 'assigneeId',
  value: string | undefined,
) {
  if (!actor) throw forbidden('No authenticated actor')
  if (isPrivileged(actor)) return
  if (value && value === actor.id) return
  throw forbidden(`You cannot modify records you do not own`)
}

export class UserFacade {
  constructor(
    private readonly userReadPort: UserReadPort,
    private readonly audit: AuditService,
  ) {}

  async getUser(id: string): Promise<User | null> {
    return this.userReadPort.findById(id)
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userReadPort.findByEmail(email)
  }

  async listUsers(): Promise<User[]> {
    return this.userReadPort.list()
  }

  async createUser(input: Omit<User, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    const user = await this.userReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: user as unknown as Record<string, unknown>,
    })
    return user
  }

  async updateUser(id: string, input: Partial<User>, auditMeta: AuditMetadata) {
    const previous = await this.userReadPort.findById(id)
    const user = await this.userReadPort.update(id, input)

    if (!user) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'user.updated',
      entityType: 'user',
      entityId: user.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: user as unknown as Record<string, unknown>,
    })
    return user
  }

  async deleteUser(id: string, auditMeta: AuditMetadata) {
    const previous = await this.userReadPort.findById(id)
    const deleted = await this.userReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'user.deleted',
        entityType: 'user',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }
}

export class CompanyFacade {
  constructor(
    private readonly companyReadPort: CompanyReadPort,
    private readonly audit: AuditService,
  ) {}

  async getCompany(id: string) {
    return this.companyReadPort.findById(id)
  }

  async listCompanies(params?: { status?: Company['status'] } & PageQuery) {
    return this.companyReadPort.list(params)
  }

  async createCompany(input: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    const company = await this.companyReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'company.created',
      entityType: 'company',
      entityId: company.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: company as unknown as Record<string, unknown>,
    })
    return company
  }

  async updateCompany(id: string, input: Partial<Company>, auditMeta: AuditMetadata) {
    const previous = await this.companyReadPort.findById(id)
    const company = await this.companyReadPort.update(id, input)

    if (!company) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'company.updated',
      entityType: 'company',
      entityId: company.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: company as unknown as Record<string, unknown>,
    })
    return company
  }

  async deleteCompany(id: string, auditMeta: AuditMetadata) {
    const previous = await this.companyReadPort.findById(id)
    const deleted = await this.companyReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'company.deleted',
        entityType: 'company',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }
}

export class ContactFacade {
  constructor(
    private readonly contactReadPort: ContactReadPort,
    private readonly audit: AuditService,
    private readonly companyReadPort: CompanyReadPort,
  ) {}

  async getContact(id: string) {
    return this.contactReadPort.findById(id)
  }

  async listContacts(params?: PageQuery) {
    return this.contactReadPort.list(params)
  }

  async listByCompany(companyId: string, params?: PageQuery) {
    return this.contactReadPort.listByCompany(companyId, params)
  }

  async createContact(input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    await assertCompanyAccess(this.companyReadPort, auditMeta.actor, input.companyId)
    const contact = await this.contactReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'contact.created',
      entityType: 'contact',
      entityId: contact.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: contact as unknown as Record<string, unknown>,
    })
    return contact
  }

  async updateContact(id: string, input: Partial<Contact>, auditMeta: AuditMetadata) {
    const previous = await this.contactReadPort.findById(id)
    await assertCompanyAccess(this.companyReadPort, auditMeta.actor, input.companyId ?? previous?.companyId ?? '')
    const contact = await this.contactReadPort.update(id, input)

    if (!contact) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'contact.updated',
      entityType: 'contact',
      entityId: contact.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: contact as unknown as Record<string, unknown>,
    })
    return contact
  }

  async deleteContact(id: string, auditMeta: AuditMetadata) {
    const previous = await this.contactReadPort.findById(id)
    if (previous) {
      await assertCompanyAccess(this.companyReadPort, auditMeta.actor, previous.companyId)
    }
    const deleted = await this.contactReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'contact.deleted',
        entityType: 'contact',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }
}

export class LeadFacade {
  constructor(
    private readonly leadReadPort: LeadReadPort,
    private readonly audit: AuditService,
  ) {}

  async getLead(id: string) {
    return this.leadReadPort.findById(id)
  }

  async listLeads(params?: PageQuery) {
    return this.leadReadPort.list(params)
  }

  async listByCompany(companyId: string, params?: PageQuery) {
    return this.leadReadPort.listByCompany(companyId, params)
  }

  async createLead(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    const lead = await this.leadReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'lead.created',
      entityType: 'lead',
      entityId: lead.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: lead as unknown as Record<string, unknown>,
    })
    return lead
  }

  async updateLead(id: string, input: Partial<Lead>, auditMeta: AuditMetadata) {
    const previous = await this.leadReadPort.findById(id)
    const lead = await this.leadReadPort.update(id, input)

    if (!lead) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'lead.updated',
      entityType: 'lead',
      entityId: lead.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: lead as unknown as Record<string, unknown>,
    })
    return lead
  }

  async deleteLead(id: string, auditMeta: AuditMetadata) {
    const previous = await this.leadReadPort.findById(id)
    const deleted = await this.leadReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'lead.deleted',
        entityType: 'lead',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }
}

export class ActivityFacade {
  constructor(
    private readonly activityReadPort: ActivityReadPort,
    private readonly audit: AuditService,
    private readonly companyReadPort: CompanyReadPort,
  ) {}

  async getActivity(id: string) {
    return this.activityReadPort.findById(id)
  }

  async listActivities(params?: PageQuery) {
    return this.activityReadPort.list(params)
  }

  async listByCompany(companyId: string, params?: PageQuery) {
    return this.activityReadPort.listByCompany(companyId, params)
  }

  async createActivity(input: Omit<Activity, 'id' | 'createdAt'>, auditMeta: AuditMetadata) {
    if (input.companyId) {
      await assertCompanyAccess(this.companyReadPort, auditMeta.actor, input.companyId)
    } else {
      assertSelfScoped(auditMeta.actor, 'ownerId', input.ownerId)
    }
    const activity = await this.activityReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'activity.created',
      entityType: 'activity',
      entityId: activity.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: activity as unknown as Record<string, unknown>,
    })
    return activity
  }

  async updateActivity(id: string, input: Partial<Activity>, auditMeta: AuditMetadata) {
    const previous = await this.activityReadPort.findById(id)
    const targetCompanyId = input.companyId ?? previous?.companyId
    if (targetCompanyId) {
      await assertCompanyAccess(this.companyReadPort, auditMeta.actor, targetCompanyId)
    } else {
      assertSelfScoped(auditMeta.actor, 'ownerId', input.ownerId ?? previous?.ownerId)
    }
    const activity = await this.activityReadPort.update(id, input)

    if (!activity) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'activity.updated',
      entityType: 'activity',
      entityId: activity.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: activity as unknown as Record<string, unknown>,
    })
    return activity
  }

  async deleteActivity(id: string, auditMeta: AuditMetadata) {
    const previous = await this.activityReadPort.findById(id)
    if (previous?.companyId) {
      await assertCompanyAccess(this.companyReadPort, auditMeta.actor, previous.companyId)
    } else if (previous) {
      assertSelfScoped(auditMeta.actor, 'ownerId', previous.ownerId)
    }
    const deleted = await this.activityReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'activity.deleted',
        entityType: 'activity',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }
}

export class TaskFacade {
  constructor(
    private readonly taskReadPort: TaskReadPort,
    private readonly audit: AuditService,
    private readonly companyReadPort: CompanyReadPort,
  ) {}

  async getTask(id: string) {
    return this.taskReadPort.findById(id)
  }

  async listTasks(params?: PageQuery) {
    return this.taskReadPort.list(params)
  }

  async listByCompany(companyId: string, params?: PageQuery) {
    return this.taskReadPort.listByCompany(companyId, params)
  }

  async createTask(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    if (input.companyId) {
      await assertCompanyAccess(this.companyReadPort, auditMeta.actor, input.companyId)
    } else {
      assertSelfScoped(auditMeta.actor, 'assigneeId', input.assigneeId)
    }
    const task = await this.taskReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'task.created',
      entityType: 'task',
      entityId: task.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: task as unknown as Record<string, unknown>,
    })
    return task
  }

  async updateTask(id: string, input: Partial<Task>, auditMeta: AuditMetadata) {
    const previous = await this.taskReadPort.findById(id)
    const targetCompanyId = input.companyId ?? previous?.companyId
    if (targetCompanyId) {
      await assertCompanyAccess(this.companyReadPort, auditMeta.actor, targetCompanyId)
    } else {
      assertSelfScoped(auditMeta.actor, 'assigneeId', input.assigneeId ?? previous?.assigneeId)
    }
    const task = await this.taskReadPort.update(id, input)

    if (!task) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'task.updated',
      entityType: 'task',
      entityId: task.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: task as unknown as Record<string, unknown>,
    })
    return task
  }

  async deleteTask(id: string, auditMeta: AuditMetadata) {
    const previous = await this.taskReadPort.findById(id)
    if (previous?.companyId) {
      await assertCompanyAccess(this.companyReadPort, auditMeta.actor, previous.companyId)
    } else if (previous) {
      assertSelfScoped(auditMeta.actor, 'assigneeId', previous.assigneeId)
    }
    const deleted = await this.taskReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'task.deleted',
        entityType: 'task',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }
}

export class DashboardFacade {
  constructor(private readonly dashboardReadPort: DashboardReadPort) {}

  async getSummary(): Promise<DashboardSummary> {
    return this.dashboardReadPort.getSummary()
  }
}

export class PipelineStageFacade {
  constructor(
    private readonly pipelineStageReadPort: PipelineStageReadPort,
    private readonly audit: AuditService,
  ) {}

  async getStage(id: string): Promise<PipelineStage | null> {
    return this.pipelineStageReadPort.findById(id)
  }

  async listStages(params?: PageQuery) {
    return this.pipelineStageReadPort.list(params)
  }

  async createStage(input: Omit<PipelineStage, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    const stage = await this.pipelineStageReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'pipeline-stage.created',
      entityType: 'pipeline-stage',
      entityId: stage.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: stage as unknown as Record<string, unknown>,
    })
    return stage
  }

  async updateStage(id: string, input: Partial<PipelineStage>, auditMeta: AuditMetadata) {
    const previous = await this.pipelineStageReadPort.findById(id)
    const stage = await this.pipelineStageReadPort.update(id, input)

    if (!stage) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'pipeline-stage.updated',
      entityType: 'pipeline-stage',
      entityId: stage.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: stage as unknown as Record<string, unknown>,
    })
    return stage
  }

  async deleteStage(id: string, auditMeta: AuditMetadata) {
    const previous = await this.pipelineStageReadPort.findById(id)
    const deleted = await this.pipelineStageReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'pipeline-stage.deleted',
        entityType: 'pipeline-stage',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }

  async reorderStages(orderedIds: string[], auditMeta: AuditMetadata) {
    const stages = await this.pipelineStageReadPort.reorder(orderedIds)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'pipeline-stage.reordered',
      entityType: 'pipeline-stage',
      entityId: 'all',
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: { orderedIds } as unknown as Record<string, unknown>,
    })
    return stages
  }
}

export class OpportunityFacade {
  constructor(
    private readonly opportunityReadPort: OpportunityReadPort,
    private readonly audit: AuditService,
    private readonly companyReadPort: CompanyReadPort,
  ) {}

  async getOpportunity(id: string) {
    return this.opportunityReadPort.findById(id)
  }

  async listOpportunities(params?: { stage?: Opportunity['stage']; companyId?: string; ownerId?: string } & PageQuery) {
    return this.opportunityReadPort.list(params)
  }

  async listByCompany(companyId: string, params?: PageQuery) {
    return this.opportunityReadPort.listByCompany(companyId, params)
  }

  async listByOwner(ownerId: string, params?: PageQuery) {
    return this.opportunityReadPort.listByOwner(ownerId, params)
  }

  async createOpportunity(input: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    await assertCompanyAccess(this.companyReadPort, auditMeta.actor, input.companyId)
    const opportunity = await this.opportunityReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'opportunity.created',
      entityType: 'opportunity',
      entityId: opportunity.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: opportunity as unknown as Record<string, unknown>,
    })
    return opportunity
  }

  async updateOpportunity(id: string, input: Partial<Opportunity>, auditMeta: AuditMetadata) {
    const previous = await this.opportunityReadPort.findById(id)
    const targetCompanyId = input.companyId ?? previous?.companyId
    if (targetCompanyId) {
      await assertCompanyAccess(this.companyReadPort, auditMeta.actor, targetCompanyId)
    }
    const opportunity = await this.opportunityReadPort.update(id, input)

    if (!opportunity) return null

    const previousState = (previous as unknown as Record<string, unknown>) ?? undefined
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'opportunity.updated',
      entityType: 'opportunity',
      entityId: opportunity.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState,
      newState: opportunity as unknown as Record<string, unknown>,
    })

    if (previous && input.stage && previous.stage !== opportunity.stage) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'opportunity.stage-changed',
        entityType: 'opportunity',
        entityId: opportunity.id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: { stage: previous.stage } as Record<string, unknown>,
        newState: { stage: opportunity.stage } as Record<string, unknown>,
      })
    }

    return opportunity
  }

  async deleteOpportunity(id: string, auditMeta: AuditMetadata) {
    const previous = await this.opportunityReadPort.findById(id)
    if (previous?.companyId) {
      await assertCompanyAccess(this.companyReadPort, auditMeta.actor, previous.companyId)
    }
    const deleted = await this.opportunityReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'opportunity.deleted',
        entityType: 'opportunity',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }
}

export class CampaignFacade {
  constructor(
    private readonly campaignReadPort: CampaignReadPort,
    private readonly audit: AuditService,
  ) {}

  async getCampaign(id: string) {
    return this.campaignReadPort.findById(id)
  }

  async listCampaigns(params?: { status?: Campaign['status']; type?: Campaign['type']; ownerId?: string } & PageQuery) {
    return this.campaignReadPort.list(params)
  }

  async listByOwner(ownerId: string, params?: PageQuery) {
    return this.campaignReadPort.listByOwner(ownerId, params)
  }

  async createCampaign(input: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    assertSelfScoped(auditMeta.actor, 'ownerId', input.ownerId)
    const campaign = await this.campaignReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'campaign.created',
      entityType: 'campaign',
      entityId: campaign.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: campaign as unknown as Record<string, unknown>,
    })
    return campaign
  }

  async updateCampaign(id: string, input: Partial<Campaign>, auditMeta: AuditMetadata) {
    const previous = await this.campaignReadPort.findById(id)
    assertSelfScoped(auditMeta.actor, 'ownerId', input.ownerId ?? previous?.ownerId)
    const campaign = await this.campaignReadPort.update(id, input)

    if (!campaign) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'campaign.updated',
      entityType: 'campaign',
      entityId: campaign.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: campaign as unknown as Record<string, unknown>,
    })
    return campaign
  }

  async deleteCampaign(id: string, auditMeta: AuditMetadata) {
    const previous = await this.campaignReadPort.findById(id)
    if (previous) assertSelfScoped(auditMeta.actor, 'ownerId', previous.ownerId)
    const deleted = await this.campaignReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'campaign.deleted',
        entityType: 'campaign',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }
}

export class CampaignStepFacade {
  constructor(
    private readonly campaignStepReadPort: CampaignStepReadPort,
    private readonly campaignReadPort: CampaignReadPort,
    private readonly audit: AuditService,
  ) {}

  private async assertCampaignAccess(campaignId: string, actor: AuditMetadata['actor']) {
    if (!actor) throw forbidden('No authenticated actor')
    if (isPrivileged(actor)) return
    const campaign = await this.campaignReadPort.findById(campaignId)
    if (!campaign) {
      throw new HttpError(404, 'CAMPAIGN_NOT_FOUND', `Campaign ${campaignId} was not found`)
    }
    if (campaign.ownerId === actor.id) return
    throw forbidden('You do not have access to this campaign')
  }

  async getStep(id: string) {
    return this.campaignStepReadPort.findById(id)
  }

  async listByCampaign(campaignId: string, params?: PageQuery) {
    return this.campaignStepReadPort.listByCampaign(campaignId, params)
  }

  async createStep(input: Omit<CampaignStep, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    await this.assertCampaignAccess(input.campaignId, auditMeta.actor)
    const step = await this.campaignStepReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'campaign-step.created',
      entityType: 'campaign-step',
      entityId: step.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: step as unknown as Record<string, unknown>,
    })
    return step
  }

  async updateStep(id: string, input: Partial<CampaignStep>, auditMeta: AuditMetadata) {
    const previous = await this.campaignStepReadPort.findById(id)
    await this.assertCampaignAccess(input.campaignId ?? previous?.campaignId ?? '', auditMeta.actor)
    const step = await this.campaignStepReadPort.update(id, input)

    if (!step) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'campaign-step.updated',
      entityType: 'campaign-step',
      entityId: step.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: step as unknown as Record<string, unknown>,
    })
    return step
  }

  async deleteStep(id: string, auditMeta: AuditMetadata) {
    const previous = await this.campaignStepReadPort.findById(id)
    if (previous) await this.assertCampaignAccess(previous.campaignId, auditMeta.actor)
    const deleted = await this.campaignStepReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'campaign-step.deleted',
        entityType: 'campaign-step',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }
}

export class FollowUpFacade {
  constructor(
    private readonly followUpReadPort: FollowUpReadPort,
    private readonly audit: AuditService,
    private readonly activityReadPort: ActivityReadPort,
    private readonly companyReadPort: CompanyReadPort,
  ) {}

  private async assertFollowUpAccess(activityId: string, ownerId: string | undefined, actor: AuditMetadata['actor']) {
    if (!actor) throw forbidden('No authenticated actor')
    if (isPrivileged(actor)) return
    const activity = await this.activityReadPort.findById(activityId)
    if (activity?.companyId) {
      await assertCompanyAccess(this.companyReadPort, actor, activity.companyId)
      return
    }
    assertSelfScoped(actor, 'ownerId', ownerId)
  }

  async getFollowUp(id: string) {
    return this.followUpReadPort.findById(id)
  }

  async listFollowUps(params?: { status?: FollowUp['status']; ownerId?: string } & PageQuery) {
    return this.followUpReadPort.list(params)
  }

  async listByActivity(activityId: string, params?: PageQuery) {
    return this.followUpReadPort.listByActivity(activityId, params)
  }

  async createFollowUp(input: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    await this.assertFollowUpAccess(input.activityId, input.ownerId, auditMeta.actor)
    const followUp = await this.followUpReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'follow-up.created',
      entityType: 'follow-up',
      entityId: followUp.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: followUp as unknown as Record<string, unknown>,
    })
    return followUp
  }

  async updateFollowUp(id: string, input: Partial<FollowUp>, auditMeta: AuditMetadata) {
    const previous = await this.followUpReadPort.findById(id)
    await this.assertFollowUpAccess(input.activityId ?? previous?.activityId ?? '', input.ownerId ?? previous?.ownerId, auditMeta.actor)
    const followUp = await this.followUpReadPort.update(id, input)

    if (!followUp) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'follow-up.updated',
      entityType: 'follow-up',
      entityId: followUp.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: followUp as unknown as Record<string, unknown>,
    })
    return followUp
  }

  async deleteFollowUp(id: string, auditMeta: AuditMetadata) {
    const previous = await this.followUpReadPort.findById(id)
    if (previous) await this.assertFollowUpAccess(previous.activityId, previous.ownerId, auditMeta.actor)
    const deleted = await this.followUpReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'follow-up.deleted',
        entityType: 'follow-up',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }

    return deleted
  }
}

export class ContributorFacade {
  constructor(
    private readonly contributorReadPort: ContributorReadPort,
    private readonly audit: AuditService,
  ) {}

  private async assertWriteAccess(actor: AuditMetadata['actor']) {
    if (!actor) throw forbidden('No authenticated actor')
    if (isPrivileged(actor)) return
    throw forbidden('Only admins and managers can manage ecosystem data')
  }

  async getContributor(id: string) {
    return this.contributorReadPort.findById(id)
  }

  async listContributors(params?: {
    status?: Contributor['status']
    role?: Contributor['role']
    communityId?: string
  } & PageQuery) {
    return this.contributorReadPort.list(params)
  }

  async createContributor(input: Omit<Contributor, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const contributor = await this.contributorReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'contributor.created',
      entityType: 'contributor',
      entityId: contributor.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: contributor as unknown as Record<string, unknown>,
    })
    return contributor
  }

  async updateContributor(id: string, input: Partial<Contributor>, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const previous = await this.contributorReadPort.findById(id)
    const contributor = await this.contributorReadPort.update(id, input)

    if (!contributor) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'contributor.updated',
      entityType: 'contributor',
      entityId: contributor.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: contributor as unknown as Record<string, unknown>,
    })
    return contributor
  }

  async deleteContributor(id: string, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const previous = await this.contributorReadPort.findById(id)
    const deleted = await this.contributorReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'contributor.deleted',
        entityType: 'contributor',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }
    return deleted
  }
}

export class PartnerFacade {
  constructor(
    private readonly partnerReadPort: PartnerReadPort,
    private readonly audit: AuditService,
  ) {}

  private async assertWriteAccess(actor: AuditMetadata['actor']) {
    if (!actor) throw forbidden('No authenticated actor')
    if (isPrivileged(actor)) return
    throw forbidden('Only admins and managers can manage ecosystem data')
  }

  async getPartner(id: string) {
    return this.partnerReadPort.findById(id)
  }

  async listPartners(params?: {
    status?: Partner['status']
    partnerType?: Partner['partnerType']
  } & PageQuery) {
    return this.partnerReadPort.list(params)
  }

  async createPartner(input: Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const partner = await this.partnerReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'partner.created',
      entityType: 'partner',
      entityId: partner.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: partner as unknown as Record<string, unknown>,
    })
    return partner
  }

  async updatePartner(id: string, input: Partial<Partner>, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const previous = await this.partnerReadPort.findById(id)
    const partner = await this.partnerReadPort.update(id, input)

    if (!partner) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'partner.updated',
      entityType: 'partner',
      entityId: partner.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: partner as unknown as Record<string, unknown>,
    })
    return partner
  }

  async deletePartner(id: string, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const previous = await this.partnerReadPort.findById(id)
    const deleted = await this.partnerReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'partner.deleted',
        entityType: 'partner',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }
    return deleted
  }
}

export class CommunityFacade {
  constructor(
    private readonly communityReadPort: CommunityReadPort,
    private readonly audit: AuditService,
  ) {}

  private async assertWriteAccess(actor: AuditMetadata['actor']) {
    if (!actor) throw forbidden('No authenticated actor')
    if (isPrivileged(actor)) return
    throw forbidden('Only admins and managers can manage ecosystem data')
  }

  async getCommunity(id: string) {
    return this.communityReadPort.findById(id)
  }

  async listCommunities(params?: { status?: Community['status'] } & PageQuery) {
    return this.communityReadPort.list(params)
  }

  async createCommunity(input: Omit<Community, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const community = await this.communityReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'community.created',
      entityType: 'community',
      entityId: community.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: community as unknown as Record<string, unknown>,
    })
    return community
  }

  async updateCommunity(id: string, input: Partial<Community>, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const previous = await this.communityReadPort.findById(id)
    const community = await this.communityReadPort.update(id, input)

    if (!community) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'community.updated',
      entityType: 'community',
      entityId: community.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: community as unknown as Record<string, unknown>,
    })
    return community
  }

  async deleteCommunity(id: string, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const previous = await this.communityReadPort.findById(id)
    const deleted = await this.communityReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'community.deleted',
        entityType: 'community',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }
    return deleted
  }
}

export class InvestorFacade {
  constructor(
    private readonly investorReadPort: InvestorReadPort,
    private readonly audit: AuditService,
  ) {}

  private async assertWriteAccess(actor: AuditMetadata['actor']) {
    if (!actor) throw forbidden('No authenticated actor')
    if (isPrivileged(actor)) return
    throw forbidden('Only admins and managers can manage ecosystem data')
  }

  async getInvestor(id: string) {
    return this.investorReadPort.findById(id)
  }

  async listInvestors(params?: {
    status?: Investor['status']
    investorType?: Investor['investorType']
  } & PageQuery) {
    return this.investorReadPort.list(params)
  }

  async createInvestor(input: Omit<Investor, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const investor = await this.investorReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'investor.created',
      entityType: 'investor',
      entityId: investor.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: investor as unknown as Record<string, unknown>,
    })
    return investor
  }

  async updateInvestor(id: string, input: Partial<Investor>, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const previous = await this.investorReadPort.findById(id)
    const investor = await this.investorReadPort.update(id, input)

    if (!investor) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'investor.updated',
      entityType: 'investor',
      entityId: investor.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: investor as unknown as Record<string, unknown>,
    })
    return investor
  }

  async deleteInvestor(id: string, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const previous = await this.investorReadPort.findById(id)
    const deleted = await this.investorReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'investor.deleted',
        entityType: 'investor',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }
    return deleted
  }
}

export class UseCaseFacade {
  constructor(
    private readonly useCaseReadPort: UseCaseReadPort,
    private readonly audit: AuditService,
  ) {}

  private async assertWriteAccess(actor: AuditMetadata['actor']) {
    if (!actor) throw forbidden('No authenticated actor')
    if (isPrivileged(actor)) return
    throw forbidden('Only admins and managers can manage use cases')
  }

  async getUseCase(id: string) {
    return this.useCaseReadPort.findById(id)
  }

  async listUseCases(params?: { opportunityId?: string; ownerId?: string } & PageQuery) {
    return this.useCaseReadPort.list(params)
  }

  async listByOpportunity(opportunityId: string, params?: PageQuery) {
    return this.useCaseReadPort.listByOpportunity(opportunityId, params)
  }

  async createUseCase(input: Omit<UseCase, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const useCase = await this.useCaseReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'use-case.created',
      entityType: 'use-case',
      entityId: useCase.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: useCase as unknown as Record<string, unknown>,
    })
    return useCase
  }

  async updateUseCase(id: string, input: Partial<UseCase>, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const previous = await this.useCaseReadPort.findById(id)
    const useCase = await this.useCaseReadPort.update(id, input)

    if (!useCase) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'use-case.updated',
      entityType: 'use-case',
      entityId: useCase.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: useCase as unknown as Record<string, unknown>,
    })
    return useCase
  }

  async deleteUseCase(id: string, auditMeta: AuditMetadata) {
    await this.assertWriteAccess(auditMeta.actor)
    const previous = await this.useCaseReadPort.findById(id)
    const deleted = await this.useCaseReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'use-case.deleted',
        entityType: 'use-case',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }
    return deleted
  }
}

export class PipelineAnalyticsFacade {
  constructor(private readonly analyticsReadPort: PipelineAnalyticsReadPort) {}

  async getPipelineAnalytics(): Promise<PipelineAnalyticsSummary> {
    return this.analyticsReadPort.getPipelineAnalytics()
  }

  async getCampaignAnalytics(): Promise<CampaignAnalyticsSummary> {
    return this.analyticsReadPort.getCampaignAnalytics()
  }

  async getFollowUpAnalytics(): Promise<FollowUpAnalyticsSummary> {
    return this.analyticsReadPort.getFollowUpAnalytics()
  }
}

export class AuditFacade {
  constructor(private readonly auditReadPort: AuditReadPort) {}

  async list(params: {
    entityType?: string
    entityId?: string
    actorId?: string
    requestId?: string
    limit: number
    offset: number
  }): Promise<{ events: AuditEvent[]; total: number }> {
    return this.auditReadPort.list(params)
  }
}

export class PolicyRuleFacade {
  constructor(
    private readonly policyRuleReadPort: PolicyRuleReadPort,
    private readonly audit: AuditService,
  ) {}

  private async assertAdmin(actor: AuditMetadata['actor']) {
    if (!actor) throw forbidden('No authenticated actor')
    const isAdmin = actor.roles.includes('admin')
    if (!isAdmin) throw forbidden('Only admins can manage policy rules')
  }

  async getPolicyRule(id: string) {
    return this.policyRuleReadPort.findById(id)
  }

  async listPolicyRules(params?: { resource?: string; action?: string; enabled?: boolean } & PageQuery) {
    return this.policyRuleReadPort.list(params)
  }

  async createPolicyRule(input: Omit<PolicyRule, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    await this.assertAdmin(auditMeta.actor)
    const rule = await this.policyRuleReadPort.create(input)
    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'policy-rule.created',
      entityType: 'policy-rule',
      entityId: rule.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      newState: rule as unknown as Record<string, unknown>,
    })
    return rule
  }

  async updatePolicyRule(id: string, input: Partial<PolicyRule>, auditMeta: AuditMetadata) {
    await this.assertAdmin(auditMeta.actor)
    const previous = await this.policyRuleReadPort.findById(id)
    const rule = await this.policyRuleReadPort.update(id, input)

    if (!rule) return null

    await auditSafely(this.audit, {
      actorId: auditMeta.actorId,
      action: 'policy-rule.updated',
      entityType: 'policy-rule',
      entityId: rule.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: (previous as unknown as Record<string, unknown>) ?? undefined,
      newState: rule as unknown as Record<string, unknown>,
    })
    return rule
  }

  async deletePolicyRule(id: string, auditMeta: AuditMetadata) {
    await this.assertAdmin(auditMeta.actor)
    const previous = await this.policyRuleReadPort.findById(id)
    const deleted = await this.policyRuleReadPort.delete(id)

    if (deleted && previous) {
      await auditSafely(this.audit, {
        actorId: auditMeta.actorId,
        action: 'policy-rule.deleted',
        entityType: 'policy-rule',
        entityId: id,
        requestId: auditMeta.requestId,
        result: 'SUCCESS',
        previousState: previous as unknown as Record<string, unknown>,
      })
    }
    return deleted
  }
}

export class GoGateFacade {
  constructor(private readonly gate: GoGateService) {}

  async getRequest(id: string) {
    return this.gate.getRequest(id)
  }

  async listRequests(params?: { status?: GoGateRequest['status']; actionType?: GoGateRequest['actionType'] } & PageQuery) {
    return this.gate.listRequests(params)
  }

  async requestExecution(input: Parameters<GoGateService['requestExecution']>[0]) {
    return this.gate.requestExecution(input)
  }

  async approve(id: string, approver: Parameters<GoGateService['approve']>[1], input: Parameters<GoGateService['approve']>[2]) {
    return this.gate.approve(id, approver, input)
  }

  async reject(id: string, approver: Parameters<GoGateService['reject']>[1], input: Parameters<GoGateService['reject']>[2]) {
    return this.gate.reject(id, approver, input)
  }

  async execute(id: string, executor: Parameters<GoGateService['execute']>[1], meta: Parameters<GoGateService['execute']>[2]) {
    return this.gate.execute(id, executor, meta)
  }
}