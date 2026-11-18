import type { PolicyRule, UserRole } from '@naeos-crm/domain'
import { POLICY_VERSION } from '@naeos-crm/auth'

import type { PolicyRuleReadPort } from './domain-interfaces'
import type { PolicyPort } from './ports'

export interface PolicyEvaluationInput {
  resource: string
  action: string
  roles: UserRole[]
}

export class NAEOSPolicyAdapter implements PolicyPort {
  constructor(private readonly rules: PolicyRuleReadPort) {}

  async evaluate(input: Record<string, unknown>): Promise<{
    allow: boolean
    policyVersion?: string
    reason?: string
  }> {
    const { resource, action, roles } = input as unknown as PolicyEvaluationInput
    const matched = await this.rules.findForEvaluation(resource, action, roles)

    if (matched.length === 0) {
      return {
        allow: false,
        policyVersion: POLICY_VERSION,
        reason: `no-policy-rule-for-${input.resource}:${input.action}`,
      }
    }

    const sorted = [...matched].sort((a: PolicyRule, b: PolicyRule) => {
      if (a.priority !== b.priority) return b.priority - a.priority
      if (a.effect !== b.effect) return a.effect === 'DENY' ? -1 : 1
      return a.updatedAt.getTime() - b.updatedAt.getTime()
    })

    const best = sorted[0]
    return {
      allow: best.effect === 'ALLOW',
      policyVersion: POLICY_VERSION,
      reason: `policy-rule:${best.id}:${best.effect}`,
    }
  }
}