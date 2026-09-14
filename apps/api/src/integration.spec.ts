import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from './app'

const devHeader = (roles: string[], id = 'test-user') => ({
  'x-naeos-dev-user': JSON.stringify({ id, email: `test@naeos.local`, roles }),
})

const admin = devHeader(['admin'])
const member = devHeader(['member'])

describe('Phase 1 API integration', () => {
  let app: Express

  beforeAll(() => {
    app = createApp()
  })

  it('serves a health check', async () => {
    const response = await request(app).get('/health')
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
  })

  it('rejects unauthenticated access in secure mode only', async () => {
    const original = process.env.AUTH_DISABLED
    process.env.AUTH_DISABLED = 'false'
    const secureApp = createApp()
    const response = await request(secureApp).get('/api/v1/users')
    expect(response.status).toBe(401)
    process.env.AUTH_DISABLED = original ?? 'true'
  })

  describe('Current actor', () => {
    it('returns the authenticated actor from /me', async () => {
      const response = await request(app).get('/api/v1/me').set(member)
      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe('test-user')
      expect(response.body.data.roles).toContain('member')
    })

    it('rejects /me requests without an actor in secure mode', async () => {
      const original = process.env.AUTH_DISABLED
      process.env.AUTH_DISABLED = 'false'
      const secureApp = createApp()
      const response = await request(secureApp).get('/api/v1/me')
      expect(response.status).toBe(401)
      process.env.AUTH_DISABLED = original ?? 'true'
    })
  })

  describe('RBAC enforcement', () => {
    it('allows members to read companies but not users', async () => {
      const companies = await request(app).get('/api/v1/companies').set(member)
      expect(companies.status).toBe(200)
      expect(Array.isArray(companies.body.data)).toBe(true)

      const users = await request(app).get('/api/v1/users').set(member)
      expect(users.status).toBe(403)
      expect(users.body.error.code).toBe('FORBIDDEN')
    })

    it('allows admins to administer users', async () => {
      const response = await request(app).get('/api/v1/users').set(admin)
      expect(response.status).toBe(200)
    })

    it('records denied authorization attempts in the audit log', async () => {
      await request(app).get('/api/v1/users').set(member)

      const audit = await request(app).get('/api/v1/audit').set(admin)
      expect(audit.status).toBe(200)

      const denied = audit.body.data.find(
        (event: { action: string; result: string }) =>
          event.action === 'user.read' && event.result === 'FAILURE',
      )
      expect(denied).toBeDefined()
    })
  })

  describe('Company operations', () => {
    it('creates, reads, updates, and deletes a company with audit events', async () => {
      const created = await request(app).post('/api/v1/companies').set(admin).send({
        name: 'Integration Co',
        industry: 'Testing',
        region: 'NA',
        status: 'ACTIVE',
      })
      expect(created.status).toBe(201)
      const companyId = created.body.data.id
      expect(companyId).toBeTruthy()

      const fetched = await request(app).get(`/api/v1/companies/${companyId}`).set(admin)
      expect(fetched.status).toBe(200)
      expect(fetched.body.data.name).toBe('Integration Co')

      const updated = await request(app)
        .put(`/api/v1/companies/${companyId}`)
        .set(admin)
        .send({ status: 'INACTIVE' })
      expect(updated.status).toBe(200)
      expect(updated.body.data.status).toBe('INACTIVE')

      const deleted = await request(app).delete(`/api/v1/companies/${companyId}`).set(admin)
      expect(deleted.status).toBe(204)

      const audit = await request(app)
        .get('/api/v1/audit')
        .query({ entityType: 'company', entityId: companyId })
        .set(admin)
      expect(audit.status).toBe(200)
      const actions = audit.body.data.map((event: { action: string }) => event.action)
      expect(actions).toContain('company.created')
      expect(actions).toContain('company.updated')
      expect(actions).toContain('company.deleted')
    })

    it('rejects invalid company payloads with 400', async () => {
      const response = await request(app).post('/api/v1/companies').set(admin).send({ name: '' })
      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('rejects companies referencing a missing owner with 400', async () => {
      const response = await request(app)
        .post('/api/v1/companies')
        .set(admin)
        .send({ name: 'Broken owner', ownerId: 'missing-owner-id' })
      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_REFERENCE')
    })

    it('blocks deleting a company that still has related records', async () => {
      const created = await request(app).post('/api/v1/companies').set(admin).send({
        name: 'Parent Co',
      })
      const companyId = created.body.data.id

      await request(app).post('/api/v1/contacts').set(admin).send({
        companyId,
        fullName: 'Blocked Contact',
      })

      const deleted = await request(app).delete(`/api/v1/companies/${companyId}`).set(admin)
      expect(deleted.status).toBe(409)
      expect(deleted.body.error.code).toBe('COMPANY_HAS_RELATIONS')
    })

    it('blocks members from deleting companies', async () => {
      const response = await request(app)
        .delete('/api/v1/companies/does-not-matter')
        .set(member)
      expect(response.status).toBe(403)
    })
  })

  describe('User operations', () => {
    it('returns a 409 for duplicate emails', async () => {
      const email = `dup-${Date.now()}@naeos.local`
      const first = await request(app).post('/api/v1/users').set(admin).send({
        email,
        name: 'First',
      })
      expect(first.status).toBe(201)

      const second = await request(app).post('/api/v1/users').set(admin).send({
        email,
        name: 'Second',
      })
      expect(second.status).toBe(409)
      expect(second.body.error.code).toBe('CONFLICT')

      await request(app).delete(`/api/v1/users/${first.body.data.id}`).set(admin)
    })

    it('returns 409 (not 404) when an update duplicating another email is attempted', async () => {
      const first = await request(app).post('/api/v1/users').set(admin).send({
        email: `update-a-${Date.now()}@naeos.local`,
        name: 'A',
      })
      const second = await request(app).post('/api/v1/users').set(admin).send({
        email: `update-b-${Date.now()}@naeos.local`,
        name: 'B',
      })

      const response = await request(app)
        .put(`/api/v1/users/${second.body.data.id}`)
        .set(admin)
        .send({ email: first.body.data.email })
      expect(response.status).toBe(409)

      await request(app).delete(`/api/v1/users/${first.body.data.id}`).set(admin)
      await request(app).delete(`/api/v1/users/${second.body.data.id}`).set(admin)
    })
  })

  describe('Contact, lead, activity, task operations', () => {
    it('returns lists for contact, lead, activity, and task endpoints', async () => {
      for (const path of ['/api/v1/contacts', '/api/v1/leads', '/api/v1/activities', '/api/v1/tasks']) {
        const response = await request(app).get(path).set(admin)
        expect(response.status).toBe(200)
        expect(Array.isArray(response.body.data)).toBe(true)
        expect(response.body.meta).toHaveProperty('total')
      }
    })

    it('creates a lead under a self-contained company and verifies the audit event', async () => {
      const company = await request(app).post('/api/v1/companies').set(admin).send({
        name: `Lead Co ${Date.now()}`,
      })
      const companyId = company.body.data.id

      const created = await request(app).post('/api/v1/leads').set(admin).send({
        companyId,
        source: 'Integration',
        status: 'NEW',
        score: 50,
      })
      expect(created.status).toBe(201)
      expect(created.body.data.status).toBe('NEW')

      const audit = await request(app)
        .get('/api/v1/audit')
        .query({ entityType: 'lead', entityId: created.body.data.id })
        .set(admin)
      expect(audit.body.data.some((e: { action: string }) => e.action === 'lead.created')).toBe(true)

      await request(app).delete(`/api/v1/leads/${created.body.data.id}`).set(admin)
      await request(app).delete(`/api/v1/companies/${companyId}`).set(admin)
    })
  })

  describe('Member ownership scoping', () => {
    async function createOwnerUser(prefix: string) {
      const user = await request(app).post('/api/v1/users').set(admin).send({
        email: `${prefix}-${Date.now()}@naeos.local`,
        name: prefix,
      })
      expect(user.status).toBe(201)
      return user.body.data.id
    }

    it('blocks members from creating contacts in companies they do not own', async () => {
      const otherOwner = await createOwnerUser('other-owner')
      const ownedByOther = await request(app).post('/api/v1/companies').set(admin).send({
        name: 'Other Owned Co',
        ownerId: otherOwner,
      })
      expect(ownedByOther.status).toBe(201)

      const response = await request(app).post('/api/v1/contacts').set(member).send({
        companyId: ownedByOther.body.data.id,
        fullName: 'Sneaky Contact',
      })
      expect(response.status).toBe(403)
      expect(response.body.error.code).toBe('FORBIDDEN')

      await request(app).delete(`/api/v1/companies/${ownedByOther.body.data.id}`).set(admin)
      await request(app).delete(`/api/v1/users/${otherOwner}`).set(admin)
    })

    it('allows members to create and update contacts in companies they own', async () => {
      const ownerId = await createOwnerUser('member-owner')
      const owned = await request(app).post('/api/v1/companies').set(admin).send({
        name: 'Member Owned Co',
        ownerId,
      })
      expect(owned.status).toBe(201)

      const memberHeader = devHeader(['member'], ownerId)
      const created = await request(app).post('/api/v1/contacts').set(memberHeader).send({
        companyId: owned.body.data.id,
        fullName: 'Authorized Contact',
      })
      expect(created.status).toBe(201)

      const updated = await request(app)
        .put(`/api/v1/contacts/${created.body.data.id}`)
        .set(memberHeader)
        .send({ fullName: 'Updated Contact' })
      expect(updated.status).toBe(200)
      expect(updated.body.data.fullName).toBe('Updated Contact')

      await request(app).delete(`/api/v1/contacts/${created.body.data.id}`).set(admin)
      await request(app).delete(`/api/v1/companies/${owned.body.data.id}`).set(admin)
      await request(app).delete(`/api/v1/users/${ownerId}`).set(admin)
    })
  })

  describe('Input handling', () => {
    it('rejects malformed JSON with 400', async () => {
      const response = await request(app)
        .post('/api/v1/companies')
        .set(admin)
        .set('Content-Type', 'application/json')
        .send('{ not valid json')
      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('BAD_REQUEST')
    })

    it('rejects null datetimes instead of silently writing epoch dates', async () => {
      const response = await request(app).post('/api/v1/activities').set(admin).send({
        type: 'CALL',
        summary: 'Test',
        occurredAt: null,
      })
      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('Dashboard', () => {
    it('returns a dashboard summary', async () => {
      const response = await request(app).get('/api/v1/dashboard').set(admin)
      expect(response.status).toBe(200)
      expect(response.body.data.companies).toHaveProperty('total')
      expect(response.body.data.companies).toHaveProperty('active')
      expect(response.body.data.leads).toHaveProperty('byStatus')
      expect(response.body.data.tasks).toHaveProperty('open')
      expect(response.body.data.tasks).toHaveProperty('overdue')
    })
  })

  describe('Pagination', () => {
    it('honors limit and computes total correctly', async () => {
      const created = []
      for (let i = 0; i < 3; i += 1) {
        const company = await request(app).post('/api/v1/companies').set(admin).send({
          name: `Paging Co ${Date.now()}-${i}`,
        })
        created.push(company.body.data.id)
      }

      const page = await request(app).get('/api/v1/companies').query({ limit: 2, page: 1 }).set(admin)
      expect(page.status).toBe(200)
      expect(page.body.data.length).toBeLessThanOrEqual(2)
      expect(page.body.meta).toHaveProperty('total')
      expect(page.body.meta.limit).toBe(2)

      for (const id of created) {
        await request(app).delete(`/api/v1/companies/${id}`).set(admin)
      }
    })
  })

  describe('Request correlation', () => {
    it('echoes request ids when provided', async () => {
      const requestId = 'test-correlation-id-123'
      const response = await request(app)
        .get('/api/v1/companies')
        .set(admin)
        .set('x-request-id', requestId)
      expect(response.body.meta.request_id).toBe(requestId)
    })
  })
})

describe('Phase 2 API integration', () => {
  let app: Express

  beforeAll(() => {
    app = createApp()
  })

  describe('Pipeline stages', () => {
    it('lists seeded pipeline stages', async () => {
      const response = await request(app).get('/api/v1/pipeline-stages').set(admin)
      expect(response.status).toBe(200)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
    })

    it('blocks members from creating pipeline stages', async () => {
      const response = await request(app)
        .post('/api/v1/pipeline-stages')
        .set(member)
        .send({ stage: 'WON', name: 'Won', sequence: 5, probability: 100 })
      expect(response.status).toBe(403)
      expect(response.body.error.code).toBe('FORBIDDEN')
    })

    it('rejects duplicate enum stages with 409 and updates an existing stage', async () => {
      const duplicate = await request(app)
        .post('/api/v1/pipeline-stages')
        .set(admin)
        .send({ stage: 'NEW', name: 'Duplicate New', sequence: 0, probability: 10 })
      expect(duplicate.status).toBe(409)

      const list = await request(app).get('/api/v1/pipeline-stages').set(admin)
      const target = list.body.data[0]
      const updated = await request(app)
        .put(`/api/v1/pipeline-stages/${target.id}`)
        .set(admin)
        .send({ probability: 41 })
      expect(updated.status).toBe(200)
      expect(updated.body.data.probability).toBe(41)

      await request(app)
        .put(`/api/v1/pipeline-stages/${target.id}`)
        .set(admin)
        .send({ probability: target.probability })
    })
  })

  describe('Opportunity operations', () => {
    it('creates, updates stage, and deletes an opportunity with audit events', async () => {
      const company = await request(app).post('/api/v1/companies').set(admin).send({
        name: `Opp Co ${Date.now()}`,
      })
      const companyId = company.body.data.id

      const created = await request(app).post('/api/v1/opportunities').set(admin).send({
        companyId,
        name: 'Integration deal',
        stage: 'PROPOSAL',
        amount: 75000,
        closeDate: '2026-12-01T00:00:00.000Z',
      })
      expect(created.status).toBe(201)
      expect(created.body.data.stage).toBe('PROPOSAL')
      const opportunityId = created.body.data.id

      const updated = await request(app)
        .put(`/api/v1/opportunities/${opportunityId}`)
        .set(admin)
        .send({ stage: 'WON' })
      expect(updated.status).toBe(200)
      expect(updated.body.data.stage).toBe('WON')

      const audit = await request(app)
        .get('/api/v1/audit')
        .query({ entityType: 'opportunity', entityId: opportunityId })
        .set(admin)
      const actions = audit.body.data.map((event: { action: string }) => event.action)
      expect(actions).toContain('opportunity.created')
      expect(actions).toContain('opportunity.stage-changed')

      const filtered = await request(app)
        .get('/api/v1/opportunities')
        .query({ companyId, stage: 'WON' })
        .set(admin)
      expect(filtered.status).toBe(200)
      expect(filtered.body.data.some((o: { id: string }) => o.id === opportunityId)).toBe(true)

      const deleted = await request(app).delete(`/api/v1/opportunities/${opportunityId}`).set(admin)
      expect(deleted.status).toBe(204)
      await request(app).delete(`/api/v1/companies/${companyId}`).set(admin)
    })

    it('blocks members from creating opportunities', async () => {
      const response = await request(app)
        .post('/api/v1/opportunities')
        .set(member)
        .send({ companyId: 'x', name: 'Sneaky', amount: 1 })
      expect(response.status).toBe(403)
    })
  })

  describe('Campaign operations', () => {
    it('creates a campaign and nested steps, then deletes the campaign', async () => {
      const created = await request(app).post('/api/v1/campaigns').set(admin).send({
        name: `Q4 Campaign ${Date.now()}`,
        type: 'OUTBOUND',
        status: 'DRAFT',
      })
      expect(created.status).toBe(201)
      const campaignId = created.body.data.id

      const step = await request(app).post(`/api/v1/campaigns/${campaignId}/steps`).set(admin).send({
        sequence: 1,
        actionType: 'EMAIL',
        subject: 'Intro',
        status: 'PENDING',
      })
      expect(step.status).toBe(201)
      expect(step.body.data.campaignId).toBe(campaignId)

      const steps = await request(app).get(`/api/v1/campaigns/${campaignId}/steps`).set(admin)
      expect(steps.status).toBe(200)
      expect(steps.body.data).toHaveLength(1)

      const stepId = step.body.data.id
      const updated = await request(app)
        .put(`/api/v1/campaign-steps/${stepId}`)
        .set(admin)
        .send({ status: 'DONE' })
      expect(updated.status).toBe(200)
      expect(updated.body.data.status).toBe('DONE')

      const deletedStep = await request(app).delete(`/api/v1/campaign-steps/${stepId}`).set(admin)
      expect(deletedStep.status).toBe(204)

      const deleted = await request(app).delete(`/api/v1/campaigns/${campaignId}`).set(admin)
      expect(deleted.status).toBe(204)
    })
  })

  describe('Follow-up operations', () => {
    it('creates a follow-up for an activity and emits an audit event', async () => {
      const company = await request(app).post('/api/v1/companies').set(admin).send({
        name: `FollowUp Co ${Date.now()}`,
      })
      const companyId = company.body.data.id

      const activity = await request(app).post('/api/v1/activities').set(admin).send({
        companyId,
        type: 'MEETING',
        summary: 'Deal review',
      })
      expect(activity.status).toBe(201)
      const activityId = activity.body.data.id

      const created = await request(app).post('/api/v1/follow-ups').set(admin).send({
        activityId,
        dueAt: '2026-09-25T09:00:00.000Z',
        status: 'OPEN',
        notes: 'Follow up on review',
      })
      expect(created.status).toBe(201)
      expect(created.body.data.activityId).toBe(activityId)

      const audit = await request(app)
        .get('/api/v1/audit')
        .query({ entityType: 'follow-up', entityId: created.body.data.id })
        .set(admin)
      expect(
        audit.body.data.some((e: { action: string }) => e.action === 'follow-up.created'),
      ).toBe(true)

      await request(app).delete(`/api/v1/follow-ups/${created.body.data.id}`).set(admin)
      await request(app).delete(`/api/v1/activities/${activityId}`).set(admin)
      await request(app).delete(`/api/v1/companies/${companyId}`).set(admin)
    })
  })

  describe('Analytics', () => {
    it('returns pipeline, campaign, and follow-up analytics', async () => {
      const pipeline = await request(app).get('/api/v1/analytics/pipeline').set(admin)
      expect(pipeline.status).toBe(200)
      expect(pipeline.body.data).toHaveProperty('totalValue')
      expect(pipeline.body.data).toHaveProperty('byStage')
      expect(Array.isArray(pipeline.body.data.byStage)).toBe(true)

      const campaigns = await request(app).get('/api/v1/analytics/campaigns').set(admin)
      expect(campaigns.status).toBe(200)
      expect(campaigns.body.data).toHaveProperty('total')
      expect(campaigns.body.data).toHaveProperty('byStatus')

      const followUps = await request(app).get('/api/v1/analytics/follow-ups').set(admin)
      expect(followUps.status).toBe(200)
      expect(followUps.body.data).toHaveProperty('overdueCount')
    })

    it('allows members to read analytics', async () => {
      const response = await request(app).get('/api/v1/analytics/pipeline').set(member)
      expect(response.status).toBe(200)
    })
  })

  describe('Phase 3 ecosystem and use cases', () => {
    it('creates a community, contributor, partner, investor, and use case with audit events', async () => {
      const community = await request(app).post('/api/v1/communities').set(admin).send({
        name: `Builders Guild ${Date.now()}`,
        purpose: 'Open-source community',
      })
      expect(community.status).toBe(201)
      const communityId = community.body.data.id

      const contributor = await request(app).post('/api/v1/contributors').set(admin).send({
        name: 'Rina Haryanto',
        role: 'MAINTAINER',
        status: 'ACTIVE',
        communityId,
      })
      expect(contributor.status).toBe(201)
      expect(contributor.body.data.communityId).toBe(communityId)
      const contributorId = contributor.body.data.id

      const partner = await request(app).post('/api/v1/partners').set(admin).send({
        name: `DigitalOcean ${Date.now()}`,
        partnerType: 'TECHNOLOGY',
      })
      expect(partner.status).toBe(201)
      const partnerId = partner.body.data.id

      const investor = await request(app).post('/api/v1/investors').set(admin).send({
        name: 'East Ventures',
        investorType: 'VENTURE',
      })
      expect(investor.status).toBe(201)
      const investorId = investor.body.data.id

      const company = await request(app).post('/api/v1/companies').set(admin).send({
        name: `UseCase Co ${Date.now()}`,
      })
      const opportunity = await request(app).post('/api/v1/opportunities').set(admin).send({
        companyId: company.body.data.id,
        name: 'SDK licensing pilot',
        stage: 'PROPOSAL',
        amount: 12000,
      })
      expect(opportunity.status).toBe(201)

      const useCase = await request(app).post('/api/v1/use-cases').set(admin).send({
        opportunityId: opportunity.body.data.id,
        title: 'Transparent SDK licensing dashboard',
        value: 12000,
      })
      expect(useCase.status).toBe(201)
      expect(useCase.body.data.opportunityId).toBe(opportunity.body.data.id)
      const useCaseId = useCase.body.data.id

      const audit = await request(app).get('/api/v1/audit').query({ entityType: 'use-case' }).set(admin)
      expect(audit.body.data.some((e: { action: string }) => e.action === 'use-case.created')).toBe(true)

      expect((await request(app).get('/api/v1/contributors').set(member)).status).toBe(200)
      expect((await request(app).post('/api/v1/contributors').set(member).send({ name: 'Nope', role: 'DEVELOPER' })).status).toBe(403)
      expect((await request(app).post('/api/v1/partners').set(member).send({ name: 'Nope', partnerType: 'CHANNEL' })).status).toBe(403)

      await request(app).delete(`/api/v1/use-cases/${useCaseId}`).set(admin)
      await request(app).delete(`/api/v1/opportunities/${opportunity.body.data.id}`).set(admin)
      await request(app).delete(`/api/v1/companies/${company.body.data.id}`).set(admin)
      await request(app).delete(`/api/v1/investors/${investorId}`).set(admin)
      await request(app).delete(`/api/v1/partners/${partnerId}`).set(admin)
      await request(app).delete(`/api/v1/contributors/${contributorId}`).set(admin)
      await request(app).delete(`/api/v1/communities/${communityId}`).set(admin)
    })
  })
})