import { describe, expect, it, vi } from 'vitest'
import type { OutboxEvent } from '@naeos-crm/domain'
import type { OutboxEventPort } from './domain-interfaces'
import { OutboxDispatcher } from './outbox'

function event(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  const now = new Date('2026-10-05T10:00:00.000Z')
  return {
    id: 'outbox-recovery-1',
    aggregateType: 'evidence-receipt',
    aggregateId: 'receipt-recovery-1',
    eventType: 'evidence-receipt.created',
    schemaVersion: '1',
    payload: { id: 'receipt-recovery-1', receiptHash: 'hash-recovery-1' },
    status: 'PROCESSING',
    attempts: 1,
    availableAt: now,
    lockedAt: now,
    lockedBy: 'worker-1',
    lastError: null,
    idempotencyKey: 'evidence-receipt:receipt-recovery-1',
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

describe('Outbox recovery semantics', () => {
  it('retries after a recovered processing lease fails transiently', async () => {
    const p = port(event({ attempts: 2, lockedBy: 'recovered-worker' }))
    const d = new OutboxDispatcher(
      p,
      { 'evidence-receipt.created': async () => { throw new Error('downstream timeout') } },
      { workerId: 'new-worker', baseRetryMs: 1_000, now: () => new Date('2026-10-05T10:00:00.000Z') },
    )

    await expect(d.dispatchNext()).resolves.toEqual({ status: 'PENDING', eventId: 'outbox-recovery-1' })
    expect(p.markRetry).toHaveBeenCalledWith(
      'outbox-recovery-1',
      'new-worker',
      new Date('2026-10-05T10:00:02.000Z'),
      'downstream timeout',
    )
  })

  it('records a terminal failure after the final recovered attempt', async () => {
    const p = port(event({ attempts: 5, lockedBy: 'recovered-worker' }))
    const d = new OutboxDispatcher(
      p,
      { 'evidence-receipt.created': async () => { throw new Error('downstream permanently unavailable') } },
      { workerId: 'new-worker', maxAttempts: 5 },
    )

    await expect(d.dispatchNext()).resolves.toEqual({ status: 'FAILED', eventId: 'outbox-recovery-1' })
    expect(p.markFailed).toHaveBeenCalledWith(
      'outbox-recovery-1',
      'new-worker',
      'downstream permanently unavailable',
    )
  })

  it('does not acknowledge an event when its lease is lost', async () => {
    const p = port(event())
    p.markSucceeded = vi.fn(async () => false)
    const d = new OutboxDispatcher(
      p,
      { 'evidence-receipt.created': async () => undefined },
      { workerId: 'worker-1' },
    )

    await expect(d.dispatchNext()).rejects.toThrow('lease was lost before success could be recorded')
    expect(p.markSucceeded).toHaveBeenCalledWith('outbox-recovery-1', 'worker-1')
  })
})
