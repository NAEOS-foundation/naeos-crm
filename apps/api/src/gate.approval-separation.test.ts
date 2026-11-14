import { describe, expect, it, vi } from 'vitest'
import { AuditService } from '@naeos-crm/audit'
import type { GoGateRequest } from '@naeos-crm/domain'

import type { GoGateRequestReadPort } from './domain-interfaces'
import { GoGateService } from './gate'
import type { PolicyPort } from './ports'

describe('GoGateService approval separation of duties', () => {
  it('rejects self-approval before changing request state or writing an approval audit event', async () => {
    const current = {
      id: 'gate-self-approval',
      actionType: 'CREATE_ISSUE',
      target: 'NAEOS-foundation/naeos-crm',
      payload: {},
      status: 'WAITING_FOR_GO',
      requestedBy: 'requester-1',
      approvedBy: null,
      expiresAt: null,
      policyVersion: 'v1',
      reason: 'test',
      idempotencyKey: 'idem-self-approval',
      executionAttempt: 0,
    } as unknown as GoGateRequest

    const transition = vi.fn<GoGateRequestReadPort['transition']>()
    const requests = {
      findById: vi.fn(async () => current),
      findByIdempotencyKey: vi.fn(async () => null),
      list: vi.fn(async () => ({ data: [current], total: 1 })),
      create: vi.fn(),
      update: vi.fn(),
      transition,
    } as unknown as GoGateRequestReadPort

    const policy: PolicyPort = {
      evaluate: vi.fn(async () => ({ allow: true, policyVersion: 'v1' })),
    }
    const auditSink = { append: vi.fn(async () => undefined) }
    const audit = new AuditService(auditSink)

    const service = new GoGateService(requests, policy, {}, audit)

    await expect(
      service.approve(
        current.id,
        { id: current.requestedBy, roles: ['ADMIN'] },
        { meta: { requestId: 'req-self-approval', source: 'test' } },
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'The requester cannot approve their own Go-Gate request',
    })

    expect(transition).not.toHaveBeenCalled()
    expect(auditSink.append).not.toHaveBeenCalled()
  })
})
