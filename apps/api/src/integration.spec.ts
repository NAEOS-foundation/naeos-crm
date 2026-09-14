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