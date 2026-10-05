import { describe, expect, it, vi } from 'vitest'
import type { OutboxEvent } from '@naeos-crm/domain'
import type { OutboxEventPort } from './domain-interfaces'
import { OutboxDispatcher } from './outbox'
import { OutboxWorker, createEvidenceReceiptOutboxHandler } from './outbox-worker'

function event(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  const now = new Date('2026-10-05T10:00:00.000Z')
  return {
    id: 'outbox-1',
    aggregateType: 'evidence-receipt',
    aggregateId: 'receipt-1',
    eventType: 'evidence-receipt.created',
    schemaVersion: '1',
    payload: { id: 'receipt-1', receiptHash: 'hash-1' },
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

describe('OutboxWorker', () => {
  it('processes a claimed evidence receipt event and reports the result', async () => {
    const p = port(event())
    const dispatcher = new OutboxDispatcher(
      p,
      { 'evidence-receipt.created': createEvidenceReceiptOutboxHandler() },
      { workerId: 'worker-1' },
    )
    const onResult = vi.fn()
    const worker = new OutboxWorker(dispatcher, { onResult })

    await expect(worker.runOnce()).resolves.toMatchObject({ status: 'SUCCEEDED', eventId: 'outbox-1' })
    expect(p.markSucceeded).toHaveBeenCalledWith('outbox-1', 'worker-1')
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUCCEEDED', eventId: 'outbox-1' }))
  })

  it('rejects malformed evidence receipt payloads and uses dispatcher retry semantics', async () => {
    const p = port(event({ payload: { id: 'receipt-1' } }))
    const dispatcher = new OutboxDispatcher(
      p,
      { 'evidence-receipt.created': createEvidenceReceiptOutboxHandler() },
      { workerId: 'worker-1', baseRetryMs: 1_000, now: () => new Date('2026-10-05T10:00:00.000Z') },
    )
    const worker = new OutboxWorker(dispatcher)

    await expect(worker.runOnce()).resolves.toMatchObject({ status: 'PENDING', eventId: 'outbox-1' })
    expect(p.markRetry).toHaveBeenCalledWith(
      'outbox-1',
      'worker-1',
      new Date('2026-10-05T10:00:01.000Z'),
      'Invalid evidence-receipt.created payload',
    )
  })

  it('can be stopped cleanly', () => {
    const p = port(null)
    const dispatcher = new OutboxDispatcher(p, {}, { workerId: 'worker-1' })
    const worker = new OutboxWorker(dispatcher)

    expect(worker.isRunning()).toBe(false)
    worker.stop()
    expect(worker.isRunning()).toBe(false)
  })
})
