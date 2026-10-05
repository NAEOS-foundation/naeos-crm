import { OutboxDispatcher, type OutboxHandler } from './outbox'

export interface OutboxWorkerOptions {
  pollIntervalMs?: number
  onResult?: (result: { status: string; eventId?: string; durationMs: number }) => void
  sleep?: (ms: number) => Promise<void>
}

export class OutboxWorker {
  private readonly pollIntervalMs: number
  private readonly onResult?: OutboxWorkerOptions['onResult']
  private readonly sleep: (ms: number) => Promise<void>
  private running = false

  constructor(
    private readonly dispatcher: OutboxDispatcher,
    options: OutboxWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000
    this.onResult = options.onResult
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  isRunning(): boolean {
    return this.running
  }

  async runOnce(): Promise<{ status: string; eventId?: string; durationMs: number }> {
    const startedAt = Date.now()
    const result = await this.dispatcher.dispatchNext()
    const measured = { ...result, durationMs: Date.now() - startedAt }
    this.onResult?.(measured)
    return measured
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    while (this.running) {
      try {
        const result = await this.runOnce()
        if (result.status === 'PENDING') await this.sleep(this.pollIntervalMs)
      } catch (error) {
        console.error(JSON.stringify({
          event: 'outbox_worker_error',
          error: error instanceof Error ? error.message : String(error),
        }))
        await this.sleep(this.pollIntervalMs)
      }
    }
  }

  stop(): void {
    this.running = false
  }
}

export function createEvidenceReceiptOutboxHandler(): OutboxHandler {
  return async ({ event }) => {
    const payload = event.payload
    const id = typeof payload.id === 'string' ? payload.id : null
    const receiptHash = typeof payload.receiptHash === 'string' ? payload.receiptHash : null

    if (!id || !receiptHash) {
      throw new Error('Invalid evidence-receipt.created payload')
    }

    console.log(JSON.stringify({
      event: 'outbox_event_processed',
      eventType: event.eventType,
      eventId: event.id,
      aggregateId: event.aggregateId,
      receiptId: id,
      receiptHash,
      attempts: event.attempts,
    }))
  }
}
