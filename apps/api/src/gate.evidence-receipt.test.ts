import { describe, expect, it, vi } from 'vitest'
import { AuditService } from '@naeos-crm/audit'
import type { EvidenceReceipt, GoGateRequest, PolicyDecision } from '@naeos-crm/domain'

import type { EvidenceReceiptWritePort, GoGateRequestReadPort, PolicyDecisionWritePort } from './domain-interfaces'
import { GoGateService } from './gate'
import type { ExternalActionPort, PolicyPort } from './ports'

const actor: import('./gate').GoGateActor = { id: 'user-1', roles: ['ADMIN'] }

function request(overrides: Partial<GoGateRequest> = {}): GoGateRequest {
  const now = new Date('2026-10-05T08:00:00.000Z')
  return {
    id: 'gate-1',
    actionType: 'CREATE_ISSUE',
    target: 'NAEOS-foundation/naeos-crm',
    payload: { title: 'test' },
    status: 'APPROVED',
    policyVersion: 'v1',
    reason: 'allowed',
    requestedBy: 'user-1',
    approvedBy: 'user-2',
    expiresAt: new Date('2026-10-05T09:00:00.000Z'),
    executedAt: null,
    verifiedAt: null,
    providerResponse: null,
    result: undefined,
    idempotencyKey: 'idem-1',
    executionId: undefined,
    provider: undefined,
    providerRequestId: undefined,
    executionAttempt: 0,
    policyDecisionId: 'decision-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function policyDecision(): PolicyDecision {
  const now = new Date('2026-10-05T08:00:00.000Z')
  return {
    id: 'decision-1',
    decision: 'ALLOW',
    policyVersion: 'v1',
    matchedRuleId: 'rule-1',
    matchedRulePriority: null,
    resource: 'go-gate',
    action: 'CREATE_ISSUE',
    role: 'ADMIN',
    reason: 'policy-rule:rule-1:ALLOW',
    evaluatorVersion: 'naeos-policy-adapter-v1',
    evaluatedAt: now,
    createdAt: now,
  }
}

function receipt(overrides: Partial<EvidenceReceipt> = {}): EvidenceReceipt {
  const now = new Date('2026-10-05T08:00:00.000Z')
  return {
    id: 'receipt-1',
    goGateRequestId: 'gate-1',
    executionId: 'exec-gate-1-1',
    idempotencyKey: 'idem-1',
    policyDecisionId: 'decision-1',
    policyVersion: 'v1',
    provider: 'github',
    providerRequestId: 'gh-123',
    requestDigest: 'request-digest',
    providerResponseDigest: 'response-digest',
    verificationStatus: 'VERIFIED',
    verifiedAt: now,
    verifierVersion: 'evidence-v1',
    receiptHash: 'receipt-hash',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function harness(options: {
  action?: ExternalActionPort
  existing?: GoGateRequest | null
} = {}) {
  let current = options.existing ?? request()
  const createdReceipts: EvidenceReceipt[] = []
  const policyCalls: Record<string, unknown>[] = []

  const requests: GoGateRequestReadPort = {
    findById: async () => current,
    findByIdempotencyKey: async () => options.existing ?? null,
    list: async () => ({ data: [current], total: 1 }),
    create: async (input) => {
      current = request(input)
      return current
    },
    update: async (_id, input) => {
      current = request({ ...current, ...input })
      return current
    },
    transition: async (_id, expectedStatus, input) => {
      if (current.status !== expectedStatus) return null
      current = request({ ...current, ...input })
      return current
    },
  }

  const policy: PolicyPort = {
    evaluate: async (input) => {
      policyCalls.push(input)
      return { allow: true, policyVersion: 'v1', reason: 'policy-rule:rule-1:ALLOW' }
    },
  }

  const decisions: PolicyDecisionWritePort = {
    create: async () => policyDecision(),
  }

  const evidenceReceipts: EvidenceReceiptWritePort = {
    findByGoGateRequestId: async () => createdReceipts[0] ?? null,
    create: async (input) => {
      const created = receipt(input)
      createdReceipts.push(created)
      return created
    },
  }

  const auditSink = { append: vi.fn(async () => undefined) }
  const audit = new AuditService(auditSink)
  const action = options.action ?? {
    execute: async () => ({
      ok: true,
      provider: 'github',
      providerRequestId: 'gh-123',
      providerResponse: { accepted: true, issue: 42 },
    }),
  }

  return {
    service: new GoGateService(requests, policy, { CREATE_ISSUE: action }, audit, decisions, evidenceReceipts),
    current: () => current,
    createdReceipts,
    policyCalls,
    auditSink,
  }
}

describe('GoGateService evidence receipt V1', () => {
  it('replays an idempotent request without re-evaluating policy', async () => {
    const existing = request({ status: 'WAITING_FOR_GO' })
    const h = harness({ existing })

    const result = await h.service.requestExecution({
      actionType: 'CREATE_ISSUE',
      target: existing.target,
      payload: existing.payload ?? undefined,
      idempotencyKey: existing.idempotencyKey,
      requester: actor,
      meta: { requestId: 'req-1', source: 'test' },
    })

    expect(result.id).toBe(existing.id)
    expect(h.policyCalls).toHaveLength(0)
  })

  it('creates a VERIFIED receipt linked to execution, provider, and policy decision', async () => {
    const h = harness()

    const result = await h.service.execute('gate-1', actor, { requestId: 'req-2', source: 'test' })

    expect(result.status).toBe('EXECUTED')
    expect(result.executionId).toBe('exec-gate-1-1')
    expect(result.provider).toBe('github')
    expect(result.providerRequestId).toBe('gh-123')

    expect(h.createdReceipts).toHaveLength(1)
    expect(h.createdReceipts[0]).toMatchObject({
      goGateRequestId: 'gate-1',
      executionId: 'exec-gate-1-1',
      policyDecisionId: 'decision-1',
      provider: 'github',
      providerRequestId: 'gh-123',
      verificationStatus: 'VERIFIED',
      verifierVersion: 'evidence-v1',
    })
    expect(h.createdReceipts[0].requestDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(h.createdReceipts[0].providerResponseDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(h.createdReceipts[0].receiptHash).toMatch(/^[a-f0-9]{64}$/)

    const receiptAudit = h.auditSink.append.mock.calls.find((call) => (call[0] as { action?: string }).action === 'go-gate.evidence-receipt.created')
    expect(receiptAudit?.[0]).toMatchObject({
      entityType: 'evidence-receipt',
      entityId: 'receipt-1',
      result: 'SUCCESS',
      executionId: 'exec-gate-1-1',
      provider: 'github',
      providerRequestId: 'gh-123',
    })
  })

  it('creates a FAILED receipt when the provider returns ok=false', async () => {
    const h = harness({
      action: {
        execute: async () => ({
          ok: false,
          provider: 'github',
          providerRequestId: 'gh-124',
          providerResponse: { accepted: false, error: 'validation' },
        }),
      },
    })

    const result = await h.service.execute('gate-1', actor, { requestId: 'req-3', source: 'test' })

    expect(result.status).toBe('FAILED')
    expect(result.result).toBe('provider-response-failed')
    expect(h.createdReceipts[0]).toMatchObject({
      verificationStatus: 'FAILED',
      provider: 'github',
      providerRequestId: 'gh-124',
    })
  })

  it('creates a FAILED receipt when the provider adapter throws', async () => {
    const h = harness({
      action: {
        execute: async () => {
          throw new Error('provider unavailable')
        },
      },
    })

    await expect(h.service.execute('gate-1', actor, { requestId: 'req-4', source: 'test' }))
      .rejects.toThrow('Go-Gate execution failed')

    expect(h.current().status).toBe('FAILED')
    expect(h.createdReceipts).toHaveLength(1)
    expect(h.createdReceipts[0].verificationStatus).toBe('FAILED')
    expect(h.createdReceipts[0].providerResponseDigest).toBeNull()
  })
})
