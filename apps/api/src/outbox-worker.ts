import { OutboxDispatcher, type OutboxHandler } from './outbox'

export interface OutboxWorkerOptions {
  pollIntervalMs?: number
  errorBackoffMaxMs?: number
  onResult?: (result: { status: string; eventId?: string; durationMs: number }) => void
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

export class OutboxWorker {
  private readonly pollIntervalMs: number
  private readonly errorBackoffMaxMs: number
  private readonly onResult?: OutboxWorkerOptions['onResult']
  private readonly sleep: (ms: number) => Promise<void>
  private readonly random: () => number
  private running = false
  private consecutiveErrors = 0

  constructor(
    private readonly dispatcher: OutboxDispatcher,
    options: OutboxWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 5_000
    this.errorBackoffMaxMs = Math.max(options.errorBackoffMaxMs ?? 60_000, this.pollIntervalMs)
    this.onResult = options.onResult
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.random = options.random ?? Math.random
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

  private nextErrorDelayMs(): number {
    const exponent = Math.min(this.consecutiveErrors - 1, 20)
    const baseDelay = Math.min(this.pollIntervalMs * 2 ** exponent, this.errorBackoffMaxMs)
    // Jitter in [0.5, 1.5) avoids synchronized retries across API replicas.
    const jitteredDelay = baseDelay * (0.5 + this.random())
    return Math.min(Math.round(jitteredDelay), this.errorBackoffMaxMs)
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    while (this.running) {
      try {
        const result = await this.runOnce()
        this.consecutiveErrors = 0
        if (result.status === 'PENDING') await this.sleep(this.pollIntervalMs)
      } catch (error) {
        this.consecutiveErrors += 1
        const retryInMs = this.nextErrorDelayMs()
        console.error(JSON.stringify({
          event: 'outbox_worker_error',
          consecutiveErrors: this.consecutiveErrors,
          retryInMs,
          error: error instanceof Error ? error.message : String(error),
        }))
        await this.sleep(retryInMs)
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
