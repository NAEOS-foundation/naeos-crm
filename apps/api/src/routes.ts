import { Router } from 'express'
import type { Request, Response } from 'express'
import { AuditService } from '@naeos-crm/audit'
import { DefaultAuthorizationService } from '@naeos-crm/auth'
import {
  buildErrorResponse,
  buildPaginatedMeta,
  buildSuccessMeta,
} from '@naeos-crm/shared'

import {
  ActivityFacade,
  AuditFacade,
  CampaignFacade,
  CampaignStepFacade,
  CommunityFacade,
  CompanyFacade,
  ContactFacade,
  ContributorFacade,
  DashboardFacade,
  FollowUpFacade,
  InvestorFacade,
  LeadFacade,
  OpportunityFacade,
  PartnerFacade,
  PipelineAnalyticsFacade,
  PipelineStageFacade,
  TaskFacade,
  UseCaseFacade,
  UserFacade,
} from './service-layer'
import {
  PrismaActivityReadPort,
  PrismaAuditReadPort,
  PrismaAuditSink,
  PrismaCampaignReadPort,
  PrismaCampaignStepReadPort,
  PrismaCommunityReadPort,
  PrismaCompanyReadPort,
  PrismaContactReadPort,
  PrismaContributorReadPort,
  PrismaDashboardReadPort,
  PrismaFollowUpReadPort,
  PrismaInvestorReadPort,
  PrismaLeadReadPort,
  PrismaOpportunityReadPort,
  PrismaPartnerReadPort,
  PrismaPipelineAnalyticsReadPort,
  PrismaPipelineStageReadPort,
  PrismaTaskReadPort,
  PrismaUseCaseReadPort,
  PrismaUserReadPort,
} from './prisma-ports'
import { ApiAuthGuard } from './auth'
import { asyncHandler } from './middleware'
import {
  auditQuerySchema,
  campaignQuerySchema,
  communityQuerySchema,
  companyQuerySchema,
  contributorQuerySchema,
  createActivitySchema,
  createCampaignSchema,
  createCampaignStepNestedSchema,
  createCommunitySchema,
  createCompanySchema,
  createContactSchema,
  createContributorSchema,
  createFollowUpSchema,
  createInvestorSchema,
  createLeadSchema,
  createOpportunitySchema,
  createPartnerSchema,
  createPipelineStageSchema,
  createTaskSchema,
  createUseCaseSchema,
  createUserSchema,
  followUpQuerySchema,
  idParamSchema,
  investorQuerySchema,
  listByCompanyQuerySchema,
  opportunityQuerySchema,
  partnerQuerySchema,
  reorderPipelineStagesSchema,
  updateActivitySchema,
  updateCampaignSchema,
  updateCampaignStepSchema,
  updateCommunitySchema,
  updateCompanySchema,
  updateContactSchema,
  updateContributorSchema,
  updateFollowUpSchema,
  updateInvestorSchema,
  updateLeadSchema,
  updateOpportunitySchema,
  updatePartnerSchema,
  updatePipelineStageSchema,
  updateTaskSchema,
  updateUseCaseSchema,
  updateUserSchema,
  useCaseQuerySchema,
} from './validation'

const auditSink = new PrismaAuditSink()
const auditService = new AuditService(auditSink, new PrismaAuditReadPort())

const companyReadPort = new PrismaCompanyReadPort()
const activityReadPort = new PrismaActivityReadPort()
const userFacade = new UserFacade(new PrismaUserReadPort(), auditService)
const companyFacade = new CompanyFacade(companyReadPort, auditService)
const contactFacade = new ContactFacade(new PrismaContactReadPort(), auditService, companyReadPort)
const leadFacade = new LeadFacade(new PrismaLeadReadPort(), auditService)
const activityFacade = new ActivityFacade(activityReadPort, auditService, companyReadPort)
const taskFacade = new TaskFacade(new PrismaTaskReadPort(), auditService, companyReadPort)
const pipelineStageFacade = new PipelineStageFacade(new PrismaPipelineStageReadPort(), auditService)
const opportunityFacade = new OpportunityFacade(new PrismaOpportunityReadPort(), auditService, companyReadPort)
const campaignReadPort = new PrismaCampaignReadPort()
const campaignStepReadPort = new PrismaCampaignStepReadPort()
const campaignFacade = new CampaignFacade(campaignReadPort, auditService)
const campaignStepFacade = new CampaignStepFacade(campaignStepReadPort, campaignReadPort, auditService)
const followUpFacade = new FollowUpFacade(
  new PrismaFollowUpReadPort(),
  auditService,
  activityReadPort,
  companyReadPort,
)
const analyticsFacade = new PipelineAnalyticsFacade(new PrismaPipelineAnalyticsReadPort())
const dashboardFacade = new DashboardFacade(new PrismaDashboardReadPort())
const auditFacade = new AuditFacade(new PrismaAuditReadPort())
const contributorFacade = new ContributorFacade(new PrismaContributorReadPort(), auditService)
const partnerFacade = new PartnerFacade(new PrismaPartnerReadPort(), auditService)
const communityFacade = new CommunityFacade(new PrismaCommunityReadPort(), auditService)
const investorFacade = new InvestorFacade(new PrismaInvestorReadPort(), auditService)
const useCaseFacade = new UseCaseFacade(new PrismaUseCaseReadPort(), auditService)

const guard = new ApiAuthGuard(new DefaultAuthorizationService())

export const router = Router()

type Role = 'admin' | 'manager' | 'member'
const toAuthRole = (role: string): Role => {
  const normalized = role.toLowerCase()
  if (normalized === 'admin' || normalized === 'manager' || normalized === 'member') {
    return normalized
  }
  return 'member'
}

async function requireAuth(
  req: Request,
  res: Response,
  resource: string,
  action: string,
): Promise<boolean> {
  if (!req.actor) {
    res.status(401).json(buildErrorResponse('UNAUTHORIZED', 'Authentication required', req.requestId))
    return false
  }

  const actor = {
    id: req.actor.id,
    email: req.actor.email,
    roles: req.actor.roles.map(toAuthRole),
  }

  const decision = guard.authorize({ actor }, resource, action)

  if (!decision.allow) {
    try {
      await auditService.record({
        actorId: req.actor.id,
        actorType: 'user',
        action: `${resource}.${action}`,
        entityType: resource,
        entityId: req.params.id ?? 'unknown',
        requestId: req.requestId,
        source: 'api',
        result: 'FAILURE',
        reason: decision.reason,
        policyVersion: decision.policyVersion,
        authorization: { allowed: false, reason: decision.reason },
      })
    } catch (err) {
      console.error('[audit] Failed to record denial', err)
    }
    res.status(403).json(buildErrorResponse('FORBIDDEN', `Permission denied for ${resource}:${action}`, req.requestId))
    return false
  }

  return true
}

function auditMeta(req: Request) {
  return {
    actorId: req.actor?.id,
    requestId: req.requestId,
    actor: req.actor,
  }
}

// ---------- Current actor ----------

router.get('/api/v1/me', asyncHandler(async (req, res) => {
  if (!req.actor) {
    res.status(401).json(buildErrorResponse('UNAUTHORIZED', 'Authentication required', req.requestId))
    return
  }
  res.json({ data: req.actor, meta: buildSuccessMeta(req.requestId) })
}))

// ---------- Users ----------

router.get('/api/v1/users', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'user', 'read'))) return
  const users = await userFacade.listUsers()
  res.json({ data: users, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/users/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'user', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const user = await userFacade.getUser(id)
  if (!user) {
    res.status(404).json(buildErrorResponse('USER_NOT_FOUND', `User ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: user, meta: buildSuccessMeta(req.requestId) })
}))

router.post('/api/v1/users', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'user', 'write'))) return
  const input = createUserSchema.parse(req.body)
  const user = await userFacade.createUser(input, auditMeta(req))
  res.status(201).json({ data: user, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/users/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'user', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateUserSchema.parse(req.body)
  const user = await userFacade.updateUser(id, input, auditMeta(req))
  if (!user) {
    res.status(404).json(buildErrorResponse('USER_NOT_FOUND', `User ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: user, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/users/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'user', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await userFacade.deleteUser(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('USER_NOT_FOUND', `User ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Companies ----------

router.get('/api/v1/companies', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'company', 'read'))) return
  const query = companyQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const { data, total } = await companyFacade.listCompanies({
    status: query.status,
    limit: query.limit,
    offset,
  })
  res.json({ data, meta: buildPaginatedMeta(req.requestId, total, query.limit, offset) })
}))

router.post('/api/v1/companies', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'company', 'write'))) return
  const input = createCompanySchema.parse(req.body)
  const company = await companyFacade.createCompany(input, auditMeta(req))
  res.status(201).json({ data: company, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/companies/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'company', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const company = await companyFacade.getCompany(id)
  if (!company) {
    res.status(404).json(buildErrorResponse('COMPANY_NOT_FOUND', `Company ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: company, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/companies/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'company', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateCompanySchema.parse(req.body)
  const company = await companyFacade.updateCompany(id, input, auditMeta(req))
  if (!company) {
    res.status(404).json(buildErrorResponse('COMPANY_NOT_FOUND', `Company ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: company, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/companies/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'company', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await companyFacade.deleteCompany(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('COMPANY_NOT_FOUND', `Company ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Contacts ----------

router.get('/api/v1/contacts', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'contact', 'read'))) return
  const query = listByCompanyQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const result = query.companyId
    ? await contactFacade.listByCompany(query.companyId, { limit: query.limit, offset })
    : await contactFacade.listContacts({ limit: query.limit, offset })
  res.json({ data: result.data, meta: buildPaginatedMeta(req.requestId, result.total, query.limit, offset) })
}))

router.post('/api/v1/contacts', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'contact', 'write'))) return
  const input = createContactSchema.parse(req.body)
  const contact = await contactFacade.createContact(input, auditMeta(req))
  res.status(201).json({ data: contact, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/contacts/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'contact', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const contact = await contactFacade.getContact(id)
  if (!contact) {
    res.status(404).json(buildErrorResponse('CONTACT_NOT_FOUND', `Contact ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: contact, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/contacts/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'contact', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateContactSchema.parse(req.body)
  const contact = await contactFacade.updateContact(id, input, auditMeta(req))
  if (!contact) {
    res.status(404).json(buildErrorResponse('CONTACT_NOT_FOUND', `Contact ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: contact, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/contacts/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'contact', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await contactFacade.deleteContact(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('CONTACT_NOT_FOUND', `Contact ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Leads ----------

router.get('/api/v1/leads', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'lead', 'read'))) return
  const query = listByCompanyQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const result = query.companyId
    ? await leadFacade.listByCompany(query.companyId, { limit: query.limit, offset })
    : await leadFacade.listLeads({ limit: query.limit, offset })
  res.json({ data: result.data, meta: buildPaginatedMeta(req.requestId, result.total, query.limit, offset) })
}))

router.post('/api/v1/leads', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'lead', 'write'))) return
  const input = createLeadSchema.parse(req.body)
  const lead = await leadFacade.createLead(input, auditMeta(req))
  res.status(201).json({ data: lead, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/leads/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'lead', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const lead = await leadFacade.getLead(id)
  if (!lead) {
    res.status(404).json(buildErrorResponse('LEAD_NOT_FOUND', `Lead ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: lead, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/leads/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'lead', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateLeadSchema.parse(req.body)
  const lead = await leadFacade.updateLead(id, input, auditMeta(req))
  if (!lead) {
    res.status(404).json(buildErrorResponse('LEAD_NOT_FOUND', `Lead ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: lead, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/leads/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'lead', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await leadFacade.deleteLead(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('LEAD_NOT_FOUND', `Lead ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Activities ----------

router.get('/api/v1/activities', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'activity', 'read'))) return
  const query = listByCompanyQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const result = query.companyId
    ? await activityFacade.listByCompany(query.companyId, { limit: query.limit, offset })
    : await activityFacade.listActivities({ limit: query.limit, offset })
  res.json({ data: result.data, meta: buildPaginatedMeta(req.requestId, result.total, query.limit, offset) })
}))

router.post('/api/v1/activities', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'activity', 'write'))) return
  const input = createActivitySchema.parse(req.body)
  const activity = await activityFacade.createActivity(input, auditMeta(req))
  res.status(201).json({ data: activity, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/activities/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'activity', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const activity = await activityFacade.getActivity(id)
  if (!activity) {
    res.status(404).json(buildErrorResponse('ACTIVITY_NOT_FOUND', `Activity ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: activity, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/activities/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'activity', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateActivitySchema.parse(req.body)
  const activity = await activityFacade.updateActivity(id, input, auditMeta(req))
  if (!activity) {
    res.status(404).json(buildErrorResponse('ACTIVITY_NOT_FOUND', `Activity ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: activity, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/activities/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'activity', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await activityFacade.deleteActivity(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('ACTIVITY_NOT_FOUND', `Activity ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Tasks ----------

router.get('/api/v1/tasks', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'task', 'read'))) return
  const query = listByCompanyQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const result = query.companyId
    ? await taskFacade.listByCompany(query.companyId, { limit: query.limit, offset })
    : await taskFacade.listTasks({ limit: query.limit, offset })
  res.json({ data: result.data, meta: buildPaginatedMeta(req.requestId, result.total, query.limit, offset) })
}))

router.post('/api/v1/tasks', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'task', 'write'))) return
  const input = createTaskSchema.parse(req.body)
  const task = await taskFacade.createTask(input, auditMeta(req))
  res.status(201).json({ data: task, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/tasks/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'task', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const task = await taskFacade.getTask(id)
  if (!task) {
    res.status(404).json(buildErrorResponse('TASK_NOT_FOUND', `Task ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: task, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/tasks/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'task', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateTaskSchema.parse(req.body)
  const task = await taskFacade.updateTask(id, input, auditMeta(req))
  if (!task) {
    res.status(404).json(buildErrorResponse('TASK_NOT_FOUND', `Task ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: task, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/tasks/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'task', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await taskFacade.deleteTask(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('TASK_NOT_FOUND', `Task ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Pipeline stages ----------

router.get('/api/v1/pipeline-stages', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'pipeline', 'read'))) return
  const { data } = await pipelineStageFacade.listStages()
  res.json({ data, meta: buildSuccessMeta(req.requestId) })
}))

router.post('/api/v1/pipeline-stages', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'pipeline', 'write'))) return
  const input = createPipelineStageSchema.parse(req.body)
  const stage = await pipelineStageFacade.createStage(input, auditMeta(req))
  res.status(201).json({ data: stage, meta: buildSuccessMeta(req.requestId) })
}))

router.post('/api/v1/pipeline-stages/reorder', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'pipeline', 'write'))) return
  const { orderedIds } = reorderPipelineStagesSchema.parse(req.body)
  const stages = await pipelineStageFacade.reorderStages(orderedIds, auditMeta(req))
  res.json({ data: stages, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/pipeline-stages/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'pipeline', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const stage = await pipelineStageFacade.getStage(id)
  if (!stage) {
    res.status(404).json(buildErrorResponse('PIPELINE_STAGE_NOT_FOUND', `Pipeline stage ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: stage, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/pipeline-stages/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'pipeline', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updatePipelineStageSchema.parse(req.body)
  const stage = await pipelineStageFacade.updateStage(id, input, auditMeta(req))
  if (!stage) {
    res.status(404).json(buildErrorResponse('PIPELINE_STAGE_NOT_FOUND', `Pipeline stage ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: stage, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/pipeline-stages/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'pipeline', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await pipelineStageFacade.deleteStage(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('PIPELINE_STAGE_NOT_FOUND', `Pipeline stage ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Opportunities ----------

router.get('/api/v1/opportunities', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'opportunity', 'read'))) return
  const query = opportunityQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const { data, total } = await opportunityFacade.listOpportunities({
    stage: query.stage,
    companyId: query.companyId,
    ownerId: query.ownerId,
    limit: query.limit,
    offset,
  })
  res.json({ data, meta: buildPaginatedMeta(req.requestId, total, query.limit, offset) })
}))

router.post('/api/v1/opportunities', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'opportunity', 'write'))) return
  const input = createOpportunitySchema.parse(req.body)
  const opportunity = await opportunityFacade.createOpportunity(input, auditMeta(req))
  res.status(201).json({ data: opportunity, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/opportunities/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'opportunity', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const opportunity = await opportunityFacade.getOpportunity(id)
  if (!opportunity) {
    res.status(404).json(buildErrorResponse('OPPORTUNITY_NOT_FOUND', `Opportunity ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: opportunity, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/opportunities/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'opportunity', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateOpportunitySchema.parse(req.body)
  const opportunity = await opportunityFacade.updateOpportunity(id, input, auditMeta(req))
  if (!opportunity) {
    res.status(404).json(buildErrorResponse('OPPORTUNITY_NOT_FOUND', `Opportunity ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: opportunity, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/opportunities/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'opportunity', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await opportunityFacade.deleteOpportunity(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('OPPORTUNITY_NOT_FOUND', `Opportunity ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Campaigns ----------

router.get('/api/v1/campaigns', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'campaign', 'read'))) return
  const query = campaignQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const { data, total } = await campaignFacade.listCampaigns({
    status: query.status,
    type: query.type,
    ownerId: query.ownerId,
    limit: query.limit,
    offset,
  })
  res.json({ data, meta: buildPaginatedMeta(req.requestId, total, query.limit, offset) })
}))

router.post('/api/v1/campaigns', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'campaign', 'write'))) return
  const input = createCampaignSchema.parse(req.body)
  const campaign = await campaignFacade.createCampaign(input, auditMeta(req))
  res.status(201).json({ data: campaign, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/campaigns/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'campaign', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const campaign = await campaignFacade.getCampaign(id)
  if (!campaign) {
    res.status(404).json(buildErrorResponse('CAMPAIGN_NOT_FOUND', `Campaign ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: campaign, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/campaigns/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'campaign', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateCampaignSchema.parse(req.body)
  const campaign = await campaignFacade.updateCampaign(id, input, auditMeta(req))
  if (!campaign) {
    res.status(404).json(buildErrorResponse('CAMPAIGN_NOT_FOUND', `Campaign ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: campaign, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/campaigns/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'campaign', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await campaignFacade.deleteCampaign(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('CAMPAIGN_NOT_FOUND', `Campaign ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Campaign steps (nested under campaigns) ----------

router.get('/api/v1/campaigns/:id/steps', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'campaign', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const { data } = await campaignStepFacade.listByCampaign(id)
  res.json({ data, meta: buildSuccessMeta(req.requestId) })
}))

router.post('/api/v1/campaigns/:id/steps', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'campaign', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = createCampaignStepNestedSchema.parse(req.body)
  const step = await campaignStepFacade.createStep({ ...input, campaignId: id }, auditMeta(req))
  res.status(201).json({ data: step, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/campaign-steps/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'campaign', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const step = await campaignStepFacade.getStep(id)
  if (!step) {
    res.status(404).json(buildErrorResponse('CAMPAIGN_STEP_NOT_FOUND', `Campaign step ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: step, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/campaign-steps/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'campaign', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateCampaignStepSchema.parse(req.body)
  const step = await campaignStepFacade.updateStep(id, input, auditMeta(req))
  if (!step) {
    res.status(404).json(buildErrorResponse('CAMPAIGN_STEP_NOT_FOUND', `Campaign step ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: step, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/campaign-steps/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'campaign', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await campaignStepFacade.deleteStep(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('CAMPAIGN_STEP_NOT_FOUND', `Campaign step ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Follow-ups ----------

router.get('/api/v1/follow-ups', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'follow-up', 'read'))) return
  const query = followUpQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const { data, total } = await followUpFacade.listFollowUps({
    status: query.status,
    ownerId: query.ownerId,
    limit: query.limit,
    offset,
  })
  res.json({ data, meta: buildPaginatedMeta(req.requestId, total, query.limit, offset) })
}))

router.post('/api/v1/follow-ups', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'follow-up', 'write'))) return
  const input = createFollowUpSchema.parse(req.body)
  const followUp = await followUpFacade.createFollowUp(input, auditMeta(req))
  res.status(201).json({ data: followUp, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/follow-ups/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'follow-up', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const followUp = await followUpFacade.getFollowUp(id)
  if (!followUp) {
    res.status(404).json(buildErrorResponse('FOLLOW_UP_NOT_FOUND', `Follow-up ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: followUp, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/follow-ups/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'follow-up', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateFollowUpSchema.parse(req.body)
  const followUp = await followUpFacade.updateFollowUp(id, input, auditMeta(req))
  if (!followUp) {
    res.status(404).json(buildErrorResponse('FOLLOW_UP_NOT_FOUND', `Follow-up ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: followUp, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/follow-ups/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'follow-up', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await followUpFacade.deleteFollowUp(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('FOLLOW_UP_NOT_FOUND', `Follow-up ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Contributors ----------

router.get('/api/v1/contributors', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'contributor', 'read'))) return
  const query = contributorQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const { data, total } = await contributorFacade.listContributors({
    status: query.status,
    role: query.role,
    communityId: query.communityId,
    limit: query.limit,
    offset,
  })
  res.json({ data, meta: buildPaginatedMeta(req.requestId, total, query.limit, offset) })
}))

router.post('/api/v1/contributors', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'contributor', 'write'))) return
  const input = createContributorSchema.parse(req.body)
  const contributor = await contributorFacade.createContributor(input, auditMeta(req))
  res.status(201).json({ data: contributor, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/contributors/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'contributor', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const contributor = await contributorFacade.getContributor(id)
  if (!contributor) {
    res.status(404).json(buildErrorResponse('CONTRIBUTOR_NOT_FOUND', `Contributor ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: contributor, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/contributors/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'contributor', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateContributorSchema.parse(req.body)
  const contributor = await contributorFacade.updateContributor(id, input, auditMeta(req))
  if (!contributor) {
    res.status(404).json(buildErrorResponse('CONTRIBUTOR_NOT_FOUND', `Contributor ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: contributor, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/contributors/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'contributor', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await contributorFacade.deleteContributor(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('CONTRIBUTOR_NOT_FOUND', `Contributor ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Partners ----------

router.get('/api/v1/partners', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'partner', 'read'))) return
  const query = partnerQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const { data, total } = await partnerFacade.listPartners({
    status: query.status,
    partnerType: query.partnerType,
    limit: query.limit,
    offset,
  })
  res.json({ data, meta: buildPaginatedMeta(req.requestId, total, query.limit, offset) })
}))

router.post('/api/v1/partners', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'partner', 'write'))) return
  const input = createPartnerSchema.parse(req.body)
  const partner = await partnerFacade.createPartner(input, auditMeta(req))
  res.status(201).json({ data: partner, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/partners/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'partner', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const partner = await partnerFacade.getPartner(id)
  if (!partner) {
    res.status(404).json(buildErrorResponse('PARTNER_NOT_FOUND', `Partner ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: partner, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/partners/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'partner', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updatePartnerSchema.parse(req.body)
  const partner = await partnerFacade.updatePartner(id, input, auditMeta(req))
  if (!partner) {
    res.status(404).json(buildErrorResponse('PARTNER_NOT_FOUND', `Partner ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: partner, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/partners/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'partner', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await partnerFacade.deletePartner(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('PARTNER_NOT_FOUND', `Partner ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Communities ----------

router.get('/api/v1/communities', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'community', 'read'))) return
  const query = communityQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const { data, total } = await communityFacade.listCommunities({
    status: query.status,
    limit: query.limit,
    offset,
  })
  res.json({ data, meta: buildPaginatedMeta(req.requestId, total, query.limit, offset) })
}))

router.post('/api/v1/communities', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'community', 'write'))) return
  const input = createCommunitySchema.parse(req.body)
  const community = await communityFacade.createCommunity(input, auditMeta(req))
  res.status(201).json({ data: community, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/communities/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'community', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const community = await communityFacade.getCommunity(id)
  if (!community) {
    res.status(404).json(buildErrorResponse('COMMUNITY_NOT_FOUND', `Community ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: community, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/communities/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'community', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateCommunitySchema.parse(req.body)
  const community = await communityFacade.updateCommunity(id, input, auditMeta(req))
  if (!community) {
    res.status(404).json(buildErrorResponse('COMMUNITY_NOT_FOUND', `Community ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: community, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/communities/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'community', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await communityFacade.deleteCommunity(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('COMMUNITY_NOT_FOUND', `Community ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Investors ----------

router.get('/api/v1/investors', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'investor', 'read'))) return
  const query = investorQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const { data, total } = await investorFacade.listInvestors({
    status: query.status,
    investorType: query.investorType,
    limit: query.limit,
    offset,
  })
  res.json({ data, meta: buildPaginatedMeta(req.requestId, total, query.limit, offset) })
}))

router.post('/api/v1/investors', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'investor', 'write'))) return
  const input = createInvestorSchema.parse(req.body)
  const investor = await investorFacade.createInvestor(input, auditMeta(req))
  res.status(201).json({ data: investor, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/investors/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'investor', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const investor = await investorFacade.getInvestor(id)
  if (!investor) {
    res.status(404).json(buildErrorResponse('INVESTOR_NOT_FOUND', `Investor ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: investor, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/investors/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'investor', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateInvestorSchema.parse(req.body)
  const investor = await investorFacade.updateInvestor(id, input, auditMeta(req))
  if (!investor) {
    res.status(404).json(buildErrorResponse('INVESTOR_NOT_FOUND', `Investor ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: investor, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/investors/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'investor', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await investorFacade.deleteInvestor(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('INVESTOR_NOT_FOUND', `Investor ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Use cases ----------

router.get('/api/v1/use-cases', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'use-case', 'read'))) return
  const query = useCaseQuerySchema.parse(req.query)
  const offset = (query.page - 1) * query.limit
  const { data, total } = await useCaseFacade.listUseCases({
    opportunityId: query.opportunityId,
    ownerId: query.ownerId,
    limit: query.limit,
    offset,
  })
  res.json({ data, meta: buildPaginatedMeta(req.requestId, total, query.limit, offset) })
}))

router.post('/api/v1/use-cases', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'use-case', 'write'))) return
  const input = createUseCaseSchema.parse(req.body)
  const useCase = await useCaseFacade.createUseCase(input, auditMeta(req))
  res.status(201).json({ data: useCase, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/use-cases/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'use-case', 'read'))) return
  const { id } = idParamSchema.parse(req.params)
  const useCase = await useCaseFacade.getUseCase(id)
  if (!useCase) {
    res.status(404).json(buildErrorResponse('USE_CASE_NOT_FOUND', `Use case ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: useCase, meta: buildSuccessMeta(req.requestId) })
}))

router.put('/api/v1/use-cases/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'use-case', 'write'))) return
  const { id } = idParamSchema.parse(req.params)
  const input = updateUseCaseSchema.parse(req.body)
  const useCase = await useCaseFacade.updateUseCase(id, input, auditMeta(req))
  if (!useCase) {
    res.status(404).json(buildErrorResponse('USE_CASE_NOT_FOUND', `Use case ${id} was not found`, req.requestId))
    return
  }
  res.json({ data: useCase, meta: buildSuccessMeta(req.requestId) })
}))

router.delete('/api/v1/use-cases/:id', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'use-case', 'delete'))) return
  const { id } = idParamSchema.parse(req.params)
  const deleted = await useCaseFacade.deleteUseCase(id, auditMeta(req))
  if (!deleted) {
    res.status(404).json(buildErrorResponse('USE_CASE_NOT_FOUND', `Use case ${id} was not found`, req.requestId))
    return
  }
  res.status(204).send()
}))

// ---------- Analytics ----------

router.get('/api/v1/analytics/pipeline', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'analytics', 'read'))) return
  const summary = await analyticsFacade.getPipelineAnalytics()
  res.json({ data: summary, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/analytics/campaigns', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'analytics', 'read'))) return
  const summary = await analyticsFacade.getCampaignAnalytics()
  res.json({ data: summary, meta: buildSuccessMeta(req.requestId) })
}))

router.get('/api/v1/analytics/follow-ups', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'analytics', 'read'))) return
  const summary = await analyticsFacade.getFollowUpAnalytics()
  res.json({ data: summary, meta: buildSuccessMeta(req.requestId) })
}))

// ---------- Dashboard ----------

router.get('/api/v1/dashboard', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'dashboard', 'read'))) return
  const summary = await dashboardFacade.getSummary()
  res.json({ data: summary, meta: buildSuccessMeta(req.requestId) })
}))

// ---------- Audit ----------

router.get('/api/v1/audit', asyncHandler(async (req, res) => {
  if (!(await requireAuth(req, res, 'audit', 'read'))) return
  const query = auditQuerySchema.parse(req.query)
  const { events, total } = await auditFacade.list({
    entityType: query.entityType,
    entityId: query.entityId,
    actorId: query.actorId,
    requestId: query.requestId,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  })
  res.json({ data: events, meta: buildPaginatedMeta(req.requestId, total, query.limit, (query.page - 1) * query.limit) })
}))