export type UserRole = 'admin' | 'manager' | 'member'

export interface AuthenticatedActor {
  id: string
  email: string
  roles: UserRole[]
}

export interface AuthorizationDecision {
  allow: boolean
  reason?: string
  policyVersion?: string
}

export interface AuthorizationService {
  authorize(
    actor: AuthenticatedActor,
    resource: string,
    action: string,
    context?: Record<string, unknown>,
  ): AuthorizationDecision
}

export const POLICY_VERSION = '2026.09.17'

type ResourceAction = `${string}:${string}`

const ROLE_PERMISSIONS: Record<UserRole, Set<ResourceAction>> = {
  admin: new Set([
    'user:read',
    'user:write',
    'user:delete',
    'company:read',
    'company:write',
    'company:delete',
    'contact:read',
    'contact:write',
    'contact:delete',
    'lead:read',
    'lead:write',
    'lead:delete',
    'activity:read',
    'activity:write',
    'activity:delete',
    'task:read',
    'task:write',
    'task:delete',
    'opportunity:read',
    'opportunity:write',
    'opportunity:delete',
    'pipeline:read',
    'pipeline:write',
    'pipeline:delete',
    'campaign:read',
    'campaign:write',
    'campaign:delete',
    'follow-up:read',
    'follow-up:write',
    'follow-up:delete',
    'analytics:read',
    'contributor:read',
    'contributor:write',
    'contributor:delete',
    'partner:read',
    'partner:write',
    'partner:delete',
    'community:read',
    'community:write',
    'community:delete',
    'investor:read',
    'investor:write',
    'investor:delete',
    'use-case:read',
    'use-case:write',
    'use-case:delete',
    'go-gate:read',
    'go-gate:write',
    'go-gate:approve',
    'go-gate:execute',
    'policy:read',
    'policy:write',
    'policy:delete',
    'intelligence:analyze',
    'control-plane:read',
    'audit:read',
    'dashboard:read',
  ]),
  manager: new Set([
    'user:read',
    'company:read',
    'company:write',
    'contact:read',
    'contact:write',
    'contact:delete',
    'lead:read',
    'lead:write',
    'lead:delete',
    'activity:read',
    'activity:write',
    'activity:delete',
    'task:read',
    'task:write',
    'task:delete',
    'opportunity:read',
    'opportunity:write',
    'opportunity:delete',
    'pipeline:read',
    'campaign:read',
    'campaign:write',
    'campaign:delete',
    'follow-up:read',
    'follow-up:write',
    'follow-up:delete',
    'analytics:read',
    'contributor:read',
    'contributor:write',
    'contributor:delete',
    'partner:read',
    'partner:write',
    'partner:delete',
    'community:read',
    'community:write',
    'community:delete',
    'investor:read',
    'investor:write',
    'investor:delete',
    'use-case:read',
    'use-case:write',
    'use-case:delete',
    'go-gate:read',
    'go-gate:write',
    'go-gate:approve',
    'policy:read',
    'audit:read',
    'dashboard:read',
  ]),
  member: new Set([
    'company:read',
    'contact:read',
    'contact:write',
    'lead:read',
    'activity:read',
    'activity:write',
    'task:read',
    'task:write',
    'opportunity:read',
    'pipeline:read',
    'campaign:read',
    'follow-up:read',
    'follow-up:write',
    'analytics:read',
    'contributor:read',
    'partner:read',
    'community:read',
    'investor:read',
    'use-case:read',
    'go-gate:read',
    'go-gate:write',
    'dashboard:read',
  ]),
}

export class DefaultAuthorizationService implements AuthorizationService {
  authorize(
    actor: AuthenticatedActor,
    resource: string,
    action: string,
    _context?: Record<string, unknown>,
  ): AuthorizationDecision {
    if (!actor || !actor.roles || actor.roles.length === 0) {
      return {
        allow: false,
        reason: 'no-roles-assigned',
        policyVersion: POLICY_VERSION,
      }
    }

    const permission = `${resource}:${action}` as ResourceAction

    const hasPermission = actor.roles.some((role) => {
      const rolePerms = ROLE_PERMISSIONS[role]
      return rolePerms?.has(permission) ?? false
    })

    if (hasPermission) {
      return {
        allow: true,
        reason: `role-granted-${permission}`,
        policyVersion: POLICY_VERSION,
      }
    }

    return {
      allow: false,
      reason: `insufficient-role-for-${permission}`,
      policyVersion: POLICY_VERSION,
    }
  }
}


/**
 * Canonical cross-service identity and tenant authorization contract.
 *
 * These contracts deliberately do not infer tenant access from CRM's legacy
 * platform roles (admin/manager/member), JWT authenticated role, or user metadata.
 * Membership resolution and capability policy must be supplied by a trusted
 * server-side adapter.
 */
export interface CanonicalPrincipal {
  issuer: string
  subject: string
}

export interface TenantScope {
  organizationId: string
  workspaceId: string
}

export type TenantMembershipStatus = 'active' | 'invited' | 'suspended' | 'revoked'

export type TenantLifecycleStatus = 'active' | 'pending' | 'suspended'

export interface ResolvedTenantMembership {
  membershipId: string
  principal: CanonicalPrincipal
  organizationId: string
  workspaceId: string
  status: TenantMembershipStatus
  organizationStatus: TenantLifecycleStatus
  workspaceStatus: TenantLifecycleStatus
  roleKeys: readonly string[]
}

export interface TenantMembershipResolver {
  resolve(
    principal: CanonicalPrincipal,
    scope: TenantScope,
  ): Promise<ResolvedTenantMembership | null>
}

export interface TenantPolicyEvaluator {
  allows(membership: ResolvedTenantMembership, capability: string): Promise<boolean>
}

export interface TenantAuthorizationRequest {
  principal: CanonicalPrincipal
  scope: TenantScope
  capability: string
}

export interface TenantAuthorizationDecision {
  allow: boolean
  reason:
    | 'invalid-principal'
    | 'invalid-tenant-scope'
    | 'membership-not-found'
    | 'membership-principal-mismatch'
    | 'membership-scope-mismatch'
    | 'membership-not-active'
    | 'tenant-not-active'
    | 'capability-denied'
    | 'authorization-dependency-failed'
    | 'capability-granted'
  membershipId?: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isNonBlank(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Resolve and authorize one exact organization/workspace capability.
 * Any absent, mismatched, inactive, or failing dependency is denied by default.
 */
export async function authorizeTenantRequest(
  request: TenantAuthorizationRequest,
  resolver: TenantMembershipResolver,
  evaluator: TenantPolicyEvaluator,
): Promise<TenantAuthorizationDecision> {
  if (!request || !request.principal || !request.scope) {
    return { allow: false, reason: 'invalid-principal' }
  }
  if (!isNonBlank(request.principal.issuer) || !isNonBlank(request.principal.subject)) {
    return { allow: false, reason: 'invalid-principal' }
  }
  if (
    !UUID_PATTERN.test(request.scope.organizationId) ||
    !UUID_PATTERN.test(request.scope.workspaceId) ||
    !isNonBlank(request.capability)
  ) {
    return { allow: false, reason: 'invalid-tenant-scope' }
  }

  try {
    const membership = await resolver.resolve(request.principal, request.scope)
    if (!membership) return { allow: false, reason: 'membership-not-found' }

    if (
      membership.principal.issuer !== request.principal.issuer ||
      membership.principal.subject !== request.principal.subject
    ) {
      return { allow: false, reason: 'membership-principal-mismatch' }
    }
    if (
      membership.organizationId !== request.scope.organizationId ||
      membership.workspaceId !== request.scope.workspaceId
    ) {
      return { allow: false, reason: 'membership-scope-mismatch' }
    }
    if (membership.status !== 'active') {
      return { allow: false, reason: 'membership-not-active' }
    }
    if (membership.organizationStatus !== 'active' || membership.workspaceStatus !== 'active') {
      return { allow: false, reason: 'tenant-not-active' }
    }

    if (!(await evaluator.allows(membership, request.capability))) {
      return { allow: false, reason: 'capability-denied', membershipId: membership.membershipId }
    }
    return { allow: true, reason: 'capability-granted', membershipId: membership.membershipId }
  } catch {
    return { allow: false, reason: 'authorization-dependency-failed' }
  }
}
