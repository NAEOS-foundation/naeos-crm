import type {
  Activity,
  Company,
  Contact,
  Lead,
  Task,
  User,
  DashboardSummary,
} from '@naeos-crm/domain'
import type { AuditService } from '@naeos-crm/audit'

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
    await this.audit.record({
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

    await this.audit.record({
      actorId: auditMeta.actorId,
      action: 'user.updated',
      entityType: 'user',
      entityId: user.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: previous as unknown as Record<string, unknown>,
      newState: user as unknown as Record<string, unknown>,
    })
    return user
  }

  async deleteUser(id: string, auditMeta: AuditMetadata) {
    const previous = await this.userReadPort.findById(id)
    const deleted = await this.userReadPort.delete(id)

    if (deleted && previous) {
      await this.audit.record({
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

  async listCompanies(params?: { status?: Company['status'] }) {
    return this.companyReadPort.list(params)
  }

  async createCompany(input: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    const company = await this.companyReadPort.create(input)
    await this.audit.record({
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

    await this.audit.record({
      actorId: auditMeta.actorId,
      action: 'company.updated',
      entityType: 'company',
      entityId: company.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: previous as unknown as Record<string, unknown>,
      newState: company as unknown as Record<string, unknown>,
    })
    return company
  }

  async deleteCompany(id: string, auditMeta: AuditMetadata) {
    const previous = await this.companyReadPort.findById(id)
    const deleted = await this.companyReadPort.delete(id)

    if (deleted && previous) {
      await this.audit.record({
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
  ) {}

  async getContact(id: string) {
    return this.contactReadPort.findById(id)
  }

  async listContacts() {
    return this.contactReadPort.list()
  }

  async listByCompany(companyId: string) {
    return this.contactReadPort.listByCompany(companyId)
  }

  async createContact(input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    const contact = await this.contactReadPort.create(input)
    await this.audit.record({
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
    const contact = await this.contactReadPort.update(id, input)

    if (!contact) return null

    await this.audit.record({
      actorId: auditMeta.actorId,
      action: 'contact.updated',
      entityType: 'contact',
      entityId: contact.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: previous as unknown as Record<string, unknown>,
      newState: contact as unknown as Record<string, unknown>,
    })
    return contact
  }

  async deleteContact(id: string, auditMeta: AuditMetadata) {
    const previous = await this.contactReadPort.findById(id)
    const deleted = await this.contactReadPort.delete(id)

    if (deleted && previous) {
      await this.audit.record({
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

  async listLeads() {
    return this.leadReadPort.list()
  }

  async listByCompany(companyId: string) {
    return this.leadReadPort.listByCompany(companyId)
  }

  async createLead(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    const lead = await this.leadReadPort.create(input)
    await this.audit.record({
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

    await this.audit.record({
      actorId: auditMeta.actorId,
      action: 'lead.updated',
      entityType: 'lead',
      entityId: lead.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: previous as unknown as Record<string, unknown>,
      newState: lead as unknown as Record<string, unknown>,
    })
    return lead
  }

  async deleteLead(id: string, auditMeta: AuditMetadata) {
    const previous = await this.leadReadPort.findById(id)
    const deleted = await this.leadReadPort.delete(id)

    if (deleted && previous) {
      await this.audit.record({
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
  ) {}

  async getActivity(id: string) {
    return this.activityReadPort.findById(id)
  }

  async listActivities() {
    return this.activityReadPort.list()
  }

  async listByCompany(companyId: string) {
    return this.activityReadPort.listByCompany(companyId)
  }

  async createActivity(input: Omit<Activity, 'id' | 'createdAt'>, auditMeta: AuditMetadata) {
    const activity = await this.activityReadPort.create(input)
    await this.audit.record({
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
    const activity = await this.activityReadPort.update(id, input)

    if (!activity) return null

    await this.audit.record({
      actorId: auditMeta.actorId,
      action: 'activity.updated',
      entityType: 'activity',
      entityId: activity.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: previous as unknown as Record<string, unknown>,
      newState: activity as unknown as Record<string, unknown>,
    })
    return activity
  }

  async deleteActivity(id: string, auditMeta: AuditMetadata) {
    const previous = await this.activityReadPort.findById(id)
    const deleted = await this.activityReadPort.delete(id)

    if (deleted && previous) {
      await this.audit.record({
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
  ) {}

  async getTask(id: string) {
    return this.taskReadPort.findById(id)
  }

  async listTasks() {
    return this.taskReadPort.list()
  }

  async listByCompany(companyId: string) {
    return this.taskReadPort.listByCompany(companyId)
  }

  async createTask(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, auditMeta: AuditMetadata) {
    const task = await this.taskReadPort.create(input)
    await this.audit.record({
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
    const task = await this.taskReadPort.update(id, input)

    if (!task) return null

    await this.audit.record({
      actorId: auditMeta.actorId,
      action: 'task.updated',
      entityType: 'task',
      entityId: task.id,
      requestId: auditMeta.requestId,
      result: 'SUCCESS',
      previousState: previous as unknown as Record<string, unknown>,
      newState: task as unknown as Record<string, unknown>,
    })
    return task
  }

  async deleteTask(id: string, auditMeta: AuditMetadata) {
    const previous = await this.taskReadPort.findById(id)
    const deleted = await this.taskReadPort.delete(id)

    if (deleted && previous) {
      await this.audit.record({
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

export class AuditFacade {
  constructor(private readonly auditReadPort: AuditReadPort) {}

  async list(params: {
    entityType?: string
    entityId?: string
    actorId?: string
    requestId?: string
    limit: number
    offset: number
  }) {
    return this.auditReadPort.list(params)
  }
}

interface AuditMetadata {
  actorId?: string
  requestId?: string
}