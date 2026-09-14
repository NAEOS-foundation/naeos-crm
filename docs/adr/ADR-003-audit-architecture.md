# ADR-003: Audit Architecture

- Status: Accepted
- Date: 2026-09-14

## Context

The repository instructions explicitly require auditability as a core design characteristic. The system must produce durable, append-oriented audit records for consequential operations, and these records must remain authoritative even beyond AI memory or transient logs.

Because the repository is empty, the audit design must be established before Phase 1 features are implemented.

## Decision

Implement audit as an append-only event model stored in a dedicated audit table or stream, with every consequential state transition producing a durable audit event that includes actor, action, entity, request_id, previous_state, new_state, authorization context, source, result, and policy version where relevant.

## Rationale

- append-only audit history aligns with the repository’s explicit requirements
- cross-cutting audit data is easier to enforce centrally than through scattered manual logging
- audit records support compliance, incident response, and operational debugging
- event-style audit is compatible with later expansion into more advanced retention or analytics systems

## Consequences

### Positive

- durable evidence of what happened and why
- better support for security investigations
- easier detection of replayed or unauthorized actions
- clean separation between domain state and audit evidence

### Negative

- additional storage and query design effort
- need for careful event payload design and retention planning

## Notes

Audit records should not be updated or deleted through normal CRUD semantics. Corrections should be represented as additional audit events rather than mutating historical rows.
