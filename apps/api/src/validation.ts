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