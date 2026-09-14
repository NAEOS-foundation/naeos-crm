import type { PolicyPort } from './ports'

export class NAEOSPolicyAdapter implements PolicyPort {
  async evaluate(input: Record<string, unknown>): Promise<{
    allow: boolean
    policyVersion?: string
    reason?: string
  }> {
    return {
      allow: Boolean(input.allow),
      policyVersion: '2026.09.14',
      reason: 'placeholder-policy-evaluation',
    }
  }
}
