# ADR-008: GO-Gate and Versioned Policy Rules

- Status: Accepted
- Date: 2026-09-15

## Context

Phase 4 adds governance to NAEOS CRM: consequential actions (sending email, contacting prospects, creating issues, modifying external systems) must pass through an approval gate before touching the outside world, and authorization must be configurable at runtime rather than hard-coded in the RBAC matrix.

Two design questions drove the shape of the implementation (see ADR-005 for the original boundary):

1. How should the "GO" decision be made — static roles only, or evaluation against database-defined rules?
2. Should the runtime authorization path (`requireAuth`) stay purely static, or also consult the policy store?

A runtime-denied action must never silently succeed, and the whole lifecycle — request, approve, execute, verify — must be auditable and expire if not executed in time.

## Decision

### Policy rules are first-class, versioned data

- `PolicyRule` stores `resource`, `action`, `role`, `effect` (`ALLOW`/`DENY`), `priority`, `enabled`, and `policyVersion`.
- `resource`, `action`, and `role` support the `'*'` wildcard. `role` is a `TEXT` column (not the `UserRole` enum) specifically so wildcards can be persisted.
- Evaluation picks the highest `priority` enabled rule matching `resource`/`action`/`role`; ties are broken in favor of `DENY` (fail closed).
- No matching rule ⇒ `DENY` with reason `no-policy-rule-for-<resource>:<action>`.
- Rules are managed only by admins (`policy:read` for managers too) under `/api/v1/policy/rules`, emitting `policy-rule.created/updated/deleted` audit events.

### GO-Gate is a state machine with a 15-minute approval window

- `GoGateRequest` lifecycle: `READY → WAITING_FOR_GO → APPROVED → EXECUTING → EXECUTED | FAILED`, plus `REJECTED` and `EXPIRED`.
- `POST /api/v1/go-gate` evaluates the go-gate policy rules for the requester's roles; allowed ⇒ `WAITING_FOR_GO`, denied ⇒ `REJECTED` (with the decision reason and `policyVersion` recorded).
- Approval (`go-gate:approve`, admin/manager) moves to `APPROVED` and stamps `expiresAt = now + 15min`.
- Execution (`go-gate:execute`, admin only) accepts only `APPROVED`, flips to `EXECUTING`, calls the external adapter for the action type, and verifies `ok === true` ⇒ `EXECUTED`/`verified`, otherwise `FAILED`.
- Any `APPROVED` request past its `expiresAt` is transitioned to `EXPIRED` and rejected.
- Every transition emits a `go-gate.*` audit event with `previousState`/`newState`.
- External adapters (`EmailAdapter`, `GitHubAdapter`) are simulated providers under `ExternalActionPort`; real providers can be swapped in later.

### requireAuth is policy-aware with a static fallback

- `requireAuth(resource, action)` first evaluates DB policy rules for the requester's roles.
- If a policy rule matches, its decision is authoritative (admins can override static RBAC at runtime).
- If no rule matches (`no-policy-rule-...`), it falls back to the static `UserRole` matrix in `@naeos-crm/auth`.
- Denials are recorded to the audit log as `FAILURE` with the authorization context, matching the pre-existing behavior.
- `POLICY_VERSION` is exported from `@naeos-crm/auth` and bumped to `2026.09.17`; the API adapter records it on every evaluation.

## Rationale

- Fail-closed evaluation (no rule ⇒ deny) matches the governance posture: external actions must be explicitly allowed, never implicitly permitted.
- Persisting rules in the database makes policy data-driven and auditable while keeping a static baseline matrix as the safety net.
- Wildcards on `role` require a text column; the enum column rejects `'*'` at the Prisma client runtime (found during integration testing).
- The 15-minute expiry forces approvals to be acted on promptly and makes the `EXPIRED` state reachable in practice.
- Routing `requireAuth` through the policy adapter first is unobservable when admins keep rule sets scoped to `go-gate`/`policy` resources, but available when needed.

## Consequences

### Positive

- Consequential external actions can no longer be executed without an explicit approval path.
- Policy is inspectable and changeable at runtime by admins without code changes.
- The full request/approve/execute/verify lifecycle is recorded in the audit log.
- Hooks exist (`ExternalActionPort`) for swapping simulated adapters with real providers later.

### Negative

- The server now queries the policy store on every authorized request (`requireAuth`); this is a per-request DB lookup until caching is introduced.
- `role` as a free-text column means rule roles are validated only by the review process, not the schema enum.
- The `READY` initial status is defined but requests are created directly as `WAITING_FOR_GO` or `REJECTED`, so `READY` is reserved for future pre-flight flows.

## Notes

Migrations: `20260915033058_phase4_go_gate_policy` adds `PolicyRule` and `GoGateRequest`; `20260915040557_policy_rule_role_string` converts `role` from enum to `TEXT` for wildcard support (the generated SQL was edited to add a `DEFAULT 'MEMBER'` before the column reset so existing rows survive the type change). Audit event families introduced: `go-gate.*` and `policy-rule.*`.