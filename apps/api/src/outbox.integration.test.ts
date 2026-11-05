import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { EvidenceReceipt } from '@naeos-crm/domain'
import type { OutboxDispatchContext } from './outbox'
import {
  PrismaEvidenceReceiptWritePort,
  PrismaGoGateRequestReadPort,
  PrismaOutboxEventPort,
  prisma,
} from './prisma-ports'
import { OutboxDispatcher } from './outbox'
import { createEvidenceReceiptOutboxHandler } from './outbox-worker'

async function dispatchUntilSucceeded(dispatcher: OutboxDispatcher, eventId: string, maxRuns = 100): Promise<void> {
  for (let i = 0; i < maxRuns; i++) {
    const current = await prisma.outboxEvent.findUnique({ where: { id: eventId }, select: { status: true } })
    if (current?.status === 'SUCCEEDED') return
    await dispatcher.dispatchNext()
  }
  throw new Error(`outbox event ${eventId} was not processed within ${maxRuns} dispatch cycles`)
}

describe('Outbox V1 database integration', () => {
  const suffix = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const runReceiptHash = (tag: string) => createHash('sha256').update(`${tag}:${suffix}`).digest('hex')
  const goGateRequestId = `gate-${suffix}`
  const idempotencyKey = `idem-${suffix}`
  const executionId = `exec-${suffix}`
  const createdRequestIds: string[] = []
  const createdReceiptIds: string[] = []

  beforeAll(async () => {
    const staleRequests = await prisma.goGateRequest.findMany({
      where: { target: 'integration-test' },
      select: { id: true },
    })
    const staleReceipts = await prisma.evidenceReceipt.findMany({
      where: { goGateRequestId: { in: staleRequests.map(({ id }) => id) } },
      select: { id: true },
    })
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: staleReceipts.map(({ id }) => id) } } })
    await prisma.evidenceReceipt.deleteMany({ where: { id: { in: staleReceipts.map(({ id }) => id) } } })
    await prisma.goGateRequest.deleteMany({ where: { id: { in: staleRequests.map(({ id }) => id) } } })
  })

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: createdReceiptIds } } })
    await prisma.evidenceReceipt.deleteMany({ where: { id: { in: createdReceiptIds } } })
    await prisma.goGateRequest.deleteMany({ where: { id: { in: createdRequestIds } } })
    await prisma.$disconnect()
  })

  it('atomically enqueues a receipt event and worker processes it to SUCCEEDED', async () => {
    const requests = new PrismaGoGateRequestReadPort()
    const receipts = new PrismaEvidenceReceiptWritePort()
    const outbox = new PrismaOutboxEventPort()

    const request = await requests.create({
      actionType: 'CREATE_ISSUE',
      target: 'integration-test',
      payload: { test: true, suffix },
      status: 'EXECUTED',
      policyVersion: 'v1',
      reason: 'integration-test',
      requestedBy: 'integration-test',
      approvedBy: 'integration-test',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      executedAt: new Date('2026-10-05T10:00:00.000Z'),
      verifiedAt: new Date('2026-10-05T10:00:00.000Z'),
      providerResponse: { accepted: true },
      result: 'success',
      idempotencyKey,
      executionId,
      provider: 'integration',
      providerRequestId: `provider-${suffix}`,
      executionAttempt: 1,
      policyDecisionId: undefined,
    })
    createdRequestIds.push(request.id)

    const receipt: EvidenceReceipt = await receipts.create({
      goGateRequestId: request.id,
      executionId,
      idempotencyKey,
      policyDecisionId: undefined,
      policyVersion: 'v1',
      provider: 'integration',
      providerRequestId: `provider-${suffix}`,
      requestDigest: 'a'.repeat(64),
      providerResponseDigest: 'b'.repeat(64),
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date('2026-10-05T10:00:00.000Z'),
      verifierVersion: 'evidence-v1',
      receiptHash: runReceiptHash('c'),
    })
    createdReceiptIds.push(receipt.id)

    const queued = await prisma.outboxEvent.findUnique({
      where: { idempotencyKey: `evidence-receipt:${receipt.id}` },
    })

    expect(queued).toMatchObject({
      aggregateType: 'evidence-receipt',
      aggregateId: receipt.id,
      eventType: 'evidence-receipt.created',
      status: 'PENDING',
      attempts: 0,
    })

    const processedEvents: string[] = []
    const handler = async ({ event }: OutboxDispatchContext) => {
      processedEvents.push(event.id)
    }
    const dispatcher = new OutboxDispatcher(
      outbox,
      { 'evidence-receipt.created': handler },
      { workerId: `integration-worker-${suffix}` },
    )

    await dispatchUntilSucceeded(dispatcher, queued!.id)

    const completed = await prisma.outboxEvent.findUnique({ where: { id: queued!.id } })

    expect(processedEvents).toContain(queued!.id)
    expect(completed).toMatchObject({
      status: 'SUCCEEDED',
      attempts: expect.any(Number),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    })
    expect(completed!.attempts).toBeGreaterThanOrEqual(1)
  })

  it('runs the production evidence handler against a persisted outbox event', async () => {
    const requests = new PrismaGoGateRequestReadPort()
    const receipts = new PrismaEvidenceReceiptWritePort()
    const outbox = new PrismaOutboxEventPort()
    const handlerIdempotency = `${idempotencyKey}-handler`
    const request = await requests.create({
      actionType: 'CREATE_ISSUE',
      target: 'integration-test',
      payload: { handler: true, suffix },
      status: 'EXECUTED',
      policyVersion: 'v1',
      reason: 'integration-test',
      requestedBy: 'integration-test',
      approvedBy: 'integration-test',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      executedAt: new Date('2026-10-05T10:00:00.000Z'),
      verifiedAt: new Date('2026-10-05T10:00:00.000Z'),
      providerResponse: { accepted: true },
      result: 'success',
      idempotencyKey: handlerIdempotency,
      executionId: `${executionId}-handler`,
      provider: 'integration',
      providerRequestId: `provider-${suffix}-handler`,
      executionAttempt: 1,
      policyDecisionId: undefined,
    })
    createdRequestIds.push(request.id)

    const receipt = await receipts.create({
      goGateRequestId: request.id,
      executionId: `${executionId}-handler`,
      idempotencyKey: handlerIdempotency,
      policyDecisionId: undefined,
      policyVersion: 'v1',
      provider: 'integration',
      providerRequestId: `provider-${suffix}-handler`,
      requestDigest: 'd'.repeat(64),
      providerResponseDigest: 'e'.repeat(64),
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date('2026-10-05T10:00:00.000Z'),
      verifierVersion: 'evidence-v1',
      receiptHash: runReceiptHash('f'),
    })
    createdReceiptIds.push(receipt.id)

    const queued = await prisma.outboxEvent.findUnique({
      where: { idempotencyKey: `evidence-receipt:${receipt.id}` },
    })

    expect(queued?.status).toBe('PENDING')

    const dispatcher = new OutboxDispatcher(
      outbox,
      { 'evidence-receipt.created': createEvidenceReceiptOutboxHandler() },
      { workerId: `integration-handler-worker-${suffix}` },
    )

    await dispatchUntilSucceeded(dispatcher, queued!.id)

    await expect(
      prisma.outboxEvent.findUnique({ where: { id: queued!.id } }),
    ).resolves.toMatchObject({ status: 'SUCCEEDED' })
  })
})
