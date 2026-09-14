# API layer

The Express REST API implements the Phase 1 foundation.

## Contents

- `app.ts`: Express application factory (middleware wiring, health check, error handler)
- `main.ts`: server bootstrap
- `middleware.ts`: request-id correlation, JWT/development authentication, error handler
- `auth.ts`: API authorization guard backed by the shared RBAC service
- `routes.ts`: all `/api/v1` routes with auth + validation + audit wiring
- `validation.ts`: zod schemas for request bodies and query parameters
- `service-layer.ts`: application facades that orchestrate writes and emit audit events
- `prisma-ports.ts`: Prisma-backed implementations of the domain read/write ports
- `domain-interfaces.ts`: ports consumed by the service layer
- `gate.ts`: GO-Gate orchestration placeholder (Phase 4 boundary)
- `policy-adapter.ts`: policy integration adapter placeholder (Phase 4)
- `integration-adapters.ts`: provider adapter placeholders (Phase 6)

## Constraints

- Authorization is enforced server-side on every route; denied attempts are audited.
- Every consequential write appends an audit event.
- Request bodies are validated with zod before reaching the service layer.
- External providers and GO-Gate remain explicit boundaries only, not yet implemented.