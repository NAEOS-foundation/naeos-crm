import type {
  Activity,
  Campaign,
  CampaignAnalyticsSummary,
  CampaignStep,
  Company,
  Community,
  Contact,
  Contributor,
  DashboardSummary,
  FollowUp,
  FollowUpAnalyticsSummary,
  GoGateRequest,
  Investor,
  Lead,
  Opportunity,
  Partner,
  PipelineAnalyticsSummary,
  PipelineStage,
  PolicyRule,
  Task,
  UseCase,
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

export interface PipelineStageReadPort {
  findById(id: string): Promise<PipelineStage | null>
  list(params?: PageQuery): Promise<{ data: PipelineStage[]; total: number }>
  create(input: Omit<PipelineStage, 'id' | 'createdAt' | 'updatedAt'>): Promise<PipelineStage>
  update(id: string, input: Partial<PipelineStage>): Promise<PipelineStage | null>
  delete(id: string): Promise<boolean>
  reorder(orderedIds: string[]): Promise<PipelineStage[]>
}

export interface OpportunityReadPort {
  findById(id: string): Promise<Opportunity | null>
  list(
    params?: { stage?: Opportunity['stage']; companyId?: string; ownerId?: string } & PageQuery,
  ): Promise<{ data: Opportunity[]; total: number }>
  listByCompany(companyId: string, params?: PageQuery): Promise<{ data: Opportunity[]; total: number }>
  listByOwner(ownerId: string, params?: PageQuery): Promise<{ data: Opportunity[]; total: number }>
  create(input: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Opportunity>
  update(id: string, input: Partial<Opportunity>): Promise<Opportunity | null>
  delete(id: string): Promise<boolean>
}

export interface CampaignReadPort {
  findById(id: string): Promise<Campaign | null>
  list(
    params?: { status?: Campaign['status']; type?: Campaign['type']; ownerId?: string } & PageQuery,
  ): Promise<{ data: Campaign[]; total: number }>
  listByOwner(ownerId: string, params?: PageQuery): Promise<{ data: Campaign[]; total: number }>
  create(input: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign>
  update(id: string, input: Partial<Campaign>): Promise<Campaign | null>
  delete(id: string): Promise<boolean>
}

export interface CampaignStepReadPort {
  findById(id: string): Promise<CampaignStep | null>
  listByCampaign(campaignId: string, params?: PageQuery): Promise<{ data: CampaignStep[]; total: number }>
  create(input: Omit<CampaignStep, 'id' | 'createdAt' | 'updatedAt'>): Promise<CampaignStep>
  update(id: string, input: Partial<CampaignStep>): Promise<CampaignStep | null>
  delete(id: string): Promise<boolean>
}

export interface FollowUpReadPort {
  findById(id: string): Promise<FollowUp | null>
  list(
    params?: { status?: FollowUp['status']; ownerId?: string } & PageQuery,
  ): Promise<{ data: FollowUp[]; total: number }>
  listByActivity(activityId: string, params?: PageQuery): Promise<{ data: FollowUp[]; total: number }>
  listByOwner(ownerId: string, params?: PageQuery): Promise<{ data: FollowUp[]; total: number }>
  create(input: Omit<FollowUp, 'id' | 'createdAt' | 'updatedAt'>): Promise<FollowUp>
  update(id: string, input: Partial<FollowUp>): Promise<FollowUp | null>
  delete(id: string): Promise<boolean>
}

export interface ContributorReadPort {
  findById(id: string): Promise<Contributor | null>
  list(
    params?: { status?: Contributor['status']; role?: Contributor['role']; communityId?: string } & PageQuery,
  ): Promise<{ data: Contributor[]; total: number }>
  create(input: Omit<Contributor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contributor>
  update(id: string, input: Partial<Contributor>): Promise<Contributor | null>
  delete(id: string): Promise<boolean>
}

export interface PartnerReadPort {
  findById(id: string): Promise<Partner | null>
  list(
    params?: { status?: Partner['status']; partnerType?: Partner['partnerType'] } & PageQuery,
  ): Promise<{ data: Partner[]; total: number }>
  create(input: Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>): Promise<Partner>
  update(id: string, input: Partial<Partner>): Promise<Partner | null>
  delete(id: string): Promise<boolean>
}

export interface CommunityReadPort {
  findById(id: string): Promise<Community | null>
  list(params?: { status?: Community['status'] } & PageQuery): Promise<{ data: Community[]; total: number }>
  create(input: Omit<Community, 'id' | 'createdAt' | 'updatedAt'>): Promise<Community>
  update(id: string, input: Partial<Community>): Promise<Community | null>
  delete(id: string): Promise<boolean>
}

export interface InvestorReadPort {
  findById(id: string): Promise<Investor | null>
  list(
    params?: { status?: Investor['status']; investorType?: Investor['investorType'] } & PageQuery,
  ): Promise<{ data: Investor[]; total: number }>
  create(input: Omit<Investor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Investor>
  update(id: string, input: Partial<Investor>): Promise<Investor | null>
  delete(id: string): Promise<boolean>
}

export interface UseCaseReadPort {
  findById(id: string): Promise<UseCase | null>
  list(
    params?: { opportunityId?: string; ownerId?: string } & PageQuery,
  ): Promise<{ data: UseCase[]; total: number }>
  listByOpportunity(opportunityId: string, params?: PageQuery): Promise<{ data: UseCase[]; total: number }>
  create(input: Omit<UseCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<UseCase>
  update(id: string, input: Partial<UseCase>): Promise<UseCase | null>
  delete(id: string): Promise<boolean>
}

export interface PolicyRuleReadPort {
  findById(id: string): Promise<PolicyRule | null>
  list(params?: { resource?: string; action?: string; enabled?: boolean } & PageQuery): Promise<{ data: PolicyRule[]; total: number }>
  findForEvaluation(resource: string, action: string, roles: User['roles']): Promise<PolicyRule[]>
  create(input: Omit<PolicyRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<PolicyRule>
  update(id: string, input: Partial<PolicyRule>): Promise<PolicyRule | null>
  delete(id: string): Promise<boolean>
}

export interface GoGateRequestReadPort {
  findById(id: string): Promise<GoGateRequest | null>
  list(params?: { status?: GoGateRequest['status']; actionType?: GoGateRequest['actionType'] } & PageQuery): Promise<{ data: GoGateRequest[]; total: number }>
  create(input: Omit<GoGateRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<GoGateRequest>
  update(id: string, input: Partial<GoGateRequest>): Promise<GoGateRequest | null>
  transition(id: string, expectedStatus: GoGateRequest['status'], input: Partial<GoGateRequest>, expiresAfter?: Date): Promise<GoGateRequest | null>
}

export interface PipelineAnalyticsReadPort {
  getPipelineAnalytics(): Promise<PipelineAnalyticsSummary>
  getCampaignAnalytics(): Promise<CampaignAnalyticsSummary>
  getFollowUpAnalytics(): Promise<FollowUpAnalyticsSummary>
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