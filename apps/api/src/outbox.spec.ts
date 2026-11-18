import { describe, expect, it, vi } from 'vitest'
import type { OutboxEvent } from '@naeos-crm/domain'
import type { OutboxEventPort } from './domain-interfaces'
import { OutboxDispatcher } from './outbox'

function event(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  const now = new Date('2026-10-05T10:00:00.000Z')
  return {
    id: 'outbox-1',
    aggregateType: 'evidence-receipt',
    aggregateId: 'receipt-1',
    eventType: 'evidence-receipt.created',
    schemaVersion: '1',
    payload: { id: 'receipt-1' },
    status: 'PROCESSING',
    attempts: 1,
    availableAt: now,
    lockedAt: now,
    lockedBy: 'worker-1',
    lastError: null,
    idempotencyKey: 'evidence-receipt:receipt-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function port(next: OutboxEvent | null): OutboxEventPort {
  return {
    enqueue: vi.fn(),
    claimNext: vi.fn(async () => next),
    markSucceeded: vi.fn(async () => true),
    markRetry: vi.fn(async () => true),
    markFailed: vi.fn(async () => true),
  }
}

describe('OutboxDispatcher', () => {
  it('dispatches a claimed event exactly once and marks it succeeded', async () => {
    const p = port(event())
    const handler = vi.fn(async () => undefined)
    const d = new OutboxDispatcher(p, { 'evidence-receipt.created': handler }, { workerId: 'worker-1' })

    await expect(d.dispatchNext()).resolves.toEqual({ status: 'SUCCEEDED', eventId: 'outbox-1' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(p.markSucceeded).toHaveBeenCalledWith('outbox-1', 'worker-1')
  })

  it('retries transient failures with exponential backoff', async () => {
    const p = port(event({ attempts: 2 }))
    const d = new OutboxDispatcher(
      p,
      { 'evidence-receipt.created': async () => { throw new Error('temporary outage') } },
      { workerId: 'worker-1', baseRetryMs: 1_000, now: () => new Date('2026-10-05T10:00:00.000Z') },
    )

    await expect(d.dispatchNext()).resolves.toEqual({ status: 'PENDING', eventId: 'outbox-1' })
    expect(p.markRetry).toHaveBeenCalledWith(
      'outbox-1',
      'worker-1',
      new Date('2026-10-05T10:00:02.000Z'),
      'temporary outage',
    )
  })

  it('marks the event permanently failed at the attempt limit', async () => {
    const p = port(event({ attempts: 5 }))
    const d = new OutboxDispatcher(
      p,
      { 'evidence-receipt.created': async () => { throw new Error('permanent outage') } },
      { workerId: 'worker-1', maxAttempts: 5 },
    )

    await expect(d.dispatchNext()).resolves.toEqual({ status: 'FAILED', eventId: 'outbox-1' })
    expect(p.markFailed).toHaveBeenCalledWith('outbox-1', 'worker-1', 'permanent outage')
  })

  it('fails events without a registered handler without retrying', async () => {
    const p = port(event({ eventType: 'unknown.event' }))
    const d = new OutboxDispatcher(p, {}, { workerId: 'worker-1' })

    await expect(d.dispatchNext()).resolves.toEqual({ status: 'FAILED', eventId: 'outbox-1' })
    expect(p.markFailed).toHaveBeenCalledWith('outbox-1', 'worker-1', 'No handler registered for unknown.event')
    expect(p.markRetry).not.toHaveBeenCalled()
  })

  it('returns pending when no event is available', async () => {
    const p = port(null)
    const d = new OutboxDispatcher(p, {}, { workerId: 'worker-1' })

    await expect(d.dispatchNext()).resolves.toEqual({ status: 'PENDING' })
  })
})
