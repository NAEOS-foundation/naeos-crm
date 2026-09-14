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

export class DefaultAuthorizationService implements AuthorizationService {
  authorize(
    actor: AuthenticatedActor,
    resource: string,
    action: string,
    _context?: Record<string, unknown>,
  ): AuthorizationDecision {
    if (resource === 'company' && action === 'read') {
      return { allow: true, reason: 'default-company-read-policy', policyVersion: '2026.09.14' }
    }

    if (resource === 'company' && action === 'write') {
      const permittedRoles = new Set(['admin', 'manager'])
      const hasWriteAccess = actor.roles.some((role) => permittedRoles.has(role))

      if (hasWriteAccess) {
        return { allow: true, reason: 'default-company-write-policy', policyVersion: '2026.09.14' }
      }

      return {
        allow: false,
        reason: 'insufficient-role-for-company-write',
        policyVersion: '2026.09.14',
      }
    }

    return {
      allow: false,
      reason: 'authorization-not-configured',
      policyVersion: '2026.09.14',
    }
  }
}
