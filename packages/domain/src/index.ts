export type CompanyStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'
export type LeadStatus = 'NEW' | 'QUALIFIED' | 'NURTURE' | 'DISQUALIFIED'
export type ActivityType = 'EMAIL' | 'CALL' | 'MEETING' | 'TASK'

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
  status: CompanyStatus
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
  dueAt?: Date
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE'
  createdAt: Date
  updatedAt: Date
}

export interface CompanyRepository {
  findById(id: string): Promise<Company | null>
  list(): Promise<Company[]>
}

export interface ContactRepository {
  listByCompany(companyId: string): Promise<Contact[]>
}

export class CompanyService {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async getCompany(id: string): Promise<Company | null> {
    return this.companyRepository.findById(id)
  }
}
