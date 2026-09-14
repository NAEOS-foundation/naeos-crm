import type { PolicyPort, ExternalActionPort } from './ports'

export interface GoGateRequest {
  id: string
  status: 'READY' | 'WAITING_FOR_GO' | 'APPROVED' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'EXPIRED' | 'REJECTED'
}

export class GoGateService {
  constructor(
    private readonly policyPort: PolicyPort,
    private readonly externalActionPort: ExternalActionPort,
  ) {}

  async requestExecution(input: Record<string, unknown>): Promise<GoGateRequest> {
    const policy = await this.policyPort.evaluate(input)

    if (!policy.allow) {
      return { id: 'go-gate-request', status: 'REJECTED' }
    }

    return { id: 'go-gate-request', status: 'APPROVED' }
  }

  async executeApproved(input: Record<string, unknown>): Promise<{ ok: boolean }> {
    const result = await this.externalActionPort.execute(input)
    return { ok: result.ok }
  }
}
