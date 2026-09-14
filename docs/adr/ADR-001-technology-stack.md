# ADR-001: Technology Stack

- Status: Accepted
- Date: 2026-09-14

## Context

The repository currently contains only the project guidance and a minimal README. There is no existing application stack to preserve, and the repository instructions explicitly require a secure, modular, auditable, and extensible architecture.

The platform must support:

- dense operational CRM workflows
- explicit authorization
- append-only audit trails
- future SaaS readiness
- phased implementation without premature complexity

## Decision

Adopt the following initial technology stack:

- Frontend: React + TypeScript + Vite
- Backend: NestJS with TypeScript
- API: REST with OpenAPI contracts
- Database: PostgreSQL
- ORM: Prisma
- Optional async coordination: Redis
- Local development: Docker Compose
- CI/CD: GitHub Actions
- Observability: structured logs + OpenTelemetry compatible instrumentation

## Rationale

- TypeScript across frontend and backend improves consistency and contract alignment.
- NestJS offers a modular structure suitable for bounded contexts and policy enforcement.
- PostgreSQL is the repository’s preferred relational database and supports the required audit model.
- Prisma provides a clean migration and schema-management path.
- React is a good fit for an intensive operator dashboard and detailed relationship views.
- The modular monolith approach avoids premature distributed-system complexity while allowing future service extraction.

## Consequences

### Positive

- consistent developer experience across the stack
- easier domain/API alignment
- clear path to predictable Phase 1 implementation
- strong fit for authorization and audit architecture

### Negative

- the project will start as a modular monolith rather than a distributed system
- Redis is optional only and may not be used in the first implementation

## Follow-up

If architectural scope later proves too large for a single backend service, the bounded contexts and interfaces defined by the repository should guide extraction rather than the initial stack choice.
