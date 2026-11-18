import { randomUUID } from 'crypto'

export type RequestId = string
export type EntityId = string

export type Result = 'success' | 'failure'

export interface AuditMetadata {
  requestId?: RequestId
  actorId?: EntityId
  source?: string
  policyVersion?: string
}

export interface SafeErrorResponse {
  error: {
    code: string
    message: string
    request_id?: string
  }
}

export type DomainStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'

export function generateRequestId(): string {
  return randomUUID()
}

export function buildSuccessMeta(requestId?: string) {
  return {
    request_id: requestId ?? '',
    timestamp: new Date().toISOString(),
  }
}

export function buildPaginatedMeta(requestId: string | undefined, total: number, limit: number, offset: number) {
  return {
    request_id: requestId ?? '',
    timestamp: new Date().toISOString(),
    total,
    limit,
    offset,
  }
}

export function buildErrorResponse(code: string, message: string, requestId?: string) {
  return {
    error: {
      code,
      message,
      request_id: requestId,
    },
  }
}
