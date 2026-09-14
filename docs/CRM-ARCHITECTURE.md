# CRM Architecture

## Status

This document establishes the architectural foundation for NAEOS CRM before any Phase 1 implementation work begins.

## Repository findings

At the time of this document, the repository contains:

- `README.md` — a minimal project identity placeholder
- `.github/Copilot-intructions.md` — the authoritative engineering and architecture guidance for this repository

There is currently no application source, no database schema, no frontend scaffold, no API implementation, no tests, and no deployment/configuration artifacts. That means the architecture must be established from the repository instructions rather than inherited from an existing codebase.

## Architectural principles

The repository instructions define the following non-negotiable principles:

1. AI recommendation is not authorization.
2. Authorization is explicit, server-side, and separate from authentication.
3. GO-Gate is a first-class security boundary for consequential external actions.
4. Auditability is a core requirement and audit records must be append-oriented.
5. Domain boundaries should be explicit, with bounded contexts and low coupling.
6. PostgreSQL is the preferred relational database unless a stronger repository decision is introduced.
7. Phase-based implementation discipline must be preserved.
8. The architecture should be capable of evolving into SaaS without premature multi-tenancy complexity.

## Proposed technology stack

### Application stack

- Frontend: React + TypeScript + Vite
- Backend: NestJS (TypeScript) using a modular architecture
- API layer: REST with OpenAPI-generated contracts
- Database: PostgreSQL
- ORM / data access: Prisma
- Cache / job coordination: Redis (optional for future async workflows)
- Containerization: Docker Compose for local development
- CI/CD: GitHub Actions
- Observability: structured logging + OpenTelemetry + standard metrics dashboard

### Why this stack fits the repository

- TypeScript across frontend and backend reduces context switching and keeps contracts easier to align.
- NestJS provides a clear modular backend structure suitable for bounded contexts and explicit authorization.
- Prisma supports typed schema management, migrations, and a clean path to PostgreSQL.
- PostgreSQL aligns with the repository’s explicit preference and supports the required audit data model.
- React is a practical choice for a dense operational CRM interface that needs fast iteration and strong component isolation.
- Redis remains optional for later asynchronous workflows and future job queues, rather than being assumed up front.

### Identity and security stack

- Authentication: OIDC-compatible identity provider (e.g., Auth0, Azure AD, or Keycloak)
- Authorization: application-level RBAC/ABAC policies enforced on the backend
- Secrets: environment variables + secret manager for production deployments
- Policy enforcement: explicit server-side permission checks on every sensitive operation

## System context

The application is best modeled as a modular monolith initially, with clear domain boundaries and extension points that can evolve into separate services later if needed.

A modular monolith is preferred over a distributed system at the outset because:

- the repository does not yet contain a multi-service runtime structure
- the architectural need is first to define strong boundaries, authorization, and audit
- the system must remain small and reviewable during early phases
- future service extraction can happen after domain boundaries are proven

## Explicit authorization and external-action flow

The architecture must define a mandatory execution path for every consequential external action.

The required flow is:

1. User or system requests a business action.
2. API boundary validates input and request context.
3. Application layer evaluates authorization against the authenticated actor and resource state.
4. Governance / policy services evaluate policy, required approval, and GO-Gate state.
5. If a consequential external action is required, the system creates an explicit GO-Gate request.
6. An approved GO-Gate request is executed through a dedicated integration boundary.
7. Execution results are recorded to audit as a durable, append-only event.

This flow must be enforced in the backend. The frontend may present status, but it may never be the source of authorization.

## AI optionality and non-authority

AI capability must be implemented as an optional advisory layer that can be disabled without affecting the CRM’s core ability to manage companies, contacts, leads, activities, tasks, and audit. The CRM core must continue to operate when AI is unavailable, disabled, or degraded.

An AI component may generate recommendations, summaries, scores, and drafts, but it must never:

- directly issue an external action
- grant permissions
- alter policy
- write audit records on its own authority
- bypass the explicit authorization and GO-Gate flow

## Policy integration boundary

Future NAEOS policy integration must be possible without rewriting the CRM domain. The architecture therefore requires a governance-facing policy interface that the domain and application layers can call without depending on concrete policy-provider code.

This boundary should be expressed as:

- a governance port/interface for policy evaluation
- a separate policy adapter implementation for NAEOS policy services
- a contract that returns allow/deny, policy version, and sufficient reason metadata

This allows policy enforcement to evolve independently from core CRM business logic.

## SaaS evolution and tenant boundaries

The architecture must remain capable of evolving into SaaS, but not by prematurely introducing microservices or complex multi-tenancy at the current stage. The modular monolith should be designed so that tenant-aware authorization, data isolation, and resource scoping can be introduced later without having to redesign the domain model.

The system must therefore preserve:

- explicit ownership of records
- explicit authorization checks on every sensitive operation
- resource-level scoping for company, contact, opportunity, and activity access
- future separation between shared system concerns and tenant-scoped data

## Bounded contexts

The repository already defines the primary bounded contexts:

1. Relationship
   - Company
   - Contact
   - Lead
   - Relationship Health

2. Revenue
   - Opportunity
   - Pipeline
   - Use Case

3. Engagement
   - Activity
   - Campaign
   - Campaign Step
   - Follow-up
   - Task

4. Ecosystem
   - Contributor
   - Partner
   - Community
   - Investor

5. Governance
   - Policy
   - Authorization
   - GO-Gate
   - Audit

6. Intelligence
   - AI Recommendation
   - Lead Intelligence
   - Relationship Intelligence

## Architectural layers

### 1. Presentation layer

- React application with accessible, dense operational views
- Authentication state handled through a secure session flow
- No business authorization logic in the UI
- Security-critical status such as GO-Gate state must be visible to users

### 2. API layer

- REST endpoints organized by bounded context
- Validation at system boundaries
- Request correlation via request_id
- Consistent error handling and structured logs

### 3. Application layer

- Orchestrates use cases
- Applies domain rules
- Performs authorization checks
- Emits domain events for meaningful state changes

### 4. Domain layer

- Contains business logic, aggregates, and domain types
- Uses explicit domain types instead of primitive-heavy models
- Prevents UI and persistence concerns from leaking into the core logic

### 5. Persistence layer

- PostgreSQL as the source of truth
- Schema changes through migrations only
- Audit data stored separately from mutable entity data where appropriate

### 6. Integration layer

- Adapters isolate provider-specific code
- External data is treated as untrusted input
- Provider APIs cannot directly affect core domain logic

## Cross-cutting concerns

### Security

- Authentication and authorization are separate concerns.
- Backend enforces all sensitive operations.
- AI recommendations are advisory only and never become authorization.
- GO-Gate is required for consequential external actions.

### Audit

- Audit events are append-oriented.
- Each consequential operation creates a durable event with actor, action, entity, request_id, timestamps, previous/new state, policy version, and result.
- Audit records are not silently rewritten.

### Observability

- Structured logs with request correlation
- Metrics for authorization failures, API latency, and audit event publication
- Error classification for safe client responses

## Phase discipline

The instructions explicitly define the implementation order. The current document establishes the foundation only.

### Phase 1 (not yet implemented)

- authentication
- RBAC
- users
- companies
- contacts
- leads
- activities
- tasks
- dashboard
- basic audit

### Later phases

- Phase 2: pipeline and campaigns
- Phase 3: ecosystem entities
- Phase 4: governance, policy, GO-Gate, advanced audit
- Phase 5: AI recommendations and intelligence
- Phase 6: provider integrations

## Proposed repository layout

The repository should evolve into something like the following structure:

```text
.
├── README.md
├── docs/
│   ├── CRM-ARCHITECTURE.md
│   ├── CRM-DOMAIN-MODEL.md
│   ├── CRM-SECURITY-MODEL.md
│   ├── CRM-AUDIT-MODEL.md
│   ├── CRM-API.md
│   ├── CRM-ROADMAP.md
│   └── adr/
│       ├── ADR-001-technology-stack.md
│       ├── ADR-002-domain-boundaries.md
│       ├── ADR-003-audit-architecture.md
│       └── ADR-004-ai-authorization-boundary.md
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── domain/
│   ├── auth/
│   ├── audit/
│   └── shared/
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── .env.example
├── .github/
│   └── workflows/
└── tests/
    ├── integration/
    ├── e2e/
    └── security/
```

## Non-goals for the current stage

- No Phase 5 AI features yet
- No Phase 6 provider integrations yet
- No premature multi-tenancy implementation
- No event bus abstraction unless justified by real workflow complexity
- No service decomposition before bounded contexts are proven

## Verification expectations

Any implementation that follows this architecture must verify:

- authorization enforcement on sensitive actions
- audit publication for consequential changes
- validation at API boundaries
- correct handling of GO-Gate states
- data consistency across domain and persistence layers

## Summary

The repository is currently empty except for project guidance, so the best first move is to define a secure, modular, TypeScript-based architecture centered on PostgreSQL, explicit domain boundaries, authorization-first design, and append-only audit records. This foundation supports the required Phase 1 work without prematurely introducing AI, integrations, or distributed-system complexity.
