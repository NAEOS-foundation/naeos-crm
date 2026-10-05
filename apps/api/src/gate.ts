import { createHash } from 'node:crypto'
import { AuditService } from '@naeos-crm/audit'
import { POLICY_VERSION } from '@naeos-crm/auth'
import type { GoGateRequest, UserRole } from '@naeos-crm/domain'

import { conflict, notFound } from './errors'
import type { EvidenceReceiptWritePort, GoGateRequestReadPort, PageQuery, PolicyDecisionWritePort } from './domain-interfaces'
import type { ExternalActionPort, PolicyPort } from './ports'

export interface GoGateActor {
  id: string
  roles: UserRole[]
}

export interface GoGateAuditMeta {
  requestId?: string
  source?: string
}

const GO_EXPIRY_MS = 15 * 60 * 1000
const EVIDENCE_VERIFIER_VERSION = 'evidence-v1'

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  const object = value as Record<string, unknown>
  return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonicalize(object[key])).join(',') + '}'
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex')
}

function matchedRuleId(reason?: string): string | null {
  const match = reason?.match(/^policy-rule:([^:]+):(?:ALLOW|DENY)$/)
  return match?.[1] ?? null
}

export class GoGateService {
  constructor(
    private readonly requests: GoGateRequestReadPort,
    private readonly policy: PolicyPort,
    private readonly actions: Record<string, ExternalActionPort>,
    private readonly audit: AuditService,
    private readonly policyDecisions?: PolicyDecisionWritePort,
    private readonly evidenceReceipts?: EvidenceReceiptWritePort,
  ) {}

  async getRequest(id: string): Promise<GoGateRequest | null> {
    return this.requests.findById(id)
  }

  async getEvidenceReceipt(id: string) {
    if (!this.evidenceReceipts) throw notFound('EVIDENCE_RECEIPT_NOT_FOUND', 'Evidence receipt store is not configured')
    const receipt = await this.evidenceReceipts.findByGoGateRequestId(id)
    if (!receipt) throw notFound('EVIDENCE_RECEIPT_NOT_FOUND', 'Evidence receipt not found')
    return receipt
  }

  async listRequests(
    params?: { status?: GoGateRequest['status']; actionType?: GoGateRequest['actionType'] } & PageQuery,
  ): Promise<{ data: GoGateRequest[]; total: number }> {
    return this.requests.list(params)
  }

  async requestExecution(input: {
    actionType: GoGateRequest['actionType']
    target: string
    payload?: Record<string, unknown>
    reason?: string
    idempotencyKey?: string
    requester: GoGateActor
    meta: GoGateAuditMeta
  }): Promise<GoGateRequest> {
    if (input.idempotencyKey) {
      const existing = await this.requests.findByIdempotencyKey?.(input.idempotencyKey)
      if (existing) return existing
    }

    const policy = await this.policy.evaluate({
      resource: 'go-gate',
      action: input.actionType,
      roles: input.requester.roles,
    })
    const idempotencyKey = input.idempotencyKey ?? `go-${Date.now()}-${digest({ actionType: input.actionType, target: input.target, payload: input.payload ?? null }).slice(0, 16)}`

    const policyDecision = this.policyDecisions ? await this.policyDecisions.create({
      decision: policy.allow ? 'ALLOW' : 'DENY',
      policyVersion: policy.policyVersion ?? POLICY_VERSION,
      matchedRuleId: matchedRuleId(policy.reason),
      matchedRulePriority: null,
      resource: 'go-gate',
      action: input.actionType,
      role: input.requester.roles.join(','),
      reason: policy.reason ?? (policy.allow ? 'policy-allowed' : 'policy-rejected'),
      evaluatorVersion: 'naeos-policy-adapter-v1',
    }) : null

    const created = await this.requests.create({
      actionType: input.actionType,
      target: input.target,
      payload: input.payload ?? null,
      status: policy.allow ? 'WAITING_FOR_GO' : 'REJECTED',
      policyVersion: policy.policyVersion ?? POLICY_VERSION,
      reason: input.reason ?? policy.reason,
      requestedBy: input.requester.id,
      idempotencyKey,
      executionAttempt: 0,
      policyDecisionId: policyDecision?.id,
    })

    await this.audit.record({
      actorId: input.requester.id,
      actorType: 'user',
      action: policy.allow ? 'go-gate.requested' : 'go-gate.rejected',
      entityType: 'go-gate-request',
      entityId: created.id,
      requestId: input.meta.requestId,
      source: input.meta.source ?? 'api',
      result: policy.allow ? 'SUCCESS' : 'FAILURE',
      reason: policy.reason ?? 'policy-rejected',
      policyVersion: policy.policyVersion,
      authorization: { allowed: policy.allow, reason: policy.reason, policyDecisionId: policyDecision?.id },
      newState: created as unknown as Record<string, unknown>,
    })

    return created
  }

  async approve(id: string, approver: GoGateActor, input: { reason?: string; meta: GoGateAuditMeta }): Promise<GoGateRequest> {
    const current = await this.requests.findById(id)
    if (!current) throw notFound('GO_GATE_NOT_FOUND', 'Go-Gate request not found')
    if (current.status !== 'WAITING_FOR_GO') throw conflict(`Cannot approve request in status ${current.status}`)

    const updated = await this.requests.transition(id, 'WAITING_FOR_GO', {
      status: 'APPROVED',
      approvedBy: approver.id,
      expiresAt: new Date(Date.now() + GO_EXPIRY_MS),
      reason: input.reason ?? current.reason,
    })
    if (!updated) throw conflict('Go-Gate request status has changed')

    await this.audit.record({
      actorId: approver.id,
      actorType: 'user',
      action: 'go-gate.approved',
      entityType: 'go-gate-request',
      entityId: updated.id,
      requestId: input.meta.requestId,
      source: input.meta.source ?? 'api',
      result: 'SUCCESS',
      policyVersion: updated.policyVersion ?? undefined,
      previousState: current as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
    })

    return updated
  }

  async reject(id: string, approver: GoGateActor, input: { reason?: string; meta: GoGateAuditMeta }): Promise<GoGateRequest> {
    const current = await this.requests.findById(id)
    if (!current) throw notFound('GO_GATE_NOT_FOUND', 'Go-Gate request not found')
    if (current.status !== 'WAITING_FOR_GO') throw conflict(`Cannot reject request in status ${current.status}`)

    const updated = await this.requests.transition(id, 'WAITING_FOR_GO', {
      status: 'REJECTED',
      approvedBy: approver.id,
      reason: input.reason ?? current.reason,
    })
    if (!updated) throw conflict('Go-Gate request status has changed')

    await this.audit.record({
      actorId: approver.id,
      actorType: 'user',
      action: 'go-gate.rejected',
      entityType: 'go-gate-request',
      entityId: updated.id,
      requestId: input.meta.requestId,
      source: input.meta.source ?? 'api',
      result: 'FAILURE',
      policyVersion: updated.policyVersion ?? undefined,
      reason: updated.reason ?? 'rejected',
      previousState: current as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
    })

    return updated
  }

  private async createEvidenceReceipt(
    request: GoGateRequest,
    verificationStatus: 'VERIFIED' | 'FAILED',
    providerResponse?: unknown,
  ) {
    const requestDigest = digest({
      actionType: request.actionType,
      target: request.target,
      payload: request.payload ?? null,
      idempotencyKey: request.idempotencyKey ?? request.id,
      executionId: request.executionId,
      executionAttempt: request.executionAttempt,
      policyDecisionId: request.policyDecisionId ?? null,
      policyVersion: request.policyVersion ?? null,
    })
    const providerResponseDigest = providerResponse === undefined ? null : digest(providerResponse)
    const receiptPayload = {
      goGateRequestId: request.id,
      executionId: request.executionId!,
      idempotencyKey: request.idempotencyKey ?? request.id,
      policyDecisionId: request.policyDecisionId ?? null,
      policyVersion: request.policyVersion ?? null,
      provider: request.provider ?? null,
      providerRequestId: request.providerRequestId ?? null,
      requestDigest,
      providerResponseDigest,
      verificationStatus,
      verifiedAt: request.verifiedAt ?? new Date(),
      verifierVersion: EVIDENCE_VERIFIER_VERSION,
    }
    const receiptHash = digest(receiptPayload)
    if (!this.evidenceReceipts) return null

    const receipt = await this.evidenceReceipts.create({
      ...receiptPayload,
      receiptHash,
    })

    await this.audit.record({
      action: 'go-gate.evidence-receipt.created',
      entityType: 'evidence-receipt',
      entityId: receipt.id,
      requestId: undefined,
      source: 'go-gate',
      result: verificationStatus === 'VERIFIED' ? 'SUCCESS' : 'FAILURE',
      reason: verificationStatus === 'VERIFIED' ? 'provider-response-verified' : 'provider-response-failed',
      policyVersion: request.policyVersion,
      newState: receipt as unknown as Record<string, unknown>,
      executionId: request.executionId,
      provider: request.provider,
      providerRequestId: request.providerRequestId,
    })

    return receipt
  }

  async execute(id: string, executor: GoGateActor, meta: GoGateAuditMeta): Promise<GoGateRequest> {
    const current = await this.requests.findById(id)
    if (!current) throw notFound('GO_GATE_NOT_FOUND', 'Go-Gate request not found')
    if (current.status !== 'APPROVED') throw conflict(`Cannot execute request in status ${current.status}`)

    const now = new Date()
    if (!current.expiresAt || current.expiresAt.getTime() <= now.getTime()) {
      const expired = await this.requests.transition(id, 'APPROVED', { status: 'EXPIRED' })
      if (expired) {
        await this.audit.record({
          actorId: executor.id,
          actorType: 'user',
          action: 'go-gate.expired',
          entityType: 'go-gate-request',
          entityId: expired.id,
          requestId: meta.requestId,
          source: meta.source ?? 'api',
          result: 'FAILURE',
          policyVersion: expired.policyVersion ?? undefined,
          reason: 'go-gate-approval-expired',
          previousState: current as unknown as Record<string, unknown>,
          newState: expired as unknown as Record<string, unknown>,
        })
      }
      throw conflict('Go-Gate request has expired')
    }

    const adapter = this.actions[current.actionType] ?? this.actions.default
    if (!adapter) throw conflict(`No adapter configured for action ${current.actionType}`)

    const executionId = current.executionId ?? `exec-${current.id}-${(current.executionAttempt ?? 0) + 1}`
    const executing = await this.requests.transition(id, 'APPROVED', {
      status: 'EXECUTING',
      executionId,
      executionAttempt: (current.executionAttempt ?? 0) + 1,
    }, new Date())
    if (!executing) throw conflict('Go-Gate request status has changed or approval has expired')

    let result: Awaited<ReturnType<ExternalActionPort['execute']>>
    try {
      result = await adapter.execute({
        actionType: current.actionType,
        target: current.target,
        payload: current.payload ?? {},
        requestedBy: current.requestedBy,
        approvedBy: current.approvedBy,
        executionId,
      })
    } catch {
      const failed = await this.requests.transition(id, 'EXECUTING', {
        status: 'FAILED',
        executedAt: new Date(),
        result: 'adapter-error',
      })
      if (!failed) throw conflict('Go-Gate request status has changed')
      await this.createEvidenceReceipt(failed, 'FAILED')
      await this.audit.record({
        actorId: executor.id,
        actorType: 'user',
        action: 'go-gate.failed',
        entityType: 'go-gate-request',
        entityId: id,
        requestId: meta.requestId,
        source: meta.source ?? 'api',
        result: 'FAILURE',
        policyVersion: current.policyVersion ?? undefined,
        reason: 'adapter-error',
        previousState: executing as unknown as Record<string, unknown>,
        newState: failed as unknown as Record<string, unknown>,
        executionId: failed.executionId,
      })
      throw conflict('Go-Gate execution failed')
    }

    const verified = result.ok === true
    const final = await this.requests.transition(id, 'EXECUTING', {
      status: verified ? 'EXECUTED' : 'FAILED',
      executedAt: new Date(),
      verifiedAt: new Date(),
      provider: result.provider,
      providerRequestId: result.providerRequestId,
      providerResponse: (result.providerResponse as Record<string, unknown>) ?? null,
      result: verified ? 'verified' : 'provider-response-failed',
    })
    if (!final) throw conflict('Go-Gate request status has changed')

    await this.createEvidenceReceipt(final, verified ? 'VERIFIED' : 'FAILED', result.providerResponse)

    await this.audit.record({
      actorId: executor.id,
      actorType: 'user',
      action: verified ? 'go-gate.executed' : 'go-gate.failed',
      entityType: 'go-gate-request',
      entityId: final.id,
      requestId: meta.requestId,
      source: meta.source ?? 'api',
      result: verified ? 'SUCCESS' : 'FAILURE',
      policyVersion: final.policyVersion ?? undefined,
      reason: verified ? 'verified' : 'provider-response-failed',
      previousState: executing as unknown as Record<string, unknown>,
      newState: final as unknown as Record<string, unknown>,
      executionId: final.executionId,
      provider: final.provider,
      providerRequestId: final.providerRequestId,
    })

    return final
  }
}
