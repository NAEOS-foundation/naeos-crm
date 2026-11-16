import { describe, expect, it, vi } from 'vitest'
import {
  authorizeTenantRequest,
  type CanonicalPrincipal,
  type ResolvedTenantMembership,
  type TenantMembershipResolver,
  type TenantPolicyEvaluator,
} from '@naeos-crm/auth'

const principal: CanonicalPrincipal = {
  issuer: 'https://kqmhpsftijskesjdovjm.supabase.co/auth/v1',
  subject: '11111111-1111-4111-8111-111111111111',
}
const scope = {
  organizationId: '22222222-2222-4222-8222-222222222222',
  workspaceId: '33333333-3333-4333-8333-333333333333',
}
const membership: ResolvedTenantMembership = {
  membershipId: '44444444-4444-4444-8444-444444444444',
  principal,
  ...scope,
  status: 'active',
  organizationStatus: 'active',
  workspaceStatus: 'active',
  roleKeys: ['workspace_admin'],
}

function dependencies(
  resolved: ResolvedTenantMembership | null = membership,
  allowed = true,
) {
  const resolver: TenantMembershipResolver = {
    resolve: vi.fn().mockResolvedValue(resolved),
  }
  const evaluator: TenantPolicyEvaluator = {
    allows: vi.fn().mockResolvedValue(allowed),
  }
  return { resolver, evaluator }
}

describe('authorizeTenantRequest', () => {
  it('allows only an active membership with exact principal and tenant scope and capability', async () => {
    const deps = dependencies()
    const result = await authorizeTenantRequest(
      { principal, scope, capability: 'crm:company:read' },
      deps.resolver,
      deps.evaluator,
    )
    expect(result).toEqual({
      allow: true,
      reason: 'capability-granted',
      membershipId: membership.membershipId,
    })
    expect(deps.resolver.resolve).toHaveBeenCalledWith(principal, scope)
    expect(deps.evaluator.allows).toHaveBeenCalledWith(membership, 'crm:company:read')
  })

  it('denies a missing membership', async () => {
    const deps = dependencies(null)
    const result = await authorizeTenantRequest(
      { principal, scope, capability: 'crm:company:read' },
      deps.resolver,
      deps.evaluator,
    )
    expect(result).toEqual({ allow: false, reason: 'membership-not-found' })
    expect(deps.evaluator.allows).not.toHaveBeenCalled()
  })

  it('denies a membership resolved for another principal', async () => {
    const deps = dependencies({
      ...membership,
      principal: { issuer: principal.issuer, subject: '55555555-5555-4555-8555-555555555555' },
    })
    const result = await authorizeTenantRequest(
      { principal, scope, capability: 'crm:company:read' },
      deps.resolver,
      deps.evaluator,
    )
    expect(result.reason).toBe('membership-principal-mismatch')
    expect(deps.evaluator.allows).not.toHaveBeenCalled()
  })

  it('denies a membership resolved for another organization or workspace', async () => {
    const deps = dependencies({ ...membership, workspaceId: '66666666-6666-4666-8666-666666666666' })
    const result = await authorizeTenantRequest(
      { principal, scope, capability: 'crm:company:read' },
      deps.resolver,
      deps.evaluator,
    )
    expect(result.reason).toBe('membership-scope-mismatch')
    expect(deps.evaluator.allows).not.toHaveBeenCalled()
  })

  it.each(['invited', 'suspended', 'revoked'] as const)('denies membership status %s', async (status) => {
    const deps = dependencies({ ...membership, status })
    const result = await authorizeTenantRequest(
      { principal, scope, capability: 'crm:company:read' },
      deps.resolver,
      deps.evaluator,
    )
    expect(result.reason).toBe('membership-not-active')
    expect(deps.evaluator.allows).not.toHaveBeenCalled()
  })

  it.each([
    ['suspended organization', { organizationStatus: 'suspended' as const }],
    ['pending organization', { organizationStatus: 'pending' as const }],
    ['suspended workspace', { workspaceStatus: 'suspended' as const }],
    ['pending workspace', { workspaceStatus: 'pending' as const }],
  ])('denies an inactive tenant lifecycle: %s', async (_label, lifecycle) => {
    const deps = dependencies({ ...membership, ...lifecycle })
    const result = await authorizeTenantRequest(
      { principal, scope, capability: 'crm:company:read' },
      deps.resolver,
      deps.evaluator,
    )
    expect(result.reason).toBe('tenant-not-active')
    expect(deps.evaluator.allows).not.toHaveBeenCalled()
  })

  it('denies a capability that the trusted policy evaluator rejects', async () => {
    const deps = dependencies(membership, false)
    const result = await authorizeTenantRequest(
      { principal, scope, capability: 'crm:company:delete' },
      deps.resolver,
      deps.evaluator,
    )
    expect(result).toEqual({
      allow: false,
      reason: 'capability-denied',
      membershipId: membership.membershipId,
    })
  })

  it('fails closed when the membership resolver or policy evaluator throws', async () => {
    const resolver = { resolve: vi.fn().mockRejectedValue(new Error('db unavailable')) }
    const evaluator = { allows: vi.fn().mockResolvedValue(true) }
    const result = await authorizeTenantRequest(
      { principal, scope, capability: 'crm:company:read' },
      resolver,
      evaluator,
    )
    expect(result).toEqual({ allow: false, reason: 'authorization-dependency-failed' })
  })

  it('rejects malformed principal, UUID scope, or blank capability before lookup', async () => {
    const deps = dependencies()
    const blankPrincipal = await authorizeTenantRequest(
      { principal: { issuer: ' ', subject: principal.subject }, scope, capability: 'crm:company:read' },
      deps.resolver,
      deps.evaluator,
    )
    const malformedScope = await authorizeTenantRequest(
      { principal, scope: { ...scope, organizationId: 'not-a-uuid' }, capability: 'crm:company:read' },
      deps.resolver,
      deps.evaluator,
    )
    const blankCapability = await authorizeTenantRequest(
      { principal, scope, capability: ' ' },
      deps.resolver,
      deps.evaluator,
    )
    expect(blankPrincipal.reason).toBe('invalid-principal')
    expect(malformedScope.reason).toBe('invalid-tenant-scope')
    expect(blankCapability.reason).toBe('invalid-tenant-scope')
    expect(deps.resolver.resolve).not.toHaveBeenCalled()
  })
})
