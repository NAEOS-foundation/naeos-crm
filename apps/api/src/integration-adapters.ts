import type { ExternalActionPort } from './ports'

export class EmailAdapter implements ExternalActionPort {
  async execute(input: Record<string, unknown>): Promise<{ ok: boolean; providerResponse?: unknown }> {
    return {
      ok: true,
      providerResponse: {
        provider: 'email',
        payload: input,
      },
    }
  }
}

export class GitHubAdapter implements ExternalActionPort {
  async execute(input: Record<string, unknown>): Promise<{ ok: boolean; providerResponse?: unknown }> {
    return {
      ok: true,
      providerResponse: {
        provider: 'github',
        payload: input,
      },
    }
  }
}
