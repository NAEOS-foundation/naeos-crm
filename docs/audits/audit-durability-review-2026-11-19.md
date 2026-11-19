# Audit Durability Review

**Status:** Review findings / remediation proposal  
**Scope:** API mutation audit events and Go-Gate lifecycle  
**Date:** 2026-11-19  
**Environment:** Repository review only; no runtime or database changes

## Executive summary

The audit event hash-chain implementation uses database transactions, an advisory lock, ordered sequence values, and SHA-256 hashes. This protects chain append consistency, but it does not guarantee that business mutations and their audit records are committed together.

In `apps/api/src/service-layer.ts`, the helper `auditSafely()` catches audit write errors and logs them. The repository review found 54 occurrences of this helper (including its definition), across CRUD operations and other business modules. In these paths, a mutation may persist while its audit event is absent.

## Confirmed design observations

- `AuditService.record()` propagates sink errors.
- `PrismaAuditSink.append()` uses a transaction and advisory lock for chain append integrity.
- `auditSafely()` suppresses exceptions and permits callers to continue.
- Most facade mutation paths perform business write and audit append as separate operations.
- Go-Gate lifecycle operations use direct audit writes (not the helper); failures may interrupt lifecycle handling after state changes.
- External execution cannot be made atomic with a database transaction; it requires durable intent/outbox, idempotency, and reconciliation.

## Risk classification

| Scope | Risk | Priority |
|---|---|---|
| Policy-rule create/update/delete | Authorization policy may change without reliable audit record | P1 |
| User create/update/delete and role changes | Privileged identity changes may lack evidence | P1 |
| Go-Gate approval/rejection/execution lifecycle | State transition and evidence/audit failure can diverge | P1 |
| Entity CRUD across CRM modules | Mutation may succeed with missing audit evidence | P1/P2 by data sensitivity |
| Denied authorization audit | Denial log is best-effort; request still correctly denied | P2 evidence gap |

## Recommended remediation phases

### Phase A — Map critical mutation paths (no behavior changes)
- Classify mutations by sensitivity and external side effects.
- Document which mutation/audit pairs currently use separate writes.
- Identify existing transactional ports and Prisma client access patterns.
- Record explicit failure behavior and test expectations.

### Phase B — Atomic audit for DB-backed critical mutations
- Introduce transaction-aware mutation/audit APIs where the same Prisma transaction can cover both.
- Do not implement “throw after mutation” as a generic fix; that can return failure while the data is already persisted.
- Ensure rollback tests prove that both mutation and audit event are absent when the transaction fails.
- Scope initial rollout to high-risk operations, then expand.

### Phase C — External actions / Go-Gate reliability
- Persist execution intent and state transitions before invoking providers.
- Use idempotency keys and durable outbox/worker semantics for retries.
- Reconcile ambiguous provider outcomes; avoid retrying non-idempotent actions blindly.
- Treat missing audit/evidence as an explicit failure or unresolved state with operator visibility, not a silent success.
- Add tests for audit-write failure before provider invocation, provider timeout, retry, and evidence write failure.

### Phase D — Observability and operational controls
- Add measurable audit append failure counters/alerts, without exposing sensitive payloads.
- Provide an integrity verification report for the full chain (unfiltered sequence order).
- Define incident procedure for missing audit records and reconciliation.
- Preserve existing legacy records; do not rewrite historical MD5 entries to claim retroactive SHA-256 coverage.

## Acceptance criteria for implementation PRs

- Critical mutations and their audit records commit atomically where both are database-backed.
- No generic post-mutation exception path that falsely implies rollback.
- External execution uses durable intent, idempotency, reconciliation, and explicit evidence status.
- Failure-injection tests cover audit sink outage and transaction rollback.
- CI passes; no security gate is bypassed.
- Changes are staged and reviewed; no production migration or deployment without explicit approval.

## Scope exclusions

This review does not change application code, schema, database, secrets, production, staging, deployment, or PR merge state. It is a design/finding record only.

## Additional repository evidence: transactional Outbox

- The existing `PrismaEvidenceReceiptWritePort.create()` writes an Evidence Receipt and its Outbox Event in the same Prisma transaction. This is a verified pattern worth extending selectively.
- The Outbox port already supports event enqueueing and worker claim/lease state transitions. This reduces the need to invent a second delivery queue.
- The audit sink currently opens its own transaction, so it cannot be directly composed into an existing mutation transaction through the current interface. A transaction-scoped audit append adapter or shared Prisma transaction boundary would be required.
- Go-Gate request transitions use conditional status updates, which help protect against stale state transitions. However, transition and audit append remain separate writes; provider invocation occurs after the EXECUTING transition and is not itself atomic with the database.

**Design implication:** Phase B should first prototype a transaction-scoped audit append with a shared Prisma transaction client and tests, then apply it to a narrow critical mutation (e.g., policy-rule update) only after rollback semantics are demonstrated. Phase C should reuse the established Outbox primitives for durable execution orchestration rather than treating an outbox row as a substitute for the audit hash-chain.
