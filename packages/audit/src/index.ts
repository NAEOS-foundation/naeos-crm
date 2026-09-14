export type AuditResult = 'SUCCESS' | 'FAILURE'

export interface AuditEvent {
  id: string
  actorId?: string
  actorType?: string
  action: string
  entityType: string
  entityId: string
  requestId?: string
  source?: string
  result: AuditResult
  reason?: string
  policyVersion?: string
  previousState?: Record<string, unknown>
  newState?: Record<string, unknown>
  authorization?: Record<string, unknown>
  createdAt: Date
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>
}

export interface AuditQueryPort {
  list(params: {
    entityType?: string
    entityId?: string
    actorId?: string
    requestId?: string
    limit?: number
    offset?: number
  }): Promise<{ events: AuditEvent[]; total: number }>
}

export class AuditService {
  constructor(
    private readonly sink: AuditSink,
    private readonly queryPort?: AuditQueryPort,
  ) {}

  async record(event: Omit<AuditEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: Date }): Promise<void> {
    const auditEvent: AuditEvent = {
      id: event.id ?? generateAuditId(),
      ...event,
      createdAt: event.createdAt ?? new Date(),
    }

    await this.sink.append(auditEvent)
  }

  async query(params: {
    entityType?: string
    entityId?: string
    actorId?: string
    requestId?: string
    limit?: number
    offset?: number
  }): Promise<{ events: AuditEvent[]; total: number }> {
    if (!this.queryPort) {
      return { events: [], total: 0 }
    }
    return this.queryPort.list(params)
  }
}

function generateAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
