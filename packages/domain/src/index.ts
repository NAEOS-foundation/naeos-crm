export type CompanyStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'
export type ContactStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'
export type LeadStatus = 'NEW' | 'QUALIFIED' | 'NURTURE' | 'DISQUALIFIED'
export type ActivityType = 'EMAIL' | 'CALL' | 'MEETING' | 'TASK'
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE'
export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER'
export type UserStatus = 'ACTIVE' | 'INACTIVE'
export type AuditResult = 'SUCCESS' | 'FAILURE'

export interface User {
  id: string
  email: string
  name: string
  roles: UserRole[]
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}

export interface Company {
  id: string
  name: string
  industry?: string
  region?: string
  status: CompanyStatus
  ownerId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Contact {
  id: string
  companyId: string
  fullName: string
  email?: string
  role?: string
  status: ContactStatus
  createdAt: Date
  updatedAt: Date
}

export interface Lead {
  id: string
  companyId: string
  source: string
  status: LeadStatus
  ownerId?: string
  score?: number
  createdAt: Date
  updatedAt: Date
}

export interface Activity {
  id: string
  companyId?: string
  contactId?: string
  type: ActivityType
  channel?: string
  summary: string
  occurredAt: Date
  ownerId?: string
  createdAt: Date
}

export interface Task {
  id: string
  companyId?: string
  assigneeId?: string
  subject: string
  dueAt?: Date | null
  status: TaskStatus
  createdAt: Date
  updatedAt: Date
}

export interface AuditEvent {
  id: string
  actorId?: string
  actorType?: string
  action: string
  entityType: string
  entityId: string
  requestId?: string
  source?: string
  result: AuditResult
  reason?: string
  policyVersion?: string
  previousState?: Record<string, unknown>
  newState?: Record<string, unknown>
  authorization?: Record<string, unknown>
  createdAt: Date
}

export interface DashboardSummary {
  companies: { total: number; active: number }
  contacts: { total: number }
  leads: { total: number; byStatus: Record<LeadStatus, number> }
  activities: { total: number; recent: number }
  tasks: { total: number; open: number; overdue: number }
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    request_id: string
    timestamp: string
    total: number
    limit: number
    offset: number
  }
}

export interface ApiResponse<T> {
  data: T
  meta: {
    request_id: string
    timestamp: string
  }
}

export interface ApiErrorResponse {
  error: {
    code: string
    message: string
    request_id?: string
  }
}

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  list(): Promise<User[]>
}

export interface CompanyRepository {
  findById(id: string): Promise<Company | null>
  list(): Promise<Company[]>
  create(input: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company>
  update(id: string, input: Partial<Company>): Promise<Company | null>
  delete(id: string): Promise<boolean>
}

export interface ContactRepository {
  findById(id: string): Promise<Contact | null>
  list(): Promise<Contact[]>
  listByCompany(companyId: string): Promise<Contact[]>
  create(input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact>
  update(id: string, input: Partial<Contact>): Promise<Contact | null>
  delete(id: string): Promise<boolean>
}

export interface LeadRepository {
  findById(id: string): Promise<Lead | null>
  list(): Promise<Lead[]>
  listByCompany(companyId: string): Promise<Lead[]>
  create(input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead>
  update(id: string, input: Partial<Lead>): Promise<Lead | null>
  delete(id: string): Promise<boolean>
}

export interface ActivityRepository {
  findById(id: string): Promise<Activity | null>
  list(): Promise<Activity[]>
  listByCompany(companyId: string): Promise<Activity[]>
  create(input: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity>
  update(id: string, input: Partial<Activity>): Promise<Activity | null>
  delete(id: string): Promise<boolean>
}

export interface TaskRepository {
  findById(id: string): Promise<Task | null>
  list(): Promise<Task[]>
  listByCompany(companyId: string): Promise<Task[]>
  create(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>
  update(id: string, input: Partial<Task>): Promise<Task | null>
  delete(id: string): Promise<boolean>
}

export interface DashboardRepository {
  getSummary(): Promise<DashboardSummary>
}
