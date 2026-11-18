import { AuthenticatedActor, AuthorizationDecision, AuthorizationService } from '@naeos-crm/auth'

export interface RequestContext {
  actor?: AuthenticatedActor
}

export class ApiAuthGuard {
  constructor(private readonly authz: AuthorizationService) {}

  authorize(
    context: RequestContext,
    resource: string,
    action: string,
    metadata?: Record<string, unknown>,
  ): AuthorizationDecision {
    if (!context.actor) {
      return { allow: false, reason: 'authentication-required' }
    }

    return this.authz.authorize(context.actor, resource, action, metadata)
  }
}