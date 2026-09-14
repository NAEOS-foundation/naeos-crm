# CRM API

## Status

This document defines the intended API boundaries for NAEOS CRM before implementation begins.

## API principles

The repository instructions require that:

- API boundaries reflect domain boundaries
- behavior be validated, authenticated, authorized, observable, and auditable
- errors be consistent and safe
- internal stack traces never be exposed to clients

## API versioning

The API should use explicit versioning from the start.

Suggested prefix:

- `/api/v1`

## Core resource groups

### Relationship resources

- `GET /api/v1/companies`
- `GET /api/v1/companies/:id`
- `POST /api/v1/companies`
- `PATCH /api/v1/companies/:id`
- `DELETE /api/v1/companies/:id` (only if justified by business policy)

- `GET /api/v1/contacts`
- `GET /api/v1/contacts/:id`
- `POST /api/v1/contacts`
- `PATCH /api/v1/contacts/:id`

- `GET /api/v1/leads`
- `GET /api/v1/leads/:id`
- `POST /api/v1/leads`
- `PATCH /api/v1/leads/:id`

### Engagement resources

- `GET /api/v1/activities`
- `GET /api/v1/activities/:id`
- `POST /api/v1/activities`
- `PATCH /api/v1/activities/:id`

- `GET /api/v1/tasks`
- `GET /api/v1/tasks/:id`
- `POST /api/v1/tasks`
- `PATCH /api/v1/tasks/:id`

### Revenue resources

- `GET /api/v1/opportunities`
- `GET /api/v1/opportunities/:id`
- `POST /api/v1/opportunities`
- `PATCH /api/v1/opportunities/:id`

- `GET /api/v1/pipelines`
- `GET /api/v1/pipelines/:id`

### Ecosystem resources

- `GET /api/v1/contributors`
- `GET /api/v1/partners`
- `GET /api/v1/communities`
- `GET /api/v1/investors`

### Governance resources

- `GET /api/v1/audit`
- `GET /api/v1/audit/:id`
- `GET /api/v1/go-gates`
- `GET /api/v1/go-gates/:id`
- `POST /api/v1/go-gates`
- `PATCH /api/v1/go-gates/:id`

### Intelligence resources

- `GET /api/v1/recommendations`
- `GET /api/v1/recommendations/:id`
- `POST /api/v1/recommendations` (advisory generation requests)

## Request and response conventions

### Common headers

- `Authorization: Bearer <token>`
- `X-Request-Id: <uuid>`
- `Content-Type: application/json`

### Response envelope

```json
{
  "data": {},
  "meta": {
    "request_id": "req-123",
    "timestamp": "2026-09-14T12:00:00Z"
  }
}
```

### Error envelope

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not allowed to perform this action.",
    "request_id": "req-123"
  }
}
```

## Authentication and authorization

- Every sensitive endpoint requires authenticated user context.
- Authorization must be evaluated on the server for every request.
- Client state, hidden UI elements, and URL parameters must never be trusted as authorization evidence.
- GO-Gate status must be returned in responses where relevant.

### External action contract

Any endpoint that triggers an external message, workflow, or system change must explicitly route through the governance / GO-Gate service and must return a clearly identifiable GO-Gate state in the response.

The API contract must distinguish between:

- advisory recommendation endpoints
- policy evaluation endpoints
- GO-Gate request creation
- GO-Gate approval or rejection
- external action execution status

No API endpoint may allow an AI subsystem to directly execute an external action without first passing through the same authorization and GO-Gate controls as any other privileged request.

## Validation

Validation should exist at:

- API boundary
- provider adapter boundary
- persistence layer where applicable

The backend should reject malformed or unauthorized requests consistently.

## Observability

Every request should produce:

- structured logs
- request_id correlation
- operation classification
- result classification
- audit event emission where appropriate

## Event-driven integration pattern

For meaningful state transitions, the API should either:

- publish domain events internally, or
- trigger application services that emit domain events

The API should not directly expose internal implementation details.

## Open API contract expectations

The API should expose generated OpenAPI documentation once the first implementation is introduced, so that:

- contracts are testable
- client expectations are explicit
- authorization requirements are discoverable

## Phase-specific API scope

### Phase 1

- companies
- contacts
- leads
- activities
- tasks
- dashboard summary
- audit read endpoints

### Phase 2

- opportunities
- pipeline APIs
- campaigns
- sequences
- follow-ups

### Phase 3

- contributors
- partners
- communities
- investors

### Phase 4

- policy endpoints
- GO-Gate endpoints
- advanced audit APIs

### Phase 5

- intelligence and recommendation endpoints

### Phase 6

- integration adapters and provider-specific endpoints behind the integration layer

## Summary

The API boundary should stay aligned with the domain model: resources should be grouped by bounded context, and authorization, auditability, and validation should be built into the API design from the beginning.
