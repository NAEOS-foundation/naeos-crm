import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { computeAuditEventHash } from '@naeos-crm/audit'
import type { AuditEvent } from '@naeos-crm/audit'
import { PrismaAuditReadPort } from './prisma-ports'

function chain(): AuditEvent[] {
  let previousEventHash: string | null = null
  return ['audit-1', 'audit-2', 'audit-3'].map((id, index) => {
    const event: AuditEvent = {
      id, action: 'company.created', entityType: 'company', entityId: `company-${index + 1}`,
      result: 'SUCCESS', createdAt: new Date(`2026-11-18T10:0${index}:00.000Z`),
      sequence: index + 1, schemaVersion: '1', previousEventHash: previousEventHash ?? undefined,
      hashAlgorithm: 'SHA256', hashVersion: 2,
    }
    const eventHash = computeAuditEventHash(event, index + 1, previousEventHash, 2)
    previousEventHash = eventHash
    return { ...event, eventHash }
  })
}

describe('PrismaAuditReadPort integrity verification', () => {
  it('verifies the full chain before returning a filtered page in one transaction snapshot', async () => {
    const events = chain()
    const findMany = vi.fn().mockResolvedValueOnce(events).mockResolvedValueOnce([events[1]])
    const count = vi.fn().mockResolvedValue(1)
    const tx = { auditEvent: { findMany, count } }
    const transaction = vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    const client = { $transaction: transaction } as unknown as PrismaClient
    const port = new PrismaAuditReadPort(client)
    const result = await port.list({ entityType: 'company', entityId: 'company-2', limit: 1, offset: 0 })
    expect(transaction).toHaveBeenCalledOnce()
    expect(findMany).toHaveBeenNthCalledWith(1, { orderBy: { sequence: 'asc' } })
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: { entityType: 'company', entityId: 'company-2' },
      orderBy: [{ sequence: 'desc' }, { createdAt: 'desc' }], take: 1, skip: 0,
    })
    expect(result.events.map((event) => event.id)).toEqual(['audit-2'])
    expect(result.verification.status).toBe('valid')
    expect(result.verification.checkedEvents).toBe(3)
  })

  it('reports tampering outside the requested page', async () => {
    const events = chain()
    const tampered = { ...events[0], action: 'company.deleted' }
    const findMany = vi.fn().mockResolvedValueOnce([tampered, events[1], events[2]]).mockResolvedValueOnce([events[2]])
    const count = vi.fn().mockResolvedValue(1)
    const tx = { auditEvent: { findMany, count } }
    const transaction = vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    const client = { $transaction: transaction } as unknown as PrismaClient
    const port = new PrismaAuditReadPort(client)
    const result = await port.list({ entityId: 'company-3', limit: 1, offset: 0 })
    expect(result.events.map((event) => event.id)).toEqual(['audit-3'])
    expect(result.verification.status).toBe('invalid')
    expect(result.verification.issues.map((issue) => issue.code)).toContain('EVENT_HASH_MISMATCH')
  })
})