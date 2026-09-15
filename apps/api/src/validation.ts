import { z } from 'zod'

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

const nonNullDate = z.coerce
  .date()
  .default(() => new Date())
  .refine((value) => value.getTime() > 0, {
    message: 'must be a valid date (null is not accepted)',
  })

const nullableDate = z.coerce.date().nullable().optional()

export const idParamSchema = z.object({
  id: z.string().min(1),
})

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  roles: z.array(z.enum(['ADMIN', 'MANAGER', 'MEMBER'])).default(['MEMBER']),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

export const updateUserSchema = createUserSchema.partial().strict()

export const createCompanySchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
  region: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).default('ACTIVE'),
  ownerId: z.string().optional(),
})

export const updateCompanySchema = createCompanySchema.partial().strict()

export const createContactSchema = z.object({
  companyId: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  role: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).default('ACTIVE'),
})

export const updateContactSchema = createContactSchema.partial().strict()

export const createLeadSchema = z.object({
  companyId: z.string().min(1),
  source: z.string().min(1),
  status: z.enum(['NEW', 'QUALIFIED', 'NURTURE', 'DISQUALIFIED']).default('NEW'),
  ownerId: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
})

export const updateLeadSchema = createLeadSchema.partial().strict()

export const createActivitySchema = z.object({
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  type: z.enum(['EMAIL', 'CALL', 'MEETING', 'TASK']),
  channel: z.string().optional(),
  summary: z.string().min(1),
  occurredAt: nonNullDate,
  ownerId: z.string().optional(),
})

export const updateActivitySchema = createActivitySchema.partial().strict()

export const createTaskSchema = z.object({
  companyId: z.string().optional(),
  assigneeId: z.string().optional(),
  subject: z.string().min(1),
  dueAt: nullableDate,
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).default('OPEN'),
})

export const updateTaskSchema = createTaskSchema.partial().strict()

export const companyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
})

export const listByCompanyQuerySchema = z.object({
  companyId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const auditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  requestId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createPipelineStageSchema = z.object({
  stage: z.enum(['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']),
  name: z.string().min(1),
  sequence: z.number().int().min(0),
  probability: z.number().int().min(0).max(100).default(20),
})

export const updatePipelineStageSchema = createPipelineStageSchema.partial().strict()

export const reorderPipelineStagesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
})

export const createOpportunitySchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1),
  stage: z.enum(['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).default('NEW'),
  amount: z.number().min(0).default(0),
  closeDate: nullableDate,
  ownerId: z.string().optional(),
})

export const updateOpportunitySchema = createOpportunitySchema.partial().strict()

export const opportunityQuerySchema = z.object({
  stage: z.enum(['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional(),
  companyId: z.string().optional(),
  ownerId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['OUTBOUND', 'INBOUND', 'NURTURE', 'EVENT', 'PARTNER']).default('OUTBOUND'),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).default('DRAFT'),
  ownerId: z.string().optional(),
})

export const updateCampaignSchema = createCampaignSchema.partial().strict()

export const campaignQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  type: z.enum(['OUTBOUND', 'INBOUND', 'NURTURE', 'EVENT', 'PARTNER']).optional(),
  ownerId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createCampaignStepSchema = z.object({
  campaignId: z.string().min(1),
  sequence: z.number().int().min(0),
  actionType: z.enum(['EMAIL', 'CALL', 'TASK', 'WAIT']),
  subject: z.string().optional(),
  scheduledAt: nullableDate,
  status: z.enum(['PENDING', 'READY', 'EXECUTING', 'DONE', 'SKIPPED']).default('PENDING'),
})

export const updateCampaignStepSchema = createCampaignStepSchema.partial().strict()

export const createCampaignStepNestedSchema = createCampaignStepSchema.omit({ campaignId: true })

export const createFollowUpSchema = z.object({
  activityId: z.string().min(1),
  dueAt: nonNullDate,
  status: z.enum(['OPEN', 'DONE', 'DEFERRED', 'CANCELLED']).default('OPEN'),
  ownerId: z.string().optional(),
  notes: z.string().optional(),
})

export const updateFollowUpSchema = createFollowUpSchema.partial().strict()

export const followUpQuerySchema = z.object({
  status: z.enum(['OPEN', 'DONE', 'DEFERRED', 'CANCELLED']).optional(),
  ownerId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createContributorSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['DEVELOPER', 'DESIGNER', 'REVIEWER', 'MAINTAINER', 'ADVISOR']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
  communityId: z.string().optional(),
  ownerId: z.string().optional(),
})

export const updateContributorSchema = createContributorSchema.partial().strict()

export const contributorQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  role: z.enum(['DEVELOPER', 'DESIGNER', 'REVIEWER', 'MAINTAINER', 'ADVISOR']).optional(),
  communityId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createPartnerSchema = z.object({
  name: z.string().min(1),
  partnerType: z.enum(['TECHNOLOGY', 'INTEGRATION', 'STRATEGIC', 'CHANNEL', 'RESELLER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
  ownerId: z.string().optional(),
})

export const updatePartnerSchema = createPartnerSchema.partial().strict()

export const partnerQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  partnerType: z.enum(['TECHNOLOGY', 'INTEGRATION', 'STRATEGIC', 'CHANNEL', 'RESELLER']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createCommunitySchema = z.object({
  name: z.string().min(1),
  purpose: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
  ownerId: z.string().optional(),
})

export const updateCommunitySchema = createCommunitySchema.partial().strict()

export const communityQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createInvestorSchema = z.object({
  name: z.string().min(1),
  investorType: z.enum(['ANGEL', 'SEED', 'VENTURE', 'STRATEGIC', 'OTHER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
  ownerId: z.string().optional(),
})

export const updateInvestorSchema = createInvestorSchema.partial().strict()

export const investorQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  investorType: z.enum(['ANGEL', 'SEED', 'VENTURE', 'STRATEGIC', 'OTHER']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createUseCaseSchema = z.object({
  opportunityId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  value: z.number().min(0).optional(),
  ownerId: z.string().optional(),
})

export const updateUseCaseSchema = createUseCaseSchema.partial().strict()

export const useCaseQuerySchema = z.object({
  opportunityId: z.string().optional(),
  ownerId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createPolicyRuleSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1),
  role: z.string().min(1),
  effect: z.enum(['ALLOW', 'DENY']),
  priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
  policyVersion: z.string().min(1),
})

export const updatePolicyRuleSchema = createPolicyRuleSchema.partial().strict()

export const policyRuleQuerySchema = z.object({
  resource: z.string().optional(),
  action: z.string().optional(),
  enabled: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createGoGateRequestSchema = z.object({
  actionType: z.enum(['SEND_EMAIL', 'SEND_MESSAGE', 'PUBLISH_POST', 'CONTACT_PROSPECT', 'CREATE_ISSUE', 'TRIGGER_WORKFLOW', 'MODIFY_EXTERNAL_SYSTEM']),
  target: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const goGateQuerySchema = z.object({
  status: z.enum(['READY', 'WAITING_FOR_GO', 'APPROVED', 'EXECUTING', 'EXECUTED', 'FAILED', 'EXPIRED', 'REJECTED']).optional(),
  actionType: z.enum(['SEND_EMAIL', 'SEND_MESSAGE', 'PUBLISH_POST', 'CONTACT_PROSPECT', 'CREATE_ISSUE', 'TRIGGER_WORKFLOW', 'MODIFY_EXTERNAL_SYSTEM']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const goGateDecisionSchema = z.object({
  reason: z.string().optional(),
})