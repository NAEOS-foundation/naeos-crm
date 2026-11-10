type AcceptedIntelligenceRequest = { request_id?: unknown }

export type EngineeringAnalysis = {
  request_id: string
  intent: string
  plan: unknown
  runtime_result: unknown
  policy_decision: unknown
  provenance: string
  created_at: string
}

export class IntelligenceUnavailableError extends Error {}

function serviceConfig() {
  const rawURL = process.env.INTELLIGENCE_API_URL?.trim()
  const token = process.env.INTELLIGENCE_SERVICE_TOKEN?.trim()
  const allowedRepositories = (process.env.INTELLIGENCE_ALLOWED_REPOSITORIES ?? '')
    .split(',')
    .map((repository) => repository.trim().toLowerCase())
    .filter(Boolean)
  if (!rawURL || !token || allowedRepositories.length === 0) {
    throw new IntelligenceUnavailableError('Intelligence integration is not configured')
  }

  let baseURL: URL
  try {
    baseURL = new URL(rawURL)
  } catch {
    throw new IntelligenceUnavailableError('Intelligence integration is not configured')
  }
  const localHTTP = baseURL.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(baseURL.hostname)
  if ((baseURL.protocol !== 'https:' && !localHTTP) || baseURL.username || baseURL.password) {
    throw new IntelligenceUnavailableError('Intelligence integration is not configured')
  }
  return { baseURL: baseURL.toString().replace(/\/$/, ''), token, allowedRepositories }
}

async function serviceRequest<T>(path: string, body: unknown, requestId: string): Promise<T> {
  const { baseURL, token } = serviceConfig()
  let response: Response
  try {
    response = await fetch(`${baseURL}/api/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'Idempotency-Key': requestId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new IntelligenceUnavailableError('Intelligence service request failed')
  }
  if (!response.ok) throw new IntelligenceUnavailableError(`Intelligence service returned status ${response.status}`)
  try {
    return await response.json() as T
  } catch {
    throw new IntelligenceUnavailableError('Intelligence service returned an invalid response')
  }
}

export async function analyzeEngineeringRepository(repository: string, requestId: string): Promise<EngineeringAnalysis> {
  const config = serviceConfig()
  if (!config.allowedRepositories.includes(repository.toLowerCase())) {
    throw new IntelligenceUnavailableError('Repository is not enabled for Intelligence analysis')
  }
  const accepted = await serviceRequest<AcceptedIntelligenceRequest>('/intelligence/requests', {
    purpose: 'Read-only engineering repository analysis',
    execution_mode: 'analysis_only',
    context_sources: [{ type: 'naeos-core', reference: repository }],
    desired_outputs: ['architecture', 'engineering_risks', 'recommended_next_steps'],
  }, `crm-${requestId}`)
  if (typeof accepted.request_id !== 'string' || accepted.request_id === '') {
    throw new IntelligenceUnavailableError('Intelligence service returned an invalid request')
  }

  return serviceRequest<EngineeringAnalysis>(`/intelligence/requests/${encodeURIComponent(accepted.request_id)}/analyze`, {}, `crm-${requestId}`)
}
