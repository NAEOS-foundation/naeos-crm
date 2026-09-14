import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from './app'

const devHeader = (roles: string[]) => ({
  'x-naeos-dev-user': JSON.stringify({ id: 'test-user', email: 'test@naeos.local', roles }),
})

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
    // On CI AUTH_DISABLED=false expects 401. In local dev with AUTH_DISABLED=true,
    // the dev fallback applies. This test documents the 401 contract for secure mode.
    const original = process.env.AUTH_DISABLED
    process.env.AUTH_DISABLED = 'false'
    const secureApp = createApp()
    const response = await request(secureApp).get('/api/v1/users')
    expect(response.status).toBe(401)
    process.env.AUTH_DISABLED = original ?? 'true'
  })

  describe('RBAC enforcement', () => {
    it('allows members to read companies but not users', async () => {
      const member = devHeader(['member'])

      const companies = await request(app).get('/api/v1/companies').set(member)
      expect(companies.status).toBe(200)
      expect(Array.isArray(companies.body.data)).toBe(true)

      const users = await request(app).get('/api/v1/users').set(member)
      expect(users.status).toBe(403)
      expect(users.body.error.code).toBe('FORBIDDEN')
    })

    it('allows admins to administer users', async () => {
      const admin = devHeader(['admin'])
      const response = await request(app).get('/api/v1/users').set(admin)
      expect(response.status).toBe(200)
    })

    it('records denied authorization attempts in the audit log', async () => {
      const member = devHeader(['member'])
      await request(app).get('/api/v1/users').set(member)

      const admin = devHeader(['admin'])
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
      const admin = devHeader(['admin'])

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
      const admin = devHeader(['admin'])
      const response = await request(app).post('/api/v1/companies').set(admin).send({ name: '' })
      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('blocks members from deleting companies', async () => {
      const member = devHeader(['member'])
      const response = await request(app)
        .delete('/api/v1/companies/does-not-matter')
        .set(member)
      expect(response.status).toBe(403)
    })
  })

  describe('Contact, lead, activity, task operations', () => {
    it('returns lists for contact, lead, activity, and task endpoints', async () => {
      const admin = devHeader(['admin'])

      for (const path of ['/api/v1/contacts', '/api/v1/leads', '/api/v1/activities', '/api/v1/tasks']) {
        const response = await request(app).get(path).set(admin)
        expect(response.status).toBe(200)
        expect(Array.isArray(response.body.data)).toBe(true)
      }
    })

    it('creates a lead and verifies the audit event', async () => {
      const admin = devHeader(['admin'])

      const companies = await request(app).get('/api/v1/companies').set(admin)
      const companyId = companies.body.data[0].id

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
    })
  })

  describe('Dashboard', () => {
    it('returns a dashboard summary', async () => {
      const admin = devHeader(['admin'])
      const response = await request(app).get('/api/v1/dashboard').set(admin)
      expect(response.status).toBe(200)
      expect(response.body.data.companies).toHaveProperty('total')
      expect(response.body.data.companies).toHaveProperty('active')
      expect(response.body.data.leads).toHaveProperty('byStatus')
      expect(response.body.data.tasks).toHaveProperty('open')
      expect(response.body.data.tasks).toHaveProperty('overdue')
    })
  })

  describe('Request correlation', () => {
    it('echoes request ids when provided', async () => {
      const admin = devHeader(['admin'])
      const requestId = 'test-correlation-id-123'
      const response = await request(app)
        .get('/api/v1/companies')
        .set(admin)
        .set('x-request-id', requestId)
      expect(response.body.meta.request_id).toBe(requestId)
    })
  })
})