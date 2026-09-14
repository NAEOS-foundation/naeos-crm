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

const POLICY_VERSION = '2026.09.14'

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
