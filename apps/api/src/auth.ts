import { AuthenticatedActor, AuthorizationService } from '@naeos-crm/auth'

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
  ): { allowed: boolean } {
    if (!context.actor) {
      return { allowed: false }
    }

    const decision = this.authz.authorize(context.actor, resource, action, metadata)
    return { allowed: decision.allow }
  }
}
