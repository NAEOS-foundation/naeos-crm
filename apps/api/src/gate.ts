import { AuditService } from '@naeos-crm/audit'
import { POLICY_VERSION } from '@naeos-crm/auth'
import type { GoGateRequest, UserRole } from '@naeos-crm/domain'

import { conflict, notFound } from './errors'
import type { GoGateRequestReadPort, PageQuery } from './domain-interfaces'
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

export class GoGateService {
  constructor(
    private readonly requests: GoGateRequestReadPort,
    private readonly policy: PolicyPort,
    private readonly actions: Record<string, ExternalActionPort>,
    private readonly audit: AuditService,
  ) {}

  async getRequest(id: string): Promise<GoGateRequest | null> {
    return this.requests.findById(id)
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
    requester: GoGateActor
    meta: GoGateAuditMeta
  }): Promise<GoGateRequest> {
    const policy = await this.policy.evaluate({
      resource: 'go-gate',
      action: input.actionType,
      roles: input.requester.roles,
    })

    const created = await this.requests.create({
      actionType: input.actionType,
      target: input.target,
      payload: input.payload ?? null,
      status: policy.allow ? 'WAITING_FOR_GO' : 'REJECTED',
      policyVersion: policy.policyVersion ?? POLICY_VERSION,
      reason: input.reason,
      requestedBy: input.requester.id,
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
      authorization: { allowed: policy.allow, reason: policy.reason },
      newState: created as unknown as Record<string, unknown>,
    })

    return created
  }

  async approve(id: string, approver: GoGateActor, input: { reason?: string; meta: GoGateAuditMeta }): Promise<GoGateRequest> {
    const current = await this.requests.findById(id)
    if (!current) throw notFound('GO_GATE_NOT_FOUND', 'Go-Gate request not found')
    if (current.status !== 'WAITING_FOR_GO') {
      throw conflict(`Cannot approve request in status ${current.status}`)
    }

    const updated = await this.requests.update(id, {
      status: 'APPROVED',
      approvedBy: approver.id,
      expiresAt: new Date(Date.now() + GO_EXPIRY_MS),
      reason: input.reason ?? current.reason,
    })
    if (!updated) throw notFound('GO_GATE_NOT_FOUND', 'Go-Gate request not found')

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
    if (current.status !== 'WAITING_FOR_GO') {
      throw conflict(`Cannot reject request in status ${current.status}`)
    }

    const updated = await this.requests.update(id, {
      status: 'REJECTED',
      approvedBy: approver.id,
      reason: input.reason ?? current.reason,
    })
    if (!updated) throw notFound('GO_GATE_NOT_FOUND', 'Go-Gate request not found')

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

  async execute(id: string, executor: GoGateActor, meta: GoGateAuditMeta): Promise<GoGateRequest> {
    const current = await this.requests.findById(id)
    if (!current) throw notFound('GO_GATE_NOT_FOUND', 'Go-Gate request not found')

    if (current.status === 'EXPIRED' || (current.expiresAt && current.expiresAt.getTime() < Date.now())) {
      const expired = await this.requests.update(id, { status: 'EXPIRED' })
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

    if (current.status !== 'APPROVED') {
      throw conflict(`Cannot execute request in status ${current.status}`)
    }

    await this.requests.update(id, { status: 'EXECUTING' })

    const adapter = this.actions[current.actionType] ?? this.actions.default
    if (!adapter) throw conflict(`No adapter configured for action ${current.actionType}`)

    try {
      const result = await adapter.execute({
        actionType: current.actionType,
        target: current.target,
        payload: current.payload ?? {},
        requestedBy: current.requestedBy,
        approvedBy: current.approvedBy,
      })

      const verified = result.ok === true
      const final = await this.requests.update(id, {
        status: verified ? 'EXECUTED' : 'FAILED',
        executedAt: new Date(),
        verifiedAt: new Date(),
        providerResponse: (result.providerResponse as Record<string, unknown>) ?? null,
        result: verified ? 'verified' : 'provider-response-failed',
      })
      if (!final) throw notFound('GO_GATE_NOT_FOUND', 'Go-Gate request not found')

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
        previousState: current as unknown as Record<string, unknown>,
        newState: final as unknown as Record<string, unknown>,
      })

      return final
    } catch {
      await this.requests.update(id, {
        status: 'FAILED',
        executedAt: new Date(),
        result: 'adapter-error',
      })
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
      })
      throw conflict('Go-Gate execution failed')
    }
  }
}