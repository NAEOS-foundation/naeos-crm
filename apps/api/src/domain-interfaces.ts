import type { Activity, Lead, Task } from '@naeos-crm/domain'

export interface CompanyReadPort {
  findById(id: string): Promise<{ id: string; name: string } | null>
  list(): Promise<Array<{ id: string; name: string }>>
}

export interface ContactReadPort {
  list(): Promise<Array<{ id: string; fullName: string; companyId?: string }>>
  listByCompany(companyId: string): Promise<Array<{ id: string; fullName: string; companyId?: string }>>
}

export interface LeadReadPort {
  list(): Promise<Lead[]>
  listByCompany(companyId: string): Promise<Lead[]>
}

export interface ActivityReadPort {
  list(): Promise<Activity[]>
  listByCompany(companyId: string): Promise<Activity[]>
}

export interface TaskReadPort {
  list(): Promise<Task[]>
  listByCompany(companyId: string): Promise<Task[]>
}
