import type {
  Company,
  Contact,
  Lead,
  Activity,
  Task,
} from '@naeos-crm/domain'

import type {
  ActivityReadPort,
  CompanyReadPort,
  ContactReadPort,
  LeadReadPort,
  TaskReadPort,
} from './domain-interfaces'

export const seedCompanies: Company[] = [
  {
    id: 'company-1',
    name: 'Northwind Labs',
    industry: 'SaaS',
    region: 'APAC',
    status: 'ACTIVE',
    ownerId: 'user-1',
    createdAt: new Date('2026-01-10T08:00:00.000Z'),
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
  },
  {
    id: 'company-2',
    name: 'Blue Harbor Ventures',
    industry: 'Finance',
    region: 'EMEA',
    status: 'PENDING',
    ownerId: 'user-2',
    createdAt: new Date('2026-02-14T09:30:00.000Z'),
    updatedAt: new Date('2026-09-03T12:15:00.000Z'),
  },
]

export const seedContacts: Contact[] = [
  {
    id: 'contact-1',
    companyId: 'company-1',
    fullName: 'Ari Suryadi',
    email: 'ari@northwindlabs.example',
    role: 'Head of Operations',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-15T09:00:00.000Z'),
    updatedAt: new Date('2026-09-01T09:00:00.000Z'),
  },
  {
    id: 'contact-2',
    companyId: 'company-2',
    fullName: 'Mira Sulaiman',
    email: 'mira@blueharbor.example',
    role: 'Finance Director',
    status: 'PENDING',
    createdAt: new Date('2026-02-18T11:00:00.000Z'),
    updatedAt: new Date('2026-09-03T10:10:00.000Z'),
  },
]

export const seedLeads: Lead[] = [
  {
    id: 'lead-1',
    companyId: 'company-1',
    source: 'Outbound',
    status: 'QUALIFIED',
    ownerId: 'user-1',
    score: 82,
    createdAt: new Date('2026-08-10T08:00:00.000Z'),
    updatedAt: new Date('2026-08-15T08:00:00.000Z'),
  },
]

export const seedActivities: Activity[] = [
  {
    id: 'activity-1',
    companyId: 'company-1',
    type: 'EMAIL',
    channel: 'email',
    summary: 'Sent onboarding follow-up',
    occurredAt: new Date('2026-09-05T09:00:00.000Z'),
    ownerId: 'user-1',
    createdAt: new Date('2026-09-05T09:05:00.000Z'),
  },
]

export const seedTasks: Task[] = [
  {
    id: 'task-1',
    companyId: 'company-1',
    assigneeId: 'user-1',
    subject: 'Review partnership terms',
    dueAt: new Date('2026-09-20T10:00:00.000Z'),
    status: 'OPEN',
    createdAt: new Date('2026-09-06T08:00:00.000Z'),
    updatedAt: new Date('2026-09-06T08:00:00.000Z'),
  },
]

export class InMemoryCompanyReadPort implements CompanyReadPort {
  constructor(private readonly companies: Company[] = seedCompanies) {}

  async findById(id: string): Promise<Company | null> {
    return this.companies.find((company) => company.id === id) ?? null
  }

  async list(): Promise<Company[]> {
    return [...this.companies]
  }
}

export class InMemoryContactReadPort implements ContactReadPort {
  constructor(private readonly contacts: Contact[] = seedContacts) {}

  async list(): Promise<Contact[]> {
    return [...this.contacts]
  }

  async listByCompany(companyId: string): Promise<Contact[]> {
    return this.contacts.filter((contact) => contact.companyId === companyId)
  }
}

export class InMemoryLeadReadPort implements LeadReadPort {
  constructor(private readonly leads: Lead[] = seedLeads) {}

  async list(): Promise<Lead[]> {
    return [...this.leads]
  }

  async listByCompany(companyId: string): Promise<Lead[]> {
    return this.leads.filter((lead) => lead.companyId === companyId)
  }
}

export class InMemoryActivityReadPort implements ActivityReadPort {
  constructor(private readonly activities: Activity[] = seedActivities) {}

  async list(): Promise<Activity[]> {
    return [...this.activities]
  }

  async listByCompany(companyId: string): Promise<Activity[]> {
    return this.activities.filter((activity) => activity.companyId === companyId)
  }
}

export class InMemoryTaskReadPort implements TaskReadPort {
  constructor(private readonly tasks: Task[] = seedTasks) {}

  async list(): Promise<Task[]> {
    return [...this.tasks]
  }

  async listByCompany(companyId: string): Promise<Task[]> {
    return this.tasks.filter((task) => task.companyId === companyId)
  }
}

export class CompanyFacade {
  constructor(private readonly companyReadPort: CompanyReadPort) {}

  async getCompany(id: string) {
    return this.companyReadPort.findById(id)
  }

  async listCompanies() {
    return this.companyReadPort.list()
  }
}

export class ContactFacade {
  constructor(private readonly contactReadPort: ContactReadPort) {}

  async listContacts() {
    return this.contactReadPort.list()
  }

  async listByCompany(companyId: string) {
    return this.contactReadPort.listByCompany(companyId)
  }
}

export class LeadFacade {
  constructor(private readonly leadReadPort: LeadReadPort) {}

  async listLeads() {
    return this.leadReadPort.list()
  }

  async listByCompany(companyId: string) {
    return this.leadReadPort.listByCompany(companyId)
  }
}

export class ActivityFacade {
  constructor(private readonly activityReadPort: ActivityReadPort) {}

  async listActivities() {
    return this.activityReadPort.list()
  }

  async listByCompany(companyId: string) {
    return this.activityReadPort.listByCompany(companyId)
  }
}

export class TaskFacade {
  constructor(private readonly taskReadPort: TaskReadPort) {}

  async listTasks() {
    return this.taskReadPort.list()
  }

  async listByCompany(companyId: string) {
    return this.taskReadPort.listByCompany(companyId)
  }
}

export class LeadFacade {
  constructor(private readonly leads: Lead[] = seedLeads) {}

  async listLeads(companyId?: string) {
    if (!companyId) {
      return [...this.leads]
    }

    return this.leads.filter((lead) => lead.companyId === companyId)
  }
}

export class ActivityFacade {
  constructor(private readonly activities: Activity[] = seedActivities) {}

  async listActivities(companyId?: string) {
    if (!companyId) {
      return [...this.activities]
    }

    return this.activities.filter((activity) => activity.companyId === companyId)
  }
}

export class TaskFacade {
  constructor(private readonly tasks: Task[] = seedTasks) {}

  async listTasks(companyId?: string) {
    if (!companyId) {
      return [...this.tasks]
    }

    return this.tasks.filter((task) => task.companyId === companyId)
  }
}
