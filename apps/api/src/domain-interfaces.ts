import type {
  Activity,
  Company,
  Contact,
  DashboardSummary,
  Lead,
  Task,
  User,
} from '@naeos-crm/domain'
import type { AuditEvent } from '@naeos-crm/audit'

export interface PageQuery {
  limit?: number
  offset?: number
}

export interface UserReadPort {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  list(): Promise<User[]>
  create(input: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>
  update(id: string, input: Partial<User>): Promise<User | null>
  delete(id: string): Promise<boolean>
}

export interface CompanyReadPort {
  findById(id: string): Promise<Company | null>
  list(params?: { status?: Company['status'] } & PageQuery): Promise<{ data: Company[]; total: number }>
  create(input: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company>
  update(id: string, input: Partial<Company>): Promise<Company | null>
  delete(id: string): Promise<boolean>
}

export interface ContactReadPort {
  findById(id: string): Promise<Contact | null>
  list(params?: PageQuery): Promise<{ data: Contact[]; total: number }>
  listByCompany(companyId: string, params?: PageQuery): Promise<{ data: Contact[]; total: number }>
  create(input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact>
  update(id: string, input: Partial<Contact>): Promise<Contact | null>
  delete(id: string): Promise<boolean>
}

export interface LeadReadPort {
  findById(id: string): Promise<Lead | null>
  list(params?: PageQuery): Promise<{ data: Lead[]; total: number }>
  listByCompany(companyId: string, params?: PageQuery): Promise<{ data: Lead[]; total: number }>
  create(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead>
  update(id: string, input: Partial<Lead>): Promise<Lead | null>
  delete(id: string): Promise<boolean>
}

export interface ActivityReadPort {
  findById(id: string): Promise<Activity | null>
  list(params?: PageQuery): Promise<{ data: Activity[]; total: number }>
  listByCompany(companyId: string, params?: PageQuery): Promise<{ data: Activity[]; total: number }>
  create(input: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity>
  update(id: string, input: Partial<Activity>): Promise<Activity | null>
  delete(id: string): Promise<boolean>
}

export interface TaskReadPort {
  findById(id: string): Promise<Task | null>
  list(params?: PageQuery): Promise<{ data: Task[]; total: number }>
  listByCompany(companyId: string, params?: PageQuery): Promise<{ data: Task[]; total: number }>
  create(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>
  update(id: string, input: Partial<Task>): Promise<Task | null>
  delete(id: string): Promise<boolean>
}

export interface DashboardReadPort {
  getSummary(): Promise<DashboardSummary>
}

export interface AuditReadPort {
  list(params: {
    entityType?: string
    entityId?: string
    actorId?: string
    requestId?: string
    limit: number
    offset: number
  }): Promise<{ events: AuditEvent[]; total: number }>
}