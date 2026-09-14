export type AuditResult = 'success' | 'failure'

export interface AuditEvent {
  id: string
  actorId?: string
  action: string
  entityType: string
  entityId: string
  requestId?: string
  timestamp: Date
  previousState?: Record<string, unknown>
  newState?: Record<string, unknown>
  source?: string
  authorization?: Record<string, unknown>
  policyVersion?: string
  result: AuditResult
  reason?: string
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>
}

export class AuditService {
  constructor(private readonly sink: AuditSink) {}

  async record(event: Omit<AuditEvent, 'timestamp'> & { timestamp?: Date }): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date(),
    }

    await this.sink.append(auditEvent)
  }
}
