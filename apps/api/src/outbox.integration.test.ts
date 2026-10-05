import { afterAll, describe, expect, it } from 'vitest'
import type { EvidenceReceipt } from '@naeos-crm/domain'
import type { OutboxDispatchContext } from './outbox'
import {
  PrismaEvidenceReceiptWritePort,
  PrismaGoGateRequestReadPort,
  PrismaOutboxEventPort,
  prisma,
} from './prisma-ports'
import { OutboxDispatcher } from './outbox'
import { OutboxWorker, createEvidenceReceiptOutboxHandler } from './outbox-worker'

describe('Outbox V1 database integration', () => {
  const suffix = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const goGateRequestId = `gate-${suffix}`
  const idempotencyKey = `idem-${suffix}`
  const executionId = `exec-${suffix}`

  afterAll(async () => {
    const receiptsToClean = await prisma.evidenceReceipt.findMany({ where: { goGateRequestId: { startsWith: goGateRequestId } }, select: { id: true } })
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: receiptsToClean.map(({ id }) => id) } } })
    await prisma.evidenceReceipt.deleteMany({ where: { goGateRequestId: { startsWith: goGateRequestId } } })
    await prisma.goGateRequest.deleteMany({ where: { id: { startsWith: goGateRequestId } } })
    await prisma.$disconnect()
  })

  it('atomically enqueues a receipt event and worker processes it to SUCCEEDED', async () => {
    const requests = new PrismaGoGateRequestReadPort()
    const receipts = new PrismaEvidenceReceiptWritePort()
    const outbox = new PrismaOutboxEventPort()

    await requests.create({
      id: goGateRequestId,
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
      policyDecisionId: null,
    })

    const receipt: EvidenceReceipt = await receipts.create({
      goGateRequestId,
      executionId,
      idempotencyKey,
      policyDecisionId: null,
      policyVersion: 'v1',
      provider: 'integration',
      providerRequestId: `provider-${suffix}`,
      requestDigest: 'a'.repeat(64),
      providerResponseDigest: 'b'.repeat(64),
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date('2026-10-05T10:00:00.000Z'),
      verifierVersion: 'evidence-v1',
      receiptHash: 'c'.repeat(64),
    })

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
    const worker = new OutboxWorker(dispatcher, { pollIntervalMs: 1 })

    await expect(worker.runOnce()).resolves.toMatchObject({
      status: 'SUCCEEDED',
      eventId: queued?.id,
    })

    const completed = await prisma.outboxEvent.findUnique({ where: { id: queued!.id } })

    expect(processedEvents).toEqual([queued!.id])
    expect(completed).toMatchObject({
      status: 'SUCCEEDED',
      attempts: 1,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    })
  })

  it('runs the production evidence handler against a persisted outbox event', async () => {
    const requests = new PrismaGoGateRequestReadPort()
    const receipts = new PrismaEvidenceReceiptWritePort()
    const outbox = new PrismaOutboxEventPort()
    const requestId = `${goGateRequestId}-handler`
    const handlerIdempotency = `${idempotencyKey}-handler`

    await requests.create({
      id: requestId,
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
      policyDecisionId: null,
    })

    const receipt = await receipts.create({
      goGateRequestId: requestId,
      executionId: `${executionId}-handler`,
      idempotencyKey: handlerIdempotency,
      policyDecisionId: null,
      policyVersion: 'v1',
      provider: 'integration',
      providerRequestId: `provider-${suffix}-handler`,
      requestDigest: 'd'.repeat(64),
      providerResponseDigest: 'e'.repeat(64),
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date('2026-10-05T10:00:00.000Z'),
      verifierVersion: 'evidence-v1',
      receiptHash: 'f'.repeat(64),
    })

    const queued = await prisma.outboxEvent.findUnique({
      where: { idempotencyKey: `evidence-receipt:${receipt.id}` },
    })

    expect(queued?.status).toBe('PENDING')

    const dispatcher = new OutboxDispatcher(
      outbox,
      { 'evidence-receipt.created': createEvidenceReceiptOutboxHandler() },
      { workerId: `integration-handler-worker-${suffix}` },
    )

    await expect(dispatcher.dispatchNext()).resolves.toMatchObject({
      status: 'SUCCEEDED',
      eventId: queued?.id,
    })

    await expect(
      prisma.outboxEvent.findUnique({ where: { id: queued!.id } }),
    ).resolves.toMatchObject({ status: 'SUCCEEDED', attempts: 1 })
  })
})
