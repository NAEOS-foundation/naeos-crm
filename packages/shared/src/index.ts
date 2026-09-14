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
