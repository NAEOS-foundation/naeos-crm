import { describe, expect, it } from 'vitest'
import {
  computeAuditEventHash,
  verifyAuditChain,
} from '@naeos-crm/audit'
import type { AuditEvent } from '@naeos-crm/audit'
import { createHash } from 'node:crypto'

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'audit-1',
    action: 'company.created',
    entityType: 'company',
    entityId: 'company-1',
    result: 'SUCCESS',
    createdAt: new Date('2026-11-18T10:00:00.000Z'),
    sequence: 1,
    schemaVersion: '1',
    previousEventHash: undefined,
    ...overrides,
  }
}

function chained(events: AuditEvent[]): AuditEvent[] {
  let previousHash: string | null = null
  return events.map((item, index) => {
    const next = {
      ...item,
      sequence: index + 1,
      previousEventHash: previousHash ?? undefined,
    }
    const eventHash = computeAuditEventHash(next, index + 1, previousHash)
    previousHash = eventHash
    return { ...next, eventHash }
  })
}

describe('AuditEvent chain verifier', () => {
  it('accepts a complete SHA-256 chain and sorts input by sequence', () => {
    const events = chained([
      event({ id: 'audit-1', entityId: 'company-1' }),
      event({ id: 'audit-2', entityId: 'company-2', createdAt: new Date('2026-11-18T10:01:00.000Z') }),
      event({ id: 'audit-3', entityId: 'company-3', createdAt: new Date('2026-11-18T10:02:00.000Z') }),
    ])

    const result = verifyAuditChain([events[2], events[0], events[1]])

    expect(result.status).toBe('valid')
    expect(result.checkedEvents).toBe(3)
    expect(result.issues).toEqual([])
  })

  it('detects a modified event payload', () => {
    const [first] = chained([event()])
    const tampered = { ...first, action: 'company.deleted' }

    const result = verifyAuditChain([tampered])

    expect(result.status).toBe('invalid')
    expect(result.issues.map((issue) => issue.code)).toContain('EVENT_HASH_MISMATCH')
  })

  it('detects a broken predecessor link', () => {
    const events = chained([event({ id: 'audit-1' }), event({ id: 'audit-2' })])
    const broken = { ...events[1], previousEventHash: 'f'.repeat(64) }

    const result = verifyAuditChain([events[0], broken])

    expect(result.status).toBe('invalid')
    expect(result.issues.map((issue) => issue.code)).toContain('PREDECESSOR_HASH_MISMATCH')
  })

  it('detects missing or non-contiguous sequence numbers', () => {
    const events = chained([event({ id: 'audit-1' }), event({ id: 'audit-2' })])
    const gap = { ...events[1], sequence: 3 }

    const result = verifyAuditChain([events[0], gap])

    expect(result.status).toBe('invalid')
    expect(result.issues.map((issue) => issue.code)).toContain('SEQUENCE_GAP')
  })

  it('recognizes historical MD5 rows without overstating payload integrity', () => {
    const first = event({ id: 'legacy-1', sequence: 1 })
    const second = event({ id: 'legacy-2', sequence: 2 })
    const legacy = [first, second].map((item, index) => ({
      ...item,
      sequence: index + 1,
      eventHash: createHash('md5')
        .update(`${item.id}|${index + 1}|${index === 0 ? '' : 'legacy-1'}`)
        .digest('hex'),
      previousEventHash: undefined,
    }))

    const result = verifyAuditChain(legacy)

    expect(result.status).toBe('legacy')
    expect(result.legacyEvents).toBe(2)
    expect(result.issues.map((issue) => issue.code)).toContain('LEGACY_PAYLOAD_NOT_BOUND')
    expect(result.issues.map((issue) => issue.code)).toContain('LEGACY_PREDECESSOR_LINK_MISSING')
  })


  it('rejects a legacy root event that claims a predecessor', () => {
    const legacy = {
      ...event({ id: 'legacy-root', previousEventHash: 'a'.repeat(64) }),
      eventHash: createHash('md5').update('legacy-root|1|').digest('hex'),
    }

    const result = verifyAuditChain([legacy])

    expect(result.status).toBe('invalid')
    expect(result.issues.map((issue) => issue.code)).toContain('PREDECESSOR_HASH_MISMATCH')
  })

  it('rejects a tampered legacy digest', () => {
    const legacy = {
      ...event({ id: 'legacy-1' }),
      eventHash: createHash('md5').update('different').digest('hex'),
    }

    const result = verifyAuditChain([legacy])

    expect(result.status).toBe('invalid')
    expect(result.issues.map((issue) => issue.code)).toContain('EVENT_HASH_MISMATCH')
  })
})
