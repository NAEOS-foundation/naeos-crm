import { describe, expect, it, afterAll } from 'vitest'
import type { AuditEvent } from '@naeos-crm/audit'
import { PrismaPolicyRuleReadPort, prisma } from './prisma-ports'

const enabled = Boolean(process.env.DATABASE_URL)

describe.skipIf(!enabled)('Atomic Policy Rule audit integration', () => {
  const suffix = `atomic-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const port = new PrismaPolicyRuleReadPort()
  let ruleId: string | undefined

  const event = (id: string, action: string, entityId: string): AuditEvent => ({
    id,
    actorId: 'atomic-audit-test',
    action,
    entityType: 'policy-rule',
    entityId,
    requestId: suffix,
    result: 'SUCCESS',
    createdAt: new Date(),
  })

  afterAll(async () => {
    if (ruleId) await prisma.policyRule.deleteMany({ where: { id: ruleId } })
    // Audit records are append-only and intentionally not deleted by this test.
    await prisma.$disconnect()
  })

  it('commits Policy Rule update and matching audit record together', async () => {
    const created = await port.create({
      resource: `test-resource-${suffix}`,
      action: 'TEST',
      role: 'ADMIN',
      effect: 'ALLOW',
      priority: 1,
      enabled: true,
      policyVersion: 'atomic-audit-test',
    })
    ruleId = created.id

    const auditId = `atomic-audit-success-${suffix}`
    const updated = await port.updateWithAudit(created.id, { priority: 42 }, event(auditId, 'policy-rule.updated', created.id))

    expect(updated?.priority).toBe(42)
    const persisted = await prisma.auditEvent.findUnique({ where: { id: auditId } })
    expect(persisted).toMatchObject({ action: 'policy-rule.updated', entityType: 'policy-rule', entityId: created.id })
    expect(persisted?.eventHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rolls back the Policy Rule update when audit insert fails', async () => {
    if (!ruleId) throw new Error('Expected test Policy Rule from success test')
    const before = await port.findById(ruleId)
    const successfulAudit = await prisma.auditEvent.findFirst({ where: { entityId: ruleId, requestId: suffix }, select: { id: true } })
    if (!successfulAudit) throw new Error('Expected successful audit event from preceding test')

    await expect(
      port.updateWithAudit(ruleId, { priority: 99 }, event(successfulAudit.id, 'policy-rule.updated', ruleId)),
    ).rejects.toBeTruthy()

    const after = await port.findById(ruleId)
    expect(after?.priority).toBe(before?.priority)
    const matchingAudit = await prisma.auditEvent.findMany({ where: { entityId: ruleId, requestId: suffix } })
    expect(matchingAudit).toHaveLength(1)
    expect(matchingAudit[0].id).toContain('atomic-audit-success-')
  })
})
