import { z } from 'zod'
import { Router } from 'express'
import { PrismaActivityReadPort, PrismaAuditSink, PrismaCompanyReadPort, PrismaContactReadPort, PrismaLeadReadPort, prisma } from './prisma-ports'
import { AuditService } from '@naeos-crm/audit'
import { asyncHandler } from './middleware'
import { buildErrorResponse, buildSuccessMeta } from '@naeos-crm/shared'

const assessmentIntakeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().min(2).max(160),
  agents: z.string().trim().max(1000).optional().default(''),
  workflows: z.string().trim().max(2000).optional().default(''),
  controls: z.string().trim().max(2000).optional().default(''),
  risk: z.string().trim().max(2000).optional().default(''),
  goals: z.string().trim().max(2000).optional().default(''),
  website: z.string().max(500).optional(),
})

const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60 * 60 * 1000
const MAX_ATTEMPTS = 5

function allow(ip: string): boolean {
  const now = Date.now()
  const current = attempts.get(ip)
  if (!current || current.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (current.count >= MAX_ATTEMPTS) return false
  current.count += 1
  return true
}

const audit = new AuditService(new PrismaAuditSink())
const companyPort = new PrismaCompanyReadPort()
const contactPort = new PrismaContactReadPort()
const leadPort = new PrismaLeadReadPort()
const activityPort = new PrismaActivityReadPort()

export const publicRouter = Router()

publicRouter.post('/api/v1/public/assessment-intake', asyncHandler(async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  if (!allow(ip)) {
    res.status(429).json(buildErrorResponse('RATE_LIMITED', 'Too many submissions. Please try again later.', req.requestId))
    return
  }

  const input = assessmentIntakeSchema.parse(req.body)
  if (input.website) {
    res.status(400).json(buildErrorResponse('INVALID_SUBMISSION', 'Invalid submission.', req.requestId))
    return
  }

  const { company, contact, lead, activity } = await prisma.$transaction(async (tx) => {
    const companyRecord = await tx.company.create({
      data: {
        name: input.company,
        industry: 'AI Engineering',
        status: 'PENDING',
      },
    })

    const contactRecord = await tx.contact.create({
      data: {
        companyId: companyRecord.id,
        fullName: input.name,
        email: input.email,
        role: 'Assessment Contact',
        status: 'PENDING',
      },
    })

    const leadRecord = await tx.lead.create({
      data: {
        companyId: companyRecord.id,
        source: 'NAEOS Website — AI Engineering Governance Assessment',
        status: 'NEW',
      },
    })

    const details = [
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      `Company: ${input.company}`,
      input.agents && `Agents: ${input.agents}`,
      input.workflows && `Workflows: ${input.workflows}`,
      input.controls && `Existing controls: ${input.controls}`,
      input.risk && `Highest-risk actions: ${input.risk}`,
      input.goals && `30-day goals: ${input.goals}`,
    ].filter(Boolean).join('\\n')

    const activityRecord = await tx.activity.create({
      data: {
        companyId: companyRecord.id,
        contactId: contactRecord.id,
        type: 'EMAIL',
        channel: 'website',
        summary: `AI Engineering Governance Assessment request\\n\\n${details}`,
        occurredAt: new Date(),
      },
    })

    return {
      company: companyRecord,
      contact: contactRecord,
      lead: leadRecord,
      activity: activityRecord,
    }
  })

  await audit.record({
    actorType: 'external',
    action: 'assessment.intake.created',
    entityType: 'lead',
    entityId: lead.id,
    requestId: req.requestId,
    source: 'public-api',
    result: 'SUCCESS',
    newState: {
      companyId: company.id,
      contactId: contact.id,
      leadId: lead.id,
      activityId: activity.id,
      source: lead.source,
    },
  })

  res.status(201).json({
    data: { leadId: lead.id },
    meta: buildSuccessMeta(req.requestId),
  })
}))
