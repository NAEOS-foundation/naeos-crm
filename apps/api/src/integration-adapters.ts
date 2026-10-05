import type { ExternalActionPort } from './ports'
import { createHash } from 'node:crypto'

function mockProviderRequestId(provider: string, input: Record<string, unknown>): string {
  const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 24)
  return `mock-${provider}-${digest}`
}

export class EmailAdapter implements ExternalActionPort {
  async execute(input: Record<string, unknown>): Promise<{ ok: boolean; providerResponse?: unknown; provider?: string; providerRequestId?: string }> {
    return {
      ok: true,
      provider: 'email',
      providerRequestId: mockProviderRequestId('email', input),
      providerResponse: {
        provider: 'email',
        payload: input,
      },
    }
  }
}

export class GitHubAdapter implements ExternalActionPort {
  async execute(input: Record<string, unknown>): Promise<{ ok: boolean; providerResponse?: unknown; provider?: string; providerRequestId?: string }> {
    return {
      ok: true,
      provider: 'github',
      providerRequestId: mockProviderRequestId('github', input),
      providerResponse: {
        provider: 'github',
        payload: input,
      },
    }
  }
}
