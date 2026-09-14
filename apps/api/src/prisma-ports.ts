import { PrismaClient, Prisma } from '@prisma/client'
import type { AuditEvent } from '@naeos-crm/audit'
import type {
  Activity,
  Company,
  Contact,
  DashboardSummary,
  Lead,
  Task,
  User,
} from '@naeos-crm/domain'

import type {
  ActivityReadPort,
  AuditReadPort,
  CompanyReadPort,
  ContactReadPort,
  DashboardReadPort,
  LeadReadPort,
  TaskReadPort,
  UserReadPort,
} from './domain-interfaces'

export const prisma = new PrismaClient()

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
    const user = await prisma.user.create({ data: input })
    return normalizeUser(user)
  }

  async update(id: string, input: Partial<User>): Promise<User | null> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeUser(user)
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }
}

export class PrismaCompanyReadPort implements CompanyReadPort {
  async findById(id: string): Promise<Company | null> {
    const company = await prisma.company.findUnique({ where: { id } })
    return company ? normalizeCompany(company) : null
  }

  async list(params?: { status?: Company['status'] }): Promise<Company[]> {
    const companies = await prisma.company.findMany({
      where: params?.status ? { status: params.status } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return companies.map(normalizeCompany)
  }

  async create(input: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
    const company = await prisma.company.create({ data: input })
    return normalizeCompany(company)
  }

  async update(id: string, input: Partial<Company>): Promise<Company | null> {
    try {
      const company = await prisma.company.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeCompany(company)
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.company.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }
}

export class PrismaContactReadPort implements ContactReadPort {
  async findById(id: string): Promise<Contact | null> {
    const contact = await prisma.contact.findUnique({ where: { id } })
    return contact ? normalizeContact(contact) : null
  }

  async list(): Promise<Contact[]> {
    const contacts = await prisma.contact.findMany({ orderBy: { createdAt: 'desc' } })
    return contacts.map(normalizeContact)
  }

  async listByCompany(companyId: string): Promise<Contact[]> {
    const contacts = await prisma.contact.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    })

    return contacts.map(normalizeContact)
  }

  async create(input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
    const contact = await prisma.contact.create({ data: input })
    return normalizeContact(contact)
  }

  async update(id: string, input: Partial<Contact>): Promise<Contact | null> {
    try {
      const contact = await prisma.contact.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeContact(contact)
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.contact.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }
}

export class PrismaLeadReadPort implements LeadReadPort {
  async findById(id: string): Promise<Lead | null> {
    const lead = await prisma.lead.findUnique({ where: { id } })
    return lead ? normalizeLead(lead) : null
  }

  async list(): Promise<Lead[]> {
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } })
    return leads.map(normalizeLead)
  }

  async listByCompany(companyId: string): Promise<Lead[]> {
    const leads = await prisma.lead.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    })

    return leads.map(normalizeLead)
  }

  async create(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    const lead = await prisma.lead.create({ data: input })
    return normalizeLead(lead)
  }

  async update(id: string, input: Partial<Lead>): Promise<Lead | null> {
    try {
      const lead = await prisma.lead.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeLead(lead)
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.lead.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }
}

export class PrismaActivityReadPort implements ActivityReadPort {
  async findById(id: string): Promise<Activity | null> {
    const activity = await prisma.activity.findUnique({ where: { id } })
    return activity ? normalizeActivity(activity) : null
  }

  async list(): Promise<Activity[]> {
    const activities = await prisma.activity.findMany({ orderBy: { occurredAt: 'desc' } })
    return activities.map(normalizeActivity)
  }

  async listByCompany(companyId: string): Promise<Activity[]> {
    const activities = await prisma.activity.findMany({
      where: { companyId },
      orderBy: { occurredAt: 'desc' },
    })

    return activities.map(normalizeActivity)
  }

  async create(input: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
    const activity = await prisma.activity.create({ data: input })
    return normalizeActivity(activity)
  }

  async update(id: string, input: Partial<Activity>): Promise<Activity | null> {
    try {
      const activity = await prisma.activity.update({
        where: { id },
        data: input,
      })
      return normalizeActivity(activity)
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.activity.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }
}

export class PrismaTaskReadPort implements TaskReadPort {
  async findById(id: string): Promise<Task | null> {
    const task = await prisma.task.findUnique({ where: { id } })
    return task ? normalizeTask(task) : null
  }

  async list(): Promise<Task[]> {
    const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'desc' } })
    return tasks.map(normalizeTask)
  }

  async listByCompany(companyId: string): Promise<Task[]> {
    const tasks = await prisma.task.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    })

    return tasks.map(normalizeTask)
  }

  async create(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const task = await prisma.task.create({ data: input })
    return normalizeTask(task)
  }

  async update(id: string, input: Partial<Task>): Promise<Task | null> {
    try {
      const task = await prisma.task.update({
        where: { id },
        data: { ...input, updatedAt: new Date() },
      })
      return normalizeTask(task)
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.task.delete({ where: { id } })
      return true
    } catch {
      return false
    }
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