import { createHash } from 'node:crypto'

import type { AuditEvent } from './index'

export type AuditChainVerificationStatus = 'valid' | 'legacy' | 'invalid'

export interface AuditChainVerificationIssue {
  code:
    | 'MISSING_SEQUENCE'
    | 'INVALID_SEQUENCE'
    | 'SEQUENCE_GAP'
    | 'MISSING_EVENT_HASH'
    | 'UNSUPPORTED_HASH_FORMAT'
    | 'EVENT_HASH_MISMATCH'
    | 'PREDECESSOR_HASH_MISMATCH'
    | 'LEGACY_PREDECESSOR_LINK_MISSING'
    | 'LEGACY_PAYLOAD_NOT_BOUND'
  severity: 'error' | 'warning'
  eventId?: string
  message: string
}

export interface AuditChainVerificationResult {
  status: AuditChainVerificationStatus
  checkedEvents: number
  legacyEvents: number
  issues: AuditChainVerificationIssue[]
}

/**
 * Canonical JSON serializer used by the v1 SHA-256 audit event contract.
 * Audit JSON values must be finite JSON primitives, arrays, or plain objects.
 */
export function canonicalizeAuditValue(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Audit payload numbers must be finite')
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalizeAuditValue(item)).join(',') + ']'
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Audit payload objects must be plain JSON objects')
    }

    const object = value as Record<string, unknown>
    const keys = Object.keys(object).sort()
    return '{' + keys.map((key) => {
      const child = object[key]
      if (child === undefined) {
        throw new TypeError(`Audit payload property "${key}" cannot be undefined`)
      }
      return JSON.stringify(key) + ':' + canonicalizeAuditValue(child)
    }).join(',') + '}'
  }

  throw new TypeError(`Unsupported audit payload value: ${typeof value}`)
}

/** Computes the current v1 SHA-256 digest using the exact append contract. */
export function computeAuditEventHash(
  event: AuditEvent,
  sequence: number,
  previousEventHash: string | null,
): string {
  const payload = canonicalizeAuditValue({
    id: event.id,
    sequence,
    schemaVersion: event.schemaVersion ?? '1',
    previousEventHash,
    actorId: event.actorId ?? null,
    actorType: event.actorType ?? null,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    requestId: event.requestId ?? null,
    source: event.source ?? null,
    result: event.result,
    reason: event.reason ?? null,
    policyVersion: event.policyVersion ?? null,
    previousState: event.previousState ?? null,
    newState: event.newState ?? null,
    authorization: event.authorization ?? null,
    createdAt: event.createdAt.toISOString(),
  })

  return createHash('sha256').update(payload).digest('hex')
}

/**
 * Verifies a complete, unfiltered AuditEvent chain ordered by sequence.
 *
 * Legacy MD5 rows are checked against the historical id|sequence|previousId
 * formula, but are reported as legacy because that digest never bound the
 * event's substantive payload. The historical migration also left predecessor
 * hash columns NULL; that gap is reported as a warning, not silently accepted
 * as a fully verified SHA-256 chain.
 */
export function verifyAuditChain(events: readonly AuditEvent[]): AuditChainVerificationResult {
  const issues: AuditChainVerificationIssue[] = []
  const ordered = [...events].sort((left, right) =>
    (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER),
  )
  let legacyEvents = 0

  const addError = (code: AuditChainVerificationIssue['code'], event: AuditEvent, message: string) => {
    issues.push({ code, severity: 'error', eventId: event.id, message })
  }

  ordered.forEach((event, index) => {
    if (event.sequence === undefined || event.sequence === null) {
      addError('MISSING_SEQUENCE', event, 'Event has no sequence number')
      return
    }
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) {
      addError('INVALID_SEQUENCE', event, `Invalid sequence number: ${event.sequence}`)
      return
    }

    const expectedSequence = index + 1
    if (event.sequence !== expectedSequence) {
      addError(
        'SEQUENCE_GAP',
        event,
        `Expected sequence ${expectedSequence}, found ${event.sequence}`,
      )
    }

    if (!event.eventHash) {
      addError('MISSING_EVENT_HASH', event, 'Event has no stored hash')
      return
    }

    const predecessor = index > 0 ? ordered[index - 1] : undefined
    const digest = event.eventHash

    if (/^[a-f0-9]{32}$/.test(digest)) {
      legacyEvents += 1
      const previousId = predecessor?.id ?? ''
      const expected = createHash('md5')
        .update(`${event.id}|${event.sequence}|${previousId}`)
        .digest('hex')

      if (digest !== expected) {
        addError('EVENT_HASH_MISMATCH', event, 'Legacy MD5 digest does not match its historical id/sequence/predecessor-id input')
      }

      if (!predecessor && event.previousEventHash) {
        addError('PREDECESSOR_HASH_MISMATCH', event, 'The first event in the chain must not reference a predecessor hash')
      } else if (predecessor && !event.previousEventHash) {
        issues.push({
          code: 'LEGACY_PREDECESSOR_LINK_MISSING',
          severity: 'warning',
          eventId: event.id,
          message: 'Historical migration did not persist the predecessor event hash',
        })
      } else if (predecessor && event.previousEventHash !== predecessor.eventHash) {
        addError('PREDECESSOR_HASH_MISMATCH', event, 'Stored predecessor hash does not match the preceding event')
      }

      issues.push({
        code: 'LEGACY_PAYLOAD_NOT_BOUND',
        severity: 'warning',
        eventId: event.id,
        message: 'Legacy MD5 digest does not cover actor, action, target, state, authorization, or timestamp fields',
      })
      return
    }

    if (!/^[a-f0-9]{64}$/.test(digest)) {
      addError('UNSUPPORTED_HASH_FORMAT', event, 'Event hash must be a 32-character legacy MD5 or 64-character SHA-256 digest')
      return
    }

    const expectedPreviousHash = predecessor?.eventHash ?? null
    if ((event.previousEventHash ?? null) !== expectedPreviousHash) {
      addError('PREDECESSOR_HASH_MISMATCH', event, 'Stored predecessor hash does not match the preceding event hash')
    }

    try {
      const expected = computeAuditEventHash(event, event.sequence, event.previousEventHash ?? null)
      if (digest !== expected) {
        addError('EVENT_HASH_MISMATCH', event, 'SHA-256 digest does not match the canonical event payload')
      }
    } catch (error) {
      addError(
        'EVENT_HASH_MISMATCH',
        event,
        error instanceof Error ? error.message : 'Unable to canonicalize event payload',
      )
    }
  })

  const hasErrors = issues.some((issue) => issue.severity === 'error')
  return {
    status: hasErrors ? 'invalid' : legacyEvents > 0 ? 'legacy' : 'valid',
    checkedEvents: ordered.length,
    legacyEvents,
    issues,
  }
}
