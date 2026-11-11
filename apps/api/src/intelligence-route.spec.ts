import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app'

const admin = {
  'x-naeos-dev-user': JSON.stringify({ id: 'intelligence-admin-test', email: 'admin@naeos.local', roles: ['admin'] }),
}
const manager = {
  'x-naeos-dev-user': JSON.stringify({ id: 'intelligence-manager-test', email: 'manager@naeos.local', roles: ['manager'] }),
}
const repository = 'NAEOS-foundation/naeos'

const analysis = {
  request_id: 'analysis-test-1',
  intent: 'Read-only repository analysis',
  plan: { steps: [] },
  runtime_result: { summary: 'test result' },
  policy_decision: { allowed: true },
  provenance: 'naeos-core',
  created_at: '2026-11-10T00:00:00.000Z',
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Intelligence engineering analysis route', () => {
  it('requires authentication in secure mode', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('AUTH_DISABLED', 'false')
    vi.stubEnv('AUTH_SECRET', 'test-secret-012345678901234567890123')

    const response = await request(createApp())
      .post('/api/v1/intelligence/engineering-analysis')
      .send({ repository })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('denies managers without intelligence:analyze permission', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('AUTH_DISABLED', 'true')
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await request(createApp())
      .post('/api/v1/intelligence/engineering-analysis')
      .set(manager)
      .send({ repository })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed with 503 when the integration is not configured for an admin', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('AUTH_DISABLED', 'true')
    vi.stubEnv('INTELLIGENCE_API_URL', '')
    vi.stubEnv('INTELLIGENCE_SERVICE_TOKEN', '')
    vi.stubEnv('INTELLIGENCE_ALLOWED_REPOSITORIES', '')
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const response = await request(createApp())
      .post('/api/v1/intelligence/engineering-analysis')
      .set(admin)
      .send({ repository })

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('INTELLIGENCE_UNAVAILABLE')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a validated read-only analysis for an allowlisted admin repository', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('AUTH_DISABLED', 'true')
    vi.stubEnv('INTELLIGENCE_API_URL', 'https://intelligence.example')
    vi.stubEnv('INTELLIGENCE_SERVICE_TOKEN', 'test-service-token')
    vi.stubEnv('INTELLIGENCE_ALLOWED_REPOSITORIES', repository)
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ request_id: 'accepted-request' }))
      .mockResolvedValueOnce(jsonResponse(analysis))

    const response = await request(createApp())
      .post('/api/v1/intelligence/engineering-analysis')
      .set(admin)
      .set('x-request-id', 'intelligence-route-success')
      .send({ repository })

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(analysis)
    expect(response.body.meta.request_id).toBe('intelligence-route-success')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
