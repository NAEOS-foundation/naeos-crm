# CRM Audit Model

## Status

This document describes the audit architecture required by the repository instructions.

## Audit design principles

The repository establishes the following requirements:

- auditability is a core requirement
- consequential operations must produce audit events
- audit operations are append-oriented
- audit records must outlive AI memory
- audit records must not be silently rewritten

## Audit scope

The audit model should capture consequential operations across the product, including:

- user actions
- authorization decisions
- policy evaluations
- GO-Gate state changes
- external action requests and results
- AI recommendations and advisory events
- integration requests
- data updates that materially affect records

## Audit event structure

Each audit event should contain the following fields when applicable:

- actor
- action
- entity
- entity_id
- timestamp
- request_id
- previous_state
- new_state
- source
- authorization
- policy_version
- result
- reason

### Recommended event envelope

```json
{
  "audit_id": "uuid",
  "actor": { "id": "user-123", "type": "user" },
  "action": "company.updated",
  "entity": "Company",
  "entity_id": "company-456",
  "timestamp": "2026-09-14T12:00:00Z",
  "request_id": "req-789",
  "previous_state": { "status": "active" },
  "new_state": { "status": "inactive" },
  "source": "api",
  "authorization": {
    "decision": "allow",
    "policy_version": "2026.09.14"
  },
  "result": "success",
  "reason": "owner-approved status change"
}
```

## Audit storage model

### Core rule

Audit data should be stored in immutable append-only form.

### Storage pattern

- a dedicated audit table or stream-oriented store
- one record per consequential event
- no normal CRUD semantics for history revisions
- corrective actions represented with new audit events, not overwrites

### Recommended table design

- audit_events
  - id
  - actor_id
  - actor_type
  - action
  - entity_type
  - entity_id
  - request_id
  - source
  - result
  - reason
  - policy_version
  - created_at
  - previous_state_json
  - new_state_json
  - authorization_json

## Tamper resistance and storage controls

Audit records must be stored in a way that is independent from AI memory, application logs, and transient UI state. At minimum, the architecture should require:

- a dedicated audit storage model with database-level constraints that prevent normal update/delete semantics for historical rows
- restricted write permissions so that ordinary application users cannot overwrite audit history
- a durable append-only storage path for audit events
- audit event publication from application and governance services, not from AI components alone

For stronger tamper resistance, the implementation should also consider:

- a separate audit schema or database instance
- immutable retention policies for audit history
- cryptographic integrity checks or signed event records for compliance-sensitive deployments

Any correction to a prior state must be represented by a new corrective audit event, never by rewriting historical audit content.

## Audit sources

### 1. Domain events

Domain operations that materially change state should emit audit events.

### 2. Authorization events

Policy evaluation outcomes should be captured, including:

- allow/deny decisions
- policy version used
- reasons for denial

### 3. GO-Gate lifecycle events

The system should record transitions such as:

- GO-Gate requested
- GO-Gate approved
- GO-Gate rejected
- GO-Gate expired
- GO-Gate executed
- GO-Gate failed

### 4. Integration events

External actions should produce audit records for:

- request started
- request sent
- provider response received
- execution result
- failure classification

### 5. AI advisory events

AI-generated recommendations should be logged as advisory events with provenance, model version, and confidence, but not treated as authoritative business actions.

## Corrective events

When a record requires correction, the system should append a new event that explains the correction rather than mutating historical audit rows.

Examples:

- `audit_event.corrected`
- `audit_event.reversed`
- `audit_event.remediation_applied`

This preserves the historical trail while supporting compliance and investigation needs.

## Audit query patterns

The audit model should support:

- query by entity_id
- query by actor_id
- query by request_id
- query by time window
- query by result / failure type
- query by policy version
- query by GO-Gate request id

## Compliance posture

The audit trail must be durable enough to support:

- incident review
- security investigations
- operational debugging
- compliance reporting
- accountability for consequential actions

## Audit testing

The system must include audit tests for:

- successful domain changes emit audit events
- denied operations are logged with policy context
- GO-Gate transitions are recorded correctly
- AI recommendations are advisory and auditable
- audit history cannot be silently modified
- out-of-order or replayed actions are detected and recorded

## Open audit questions

- Should audit storage be a separate schema or a separate database instance for stronger isolation?
- Should audit retention be configurable by entity class or by compliance policy?
- Should the system support immutable event lakes for long-term retention in later phases?

## Summary

The audit model for NAEOS CRM should be append-only, entity-aware, and policy-aware. It must capture both the state transition and the authorization context so that investigators can determine not only what happened, but why and under which policy version it was allowed.
