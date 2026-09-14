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
  CompanyFacade,
  ContactFacade,
  DashboardFacade,
  LeadFacade,
  TaskFacade,
  UserFacade,
} from './service-layer'
import {
  PrismaActivityReadPort,
  PrismaAuditReadPort,
  PrismaAuditSink,
  PrismaCompanyReadPort,
  PrismaContactReadPort,
  PrismaDashboardReadPort,
  PrismaLeadReadPort,
  PrismaTaskReadPort,
  PrismaUserReadPort,
} from './prisma-ports'
import { ApiAuthGuard } from './auth'
import { asyncHandler } from './middleware'
import {
  auditQuerySchema,
  companyQuerySchema,
  createActivitySchema,
  createCompanySchema,
  createContactSchema,
  createLeadSchema,
  createTaskSchema,
  createUserSchema,
  idParamSchema,
  listByCompanyQuerySchema,
  updateActivitySchema,
  updateCompanySchema,
  updateContactSchema,
  updateLeadSchema,
  updateTaskSchema,
  updateUserSchema,
} from './validation'

const auditSink = new PrismaAuditSink()
const auditService = new AuditService(auditSink, new PrismaAuditReadPort())

const userFacade = new UserFacade(new PrismaUserReadPort(), auditService)
const companyFacade = new CompanyFacade(new PrismaCompanyReadPort(), auditService)
const contactFacade = new ContactFacade(new PrismaContactReadPort(), auditService)
const leadFacade = new LeadFacade(new PrismaLeadReadPort(), auditService)
const activityFacade = new ActivityFacade(new PrismaActivityReadPort(), auditService)
const taskFacade = new TaskFacade(new PrismaTaskReadPort(), auditService)
const dashboardFacade = new DashboardFacade(new PrismaDashboardReadPort())
const auditFacade = new AuditFacade(new PrismaAuditReadPort())

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
    res.status(403).json(buildErrorResponse('FORBIDDEN', `Permission denied for ${resource}:${action}`, req.requestId))
    return false
  }

  return true
}

function auditMeta(req: Request) {
  return {
    actorId: req.actor?.id,
    requestId: req.requestId,
  }
}

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
  const data = await companyFacade.listCompanies({ status: query.status })
  const total = data.length
  res.json({ data, meta: buildPaginatedMeta(req.requestId, total, query.limit, (query.page - 1) * query.limit) })
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
  const data = query.companyId
    ? await contactFacade.listByCompany(query.companyId)
    : await contactFacade.listContacts()
  res.json({ data, meta: buildSuccessMeta(req.requestId) })
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
  const data = query.companyId
    ? await leadFacade.listByCompany(query.companyId)
    : await leadFacade.listLeads()
  res.json({ data, meta: buildSuccessMeta(req.requestId) })
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
  const data = query.companyId
    ? await activityFacade.listByCompany(query.companyId)
    : await activityFacade.listActivities()
  res.json({ data, meta: buildSuccessMeta(req.requestId) })
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
  const data = query.companyId
    ? await taskFacade.listByCompany(query.companyId)
    : await taskFacade.listTasks()
  res.json({ data, meta: buildSuccessMeta(req.requestId) })
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