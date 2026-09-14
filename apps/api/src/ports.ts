export interface ExternalActionPort {
  execute(input: Record<string, unknown>): Promise<{ ok: boolean; providerResponse?: unknown }>
}

export interface PolicyPort {
  evaluate(input: Record<string, unknown>): Promise<{
    allow: boolean
    policyVersion?: string
    reason?: string
  }>
}
