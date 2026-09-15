export type CompanyStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'
export type ContactStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'
export type LeadStatus = 'NEW' | 'QUALIFIED' | 'NURTURE' | 'DISQUALIFIED'
export type ActivityType = 'EMAIL' | 'CALL' | 'MEETING' | 'TASK'
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE'
export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER'
export type UserStatus = 'ACTIVE' | 'INACTIVE'
export type AuditResult = 'SUCCESS' | 'FAILURE'
export type OpportunityStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
export type CampaignType = 'OUTBOUND' | 'INBOUND' | 'NURTURE' | 'EVENT' | 'PARTNER'
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'
export type CampaignStepActionType = 'EMAIL' | 'CALL' | 'TASK' | 'WAIT'
export type CampaignStepStatus = 'PENDING' | 'READY' | 'EXECUTING' | 'DONE' | 'SKIPPED'
export type FollowUpStatus = 'OPEN' | 'DONE' | 'DEFERRED' | 'CANCELLED'
export type EcosystemStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type ContributorRole = 'DEVELOPER' | 'DESIGNER' | 'REVIEWER' | 'MAINTAINER' | 'ADVISOR'
export type PartnerType = 'TECHNOLOGY' | 'INTEGRATION' | 'STRATEGIC' | 'CHANNEL' | 'RESELLER'
export type InvestorType = 'ANGEL' | 'SEED' | 'VENTURE' | 'STRATEGIC' | 'OTHER'
export type PolicyEffect = 'ALLOW' | 'DENY'
export type GoGateStatus = 'READY' | 'WAITING_FOR_GO' | 'APPROVED' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'EXPIRED' | 'REJECTED'
export type GoGateActionType =
  | 'SEND_EMAIL'
  | 'SEND_MESSAGE'
  | 'PUBLISH_POST'
  | 'CONTACT_PROSPECT'
  | 'CREATE_ISSUE'
  | 'TRIGGER_WORKFLOW'
  | 'MODIFY_EXTERNAL_SYSTEM'

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

export interface PipelineStage {
  id: string
  stage: OpportunityStage
  name: string
  sequence: number
  probability: number
  createdAt: Date
  updatedAt: Date
}

export interface Opportunity {
  id: string
  companyId: string
  name: string
  stage: OpportunityStage
  amount: number
  closeDate?: Date | null
  ownerId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Campaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  ownerId?: string
  createdAt: Date
  updatedAt: Date
}

export interface CampaignStep {
  id: string
  campaignId: string
  sequence: number
  actionType: CampaignStepActionType
  subject?: string | null
  scheduledAt?: Date | null
  status: CampaignStepStatus
  createdAt: Date
  updatedAt: Date
}

export interface FollowUp {
  id: string
  activityId: string
  dueAt: Date
  status: FollowUpStatus
  ownerId?: string
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Contributor {
  id: string
  name: string
  role: ContributorRole
  status: EcosystemStatus
  communityId?: string
  ownerId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Partner {
  id: string
  name: string
  partnerType: PartnerType
  status: EcosystemStatus
  ownerId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Community {
  id: string
  name: string
  purpose?: string
  status: EcosystemStatus
  ownerId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Investor {
  id: string
  name: string
  investorType: InvestorType
  status: EcosystemStatus
  ownerId?: string
  createdAt: Date
  updatedAt: Date
}

export interface UseCase {
  id: string
  opportunityId: string
  title: string
  summary?: string | null
  value?: number | null
  ownerId?: string
  createdAt: Date
  updatedAt: Date
}

export interface PolicyRule {
  id: string
  resource: string
  action: string
  role: string
  effect: PolicyEffect
  priority: number
  enabled: boolean
  policyVersion: string
  createdAt: Date
  updatedAt: Date
}

export interface GoGateRequest {
  id: string
  actionType: GoGateActionType
  target: string
  payload?: Record<string, unknown> | null
  status: GoGateStatus
  policyVersion?: string
  reason?: string
  requestedBy?: string
  approvedBy?: string
  expiresAt?: Date | null
  executedAt?: Date | null
  verifiedAt?: Date | null
  providerResponse?: Record<string, unknown> | null
  result?: string
  createdAt: Date
  updatedAt: Date
}

export interface PipelineStageBreakdown {
  stage: OpportunityStage
  count: number
  amount: number
  weightedAmount: number
}

export interface PipelineAnalyticsSummary {
  totalValue: number
  weightedValue: number
  openCount: number
  wonCount: number
  lostCount: number
  avgDealSize: number
  byStage: PipelineStageBreakdown[]
}

export interface CampaignAnalyticsSummary {
  total: number
  byStatus: Record<CampaignStatus, number>
  stepsPrepared: number
}

export interface FollowUpAnalyticsSummary {
  openCount: number
  overdueCount: number
  dueTodayCount: number
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

export interface PipelineStageRepository {
  findById(id: string): Promise<PipelineStage | null>
  list(): Promise<PipelineStage[]>
  create(input: Omit<PipelineStage, 'id' | 'createdAt' | 'updatedAt'>): Promise<PipelineStage>
  update(id: string, input: Partial<PipelineStage>): Promise<PipelineStage | null>
  delete(id: string): Promise<boolean>
  reorder(orderedIds: string[]): Promise<PipelineStage[]>
}

export interface OpportunityRepository {
  findById(id: string): Promise<Opportunity | null>
  list(filters?: { stage?: OpportunityStage; companyId?: string }): Promise<Opportunity[]>
  listByCompany(companyId: string): Promise<Opportunity[]>
  listByOwner(ownerId: string): Promise<Opportunity[]>
  create(input: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Opportunity>
  update(id: string, input: Partial<Opportunity>): Promise<Opportunity | null>
  delete(id: string): Promise<boolean>
}

export interface CampaignRepository {
  findById(id: string): Promise<Campaign | null>
  list(): Promise<Campaign[]>
  listByOwner(ownerId: string): Promise<Campaign[]>
  create(input: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign>
  update(id: string, input: Partial<Campaign>): Promise<Campaign | null>
  delete(id: string): Promise<boolean>
}

export interface CampaignStepRepository {
  findById(id: string): Promise<CampaignStep | null>
  listByCampaign(campaignId: string): Promise<CampaignStep[]>
  create(input: Omit<CampaignStep, 'id' | 'createdAt' | 'updatedAt'>): Promise<CampaignStep>
  update(id: string, input: Partial<CampaignStep>): Promise<CampaignStep | null>
  delete(id: string): Promise<boolean>
}

export interface FollowUpRepository {
  findById(id: string): Promise<FollowUp | null>
  list(status?: FollowUpStatus): Promise<FollowUp[]>
  listByActivity(activityId: string): Promise<FollowUp[]>
  listByOwner(ownerId: string): Promise<FollowUp[]>
  create(input: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>): Promise<FollowUp>
  update(id: string, input: Partial<FollowUp>): Promise<FollowUp | null>
  delete(id: string): Promise<boolean>
}

export interface ContributorRepository {
  findById(id: string): Promise<Contributor | null>
  list(filters?: { status?: EcosystemStatus; role?: ContributorRole; communityId?: string }): Promise<Contributor[]>
  create(input: Omit<Contributor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contributor>
  update(id: string, input: Partial<Contributor>): Promise<Contributor | null>
  delete(id: string): Promise<boolean>
}

export interface PartnerRepository {
  findById(id: string): Promise<Partner | null>
  list(filters?: { status?: EcosystemStatus; partnerType?: PartnerType }): Promise<Partner[]>
  create(input: Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>): Promise<Partner>
  update(id: string, input: Partial<Partner>): Promise<Partner | null>
  delete(id: string): Promise<boolean>
}

export interface CommunityRepository {
  findById(id: string): Promise<Community | null>
  list(filters?: { status?: EcosystemStatus }): Promise<Community[]>
  create(input: Omit<Community, 'id' | 'createdAt' | 'updatedAt'>): Promise<Community>
  update(id: string, input: Partial<Community>): Promise<Community | null>
  delete(id: string): Promise<boolean>
}

export interface InvestorRepository {
  findById(id: string): Promise<Investor | null>
  list(filters?: { status?: EcosystemStatus; investorType?: InvestorType }): Promise<Investor[]>
  create(input: Omit<Investor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Investor>
  update(id: string, input: Partial<Investor>): Promise<Investor | null>
  delete(id: string): Promise<boolean>
}

export interface UseCaseRepository {
  findById(id: string): Promise<UseCase | null>
  list(filters?: { opportunityId?: string; ownerId?: string }): Promise<UseCase[]>
  listByOpportunity(opportunityId: string): Promise<UseCase[]>
  create(input: Omit<UseCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<UseCase>
  update(id: string, input: Partial<UseCase>): Promise<UseCase | null>
  delete(id: string): Promise<boolean>
}

export interface PolicyRuleRepository {
  findById(id: string): Promise<PolicyRule | null>
  list(filters?: { resource?: string; action?: string; enabled?: boolean }): Promise<PolicyRule[]>
  findForEvaluation(resource: string, action: string, roles: UserRole[]): Promise<PolicyRule[]>
  create(input: Omit<PolicyRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<PolicyRule>
  update(id: string, input: Partial<PolicyRule>): Promise<PolicyRule | null>
  delete(id: string): Promise<boolean>
}

export interface GoGateRequestRepository {
  findById(id: string): Promise<GoGateRequest | null>
  list(filters?: { status?: GoGateStatus; actionType?: GoGateActionType }): Promise<GoGateRequest[]>
  create(input: Omit<GoGateRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<GoGateRequest>
  update(id: string, input: Partial<GoGateRequest>): Promise<GoGateRequest | null>
}

export interface AnalyticsRepository {
  getPipelineAnalytics(): Promise<PipelineAnalyticsSummary>
  getCampaignAnalytics(): Promise<CampaignAnalyticsSummary>
  getFollowUpAnalytics(): Promise<FollowUpAnalyticsSummary>
}

export interface DashboardRepository {
  getSummary(): Promise<DashboardSummary>
}
