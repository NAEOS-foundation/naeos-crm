import { describe, expect, it, vi } from 'vitest'

import { NAEOSPolicyAdapter } from './policy-adapter'

function fakePort(findForEvaluation: any) {
  return { findForEvaluation: vi.fn(findForEvaluation), findById: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }
}

describe('NAEOSPolicyAdapter', () => {
  const adapter = new NAEOSPolicyAdapter(fakePort(() => Promise.resolve([])) as any)

  it('returns false with reason no-policy-rule-for when no rules match', async () => {
    const result = await adapter.evaluate({ resource: 'go-gate', action: 'SEND_EMAIL', roles: ['MEMBER'] })
    expect(result.allow).toBe(false)
    expect(result.reason).toBe('no-policy-rule-for-go-gate:SEND_EMAIL')
  })

  it('allows when matching ALLOW rule', async () => {
    const rule = { id: 'r1', effect: 'ALLOW', priority: 0, updatedAt: new Date() }
    const port = fakePort(() => Promise.resolve([rule]))
    const test = new NAEOSPolicyAdapter(port as any)
    const result = await test.evaluate({ resource: 'go-gate', action: 'SEND_EMAIL', roles: ['ADMIN'] })
    expect(result.allow).toBe(true)
    expect(result.reason).toContain('r1')
  })

  it('denies when matching DENY rule', async () => {
    const rule = { id: 'r2', effect: 'DENY', priority: 0, updatedAt: new Date() }
    const port = fakePort(() => Promise.resolve([rule]))
    const test = new NAEOSPolicyAdapter(port as any)
    const result = await test.evaluate({ resource: 'go-gate', action: 'SEND_EMAIL', roles: ['ADMIN'] })
    expect(result.allow).toBe(false)
  })

  it('prefers higher priority rule', async () => {
    const low = { id: 'low', effect: 'ALLOW', priority: 1, updatedAt: new Date() }
    const high = { id: 'high', effect: 'DENY', priority: 99, updatedAt: new Date() }
    const port = fakePort(() => Promise.resolve([low, high]))
    const test = new NAEOSPolicyAdapter(port as any)
    const result = await test.evaluate({ resource: 'go-gate', action: 'SEND_EMAIL', roles: ['ADMIN'] })
    expect(result.allow).toBe(false)
    expect(result.reason).toContain('high')
  })

  it('breaks ties in favor of DENY', async () => {
    const allow = { id: 'allow1', effect: 'ALLOW', priority: 0, updatedAt: new Date() }
    const deny = { id: 'deny1', effect: 'DENY', priority: 0, updatedAt: new Date() }
    const port = fakePort(() => Promise.resolve([allow, deny]))
    const test = new NAEOSPolicyAdapter(port as any)
    const result = await test.evaluate({ resource: 'go-gate', action: 'SEND_EMAIL', roles: ['ADMIN'] })
    expect(result.allow).toBe(false)
    expect(result.reason).toContain('deny1')
  })
})