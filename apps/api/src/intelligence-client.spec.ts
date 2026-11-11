import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeEngineeringRepository, IntelligenceUnavailableError } from './intelligence-client'

const validAnalysis = {
  request_id: 'analysis-42',
  intent: 'Read-only engineering analysis',
  plan: { steps: [] },
  runtime_result: { summary: 'ok' },
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

function configureService() {
  vi.stubEnv('INTELLIGENCE_API_URL', 'https://intelligence.example')
  vi.stubEnv('INTELLIGENCE_SERVICE_TOKEN', 'test-service-token')
  vi.stubEnv('INTELLIGENCE_ALLOWED_REPOSITORIES', 'NAEOS-foundation/naeos')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('Intelligence engineering analysis client', () => {
  it('fails closed when required configuration is missing', async () => {
    vi.stubEnv('INTELLIGENCE_API_URL', '')
    vi.stubEnv('INTELLIGENCE_SERVICE_TOKEN', '')
    vi.stubEnv('INTELLIGENCE_ALLOWED_REPOSITORIES', '')
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(analyzeEngineeringRepository('NAEOS-foundation/naeos', 'req-1'))
      .rejects.toBeInstanceOf(IntelligenceUnavailableError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects non-HTTPS service URLs outside localhost', async () => {
    configureService()
    vi.stubEnv('INTELLIGENCE_API_URL', 'http://intelligence.example')
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(analyzeEngineeringRepository('NAEOS-foundation/naeos', 'req-2'))
      .rejects.toBeInstanceOf(IntelligenceUnavailableError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows the Docker host gateway over HTTP outside production only', async () => {
    configureService()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('INTELLIGENCE_API_URL', 'http://host.docker.internal:8080')
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ request_id: 'docker-request' }))
      .mockResolvedValueOnce(jsonResponse(validAnalysis))

    await expect(analyzeEngineeringRepository('NAEOS-foundation/naeos', 'req-docker'))
      .resolves.toEqual(validAnalysis)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.stubEnv('NODE_ENV', 'production')
    await expect(analyzeEngineeringRepository('NAEOS-foundation/naeos', 'req-prod'))
      .rejects.toBeInstanceOf(IntelligenceUnavailableError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects repositories outside the allowlist before upstream requests', async () => {
    configureService()
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(analyzeEngineeringRepository('NAEOS-foundation/other-repo', 'req-3'))
      .rejects.toThrow('Repository is not enabled for Intelligence analysis')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits an analysis-only request and validates the returned analysis', async () => {
    configureService()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ request_id: 'request/with spaces' }))
      .mockResolvedValueOnce(jsonResponse(validAnalysis))

    const result = await analyzeEngineeringRepository('NAEOS-foundation/NAEOS', 'req-4')

    expect(result).toEqual(validAnalysis)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://intelligence.example/api/v1/intelligence/requests')
    const firstRequest = fetchMock.mock.calls[0]?.[1]
    expect(firstRequest?.headers).toMatchObject({
      Authorization: 'Bearer test-service-token',
      'X-Request-ID': 'crm-req-4',
      'Idempotency-Key': 'crm-req-4',
    })
    expect(JSON.parse(String(firstRequest?.body))).toMatchObject({
      execution_mode: 'analysis_only',
      context_sources: [{ type: 'naeos-core', reference: 'NAEOS-foundation/NAEOS' }],
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://intelligence.example/api/v1/intelligence/requests/request%2Fwith%20spaces/analyze',
    )
  })

  it('maps upstream HTTP errors to an unavailable error', async () => {
    configureService()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 500))

    await expect(analyzeEngineeringRepository('NAEOS-foundation/naeos', 'req-5'))
      .rejects.toThrow('Intelligence service returned status 500')
  })

  it('rejects an accepted request without a valid request_id', async () => {
    configureService()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ request_id: 17 }))

    await expect(analyzeEngineeringRepository('NAEOS-foundation/naeos', 'req-6'))
      .rejects.toThrow('Intelligence service returned an invalid request')
  })

  it('rejects malformed analysis payloads instead of casting them', async () => {
    configureService()
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ request_id: 'request-7' }))
      .mockResolvedValueOnce(jsonResponse({ request_id: 'missing-contract-fields' }))

    await expect(analyzeEngineeringRepository('NAEOS-foundation/naeos', 'req-7'))
      .rejects.toThrow('Intelligence service returned an invalid response')
  })
})
