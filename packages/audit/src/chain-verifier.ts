import { createHash } from 'node:crypto'
import type { AuditEvent, AuditHashVersion } from './index'

export type AuditChainVerificationStatus = 'valid' | 'legacy' | 'invalid'
export interface AuditChainVerificationIssue {
  code: 'MISSING_SEQUENCE' | 'INVALID_SEQUENCE' | 'SEQUENCE_GAP' | 'MISSING_EVENT_HASH' |
    'MISSING_HASH_METADATA' | 'UNSUPPORTED_HASH_FORMAT' | 'EVENT_HASH_MISMATCH' |
    'PREDECESSOR_HASH_MISMATCH' | 'LEGACY_PREDECESSOR_LINK_MISSING' |
    'LEGACY_PAYLOAD_NOT_BOUND' | 'HASH_METADATA_NOT_BOUND'
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

export function canonicalizeAuditValue(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Audit payload numbers must be finite')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalizeAuditValue).join(',') + ']'
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Audit payload objects must be plain JSON objects')
    const object = value as Record<string, unknown>
    return '{' + Object.keys(object).sort().map((key) => {
      if (object[key] === undefined) throw new TypeError(`Audit payload property "${key}" cannot be undefined`)
      return JSON.stringify(key) + ':' + canonicalizeAuditValue(object[key])
    }).join(',') + '}'
  }
  throw new TypeError(`Unsupported audit payload value: ${typeof value}`)
}

/** v1 preserves the existing preimage; v2 binds algorithm and version metadata. */
export function computeAuditEventHash(
  event: AuditEvent, sequence: number, previousEventHash: string | null,
  hashVersion: Extract<AuditHashVersion, 1 | 2> = 1,
): string {
  const payload: Record<string, unknown> = {
    id: event.id, sequence, schemaVersion: event.schemaVersion ?? '1', previousEventHash,
    actorId: event.actorId ?? null, actorType: event.actorType ?? null,
    action: event.action, entityType: event.entityType, entityId: event.entityId,
    requestId: event.requestId ?? null, source: event.source ?? null,
    result: event.result, reason: event.reason ?? null, policyVersion: event.policyVersion ?? null,
    previousState: event.previousState ?? null, newState: event.newState ?? null,
    authorization: event.authorization ?? null, createdAt: event.createdAt.toISOString(),
  }
  if (hashVersion === 2) {
    payload.hashAlgorithm = 'SHA256'
    payload.hashVersion = 2
  }
  return createHash('sha256').update(canonicalizeAuditValue(payload)).digest('hex')
}

export function verifyAuditChain(events: readonly AuditEvent[]): AuditChainVerificationResult {
  const issues: AuditChainVerificationIssue[] = []
  const ordered = [...events].sort((l, r) => (l.sequence ?? Number.MAX_SAFE_INTEGER) - (r.sequence ?? Number.MAX_SAFE_INTEGER))
  let legacyEvents = 0
  const addError = (code: AuditChainVerificationIssue['code'], event: AuditEvent, message: string) =>
    issues.push({ code, severity: 'error' as const, eventId: event.id, message })

  ordered.forEach((event, index) => {
    if (event.sequence === undefined || event.sequence === null) { addError('MISSING_SEQUENCE', event, 'Event has no sequence number'); return }
    if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) { addError('INVALID_SEQUENCE', event, `Invalid sequence number: ${event.sequence}`); return }
    if (event.sequence !== index + 1) addError('SEQUENCE_GAP', event, `Expected sequence ${index + 1}, found ${event.sequence}`)
    if (!event.eventHash) { addError('MISSING_EVENT_HASH', event, 'Event has no stored hash'); return }
    if (!event.hashAlgorithm || event.hashVersion === undefined) { addError('MISSING_HASH_METADATA', event, 'Event hash algorithm and version metadata are required'); return }

    const predecessor = index > 0 ? ordered[index - 1] : undefined
    const digest = event.eventHash
    if (event.hashAlgorithm === 'MD5' && event.hashVersion === 0) {
      legacyEvents += 1
      if (!/^[a-f0-9]{32}$/.test(digest)) { addError('UNSUPPORTED_HASH_FORMAT', event, 'MD5 v0 digest must be 32 lowercase hexadecimal characters'); return }
      const expected = createHash('md5').update(`${event.id}|${event.sequence}|${predecessor?.id ?? ''}`).digest('hex')
      if (digest !== expected) addError('EVENT_HASH_MISMATCH', event, 'Legacy MD5 digest does not match historical id/sequence/predecessor-id input')
      if (!predecessor && event.previousEventHash) addError('PREDECESSOR_HASH_MISMATCH', event, 'Root event must not reference a predecessor hash')
      else if (predecessor && !event.previousEventHash) issues.push({ code: 'LEGACY_PREDECESSOR_LINK_MISSING', severity: 'warning', eventId: event.id, message: 'Historical migration did not persist the predecessor event hash' })
      else if (predecessor && event.previousEventHash !== predecessor.eventHash) addError('PREDECESSOR_HASH_MISMATCH', event, 'Stored predecessor hash does not match preceding event')
      issues.push({ code: 'LEGACY_PAYLOAD_NOT_BOUND', severity: 'warning', eventId: event.id, message: 'Legacy MD5 digest does not cover substantive event payload fields' })
      return
    }

    if (event.hashAlgorithm !== 'SHA256' || (event.hashVersion !== 1 && event.hashVersion !== 2)) {
      addError('UNSUPPORTED_HASH_FORMAT', event, `Unsupported hash contract: ${event.hashAlgorithm} v${event.hashVersion}`); return
    }
    if (!/^[a-f0-9]{64}$/.test(digest)) { addError('UNSUPPORTED_HASH_FORMAT', event, 'SHA-256 digest must be 64 lowercase hexadecimal characters'); return }
    if ((event.previousEventHash ?? null) !== (predecessor?.eventHash ?? null)) addError('PREDECESSOR_HASH_MISMATCH', event, 'Stored predecessor hash does not match preceding event hash')
    try {
      const expected = computeAuditEventHash(event, event.sequence, event.previousEventHash ?? null, event.hashVersion)
      if (digest !== expected) addError('EVENT_HASH_MISMATCH', event, 'SHA-256 digest does not match canonical event payload')
    } catch (error) {
      addError('EVENT_HASH_MISMATCH', event, error instanceof Error ? error.message : 'Unable to canonicalize event payload')
    }
    if (event.hashVersion === 1) {
      legacyEvents += 1
      issues.push({ code: 'HASH_METADATA_NOT_BOUND', severity: 'warning', eventId: event.id, message: 'Historical SHA-256 v1 preimage does not bind hash algorithm/version metadata' })
    }
  })
  const hasErrors = issues.some((issue) => issue.severity === 'error')
  return { status: hasErrors ? 'invalid' : legacyEvents > 0 ? 'legacy' : 'valid', checkedEvents: ordered.length, legacyEvents, issues }
}
