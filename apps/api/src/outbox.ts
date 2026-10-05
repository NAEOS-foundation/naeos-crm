import type { OutboxEvent, OutboxStatus } from '@naeos-crm/domain'
import type { OutboxEventPort } from './domain-interfaces'

export interface OutboxDispatchContext {
  event: OutboxEvent
}

export type OutboxHandler = (context: OutboxDispatchContext) => Promise<void>

export interface OutboxDispatcherOptions {
  workerId: string
  leaseMs?: number
  maxAttempts?: number
  baseRetryMs?: number
  now?: () => Date
}

export class OutboxDispatcher {
  private readonly leaseMs: number
  private readonly maxAttempts: number
  private readonly baseRetryMs: number
  private readonly now: () => Date

  constructor(
    private readonly outbox: OutboxEventPort,
    private readonly handlers: Record<string, OutboxHandler>,
    private readonly options: OutboxDispatcherOptions,
  ) {
    this.leaseMs = options.leaseMs ?? 60_000
    this.maxAttempts = options.maxAttempts ?? 5
    this.baseRetryMs = options.baseRetryMs ?? 1_000
    this.now = options.now ?? (() => new Date())
  }

  async dispatchNext(): Promise<{ status: OutboxStatus; eventId?: string }> {
    const event = await this.outbox.claimNext(this.options.workerId, this.leaseMs)
    if (!event) return { status: 'PENDING' }

    const handler = this.handlers[event.eventType]
    if (!handler) {
      await this.outbox.markFailed(event.id, this.options.workerId, `No handler registered for ${event.eventType}`)
      return { status: 'FAILED', eventId: event.id }
    }

    try {
      await handler({ event })
      const marked = await this.outbox.markSucceeded(event.id, this.options.workerId)
      if (!marked) throw new Error('Outbox event lease was lost before success could be recorded')
      return { status: 'SUCCEEDED', eventId: event.id }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (event.attempts >= this.maxAttempts) {
        await this.outbox.markFailed(event.id, this.options.workerId, message)
        return { status: 'FAILED', eventId: event.id }
      }

      const delay = this.baseRetryMs * 2 ** Math.max(0, event.attempts - 1)
      const retryAt = new Date(this.now().getTime() + delay)
      const marked = await this.outbox.markRetry(event.id, this.options.workerId, retryAt, message)
      if (!marked) throw new Error('Outbox event lease was lost before retry could be recorded')
      return { status: 'PENDING', eventId: event.id }
    }
  }
}
