# API foundation notes

This folder contains Phase 1-safe API scaffolding only.

## Current contents

- `auth.ts`: API authorization guard placeholder
- `domain-interfaces.ts`: domain-facing interfaces for read access
- `service-layer.ts`: application-level façade placeholders
- `ports.ts`: external dependency interfaces for GO-Gate and policy integration
- `gate.ts`: GO-Gate orchestration placeholder
- `integration-adapters.ts`: provider adapter placeholders
- `policy-adapter.ts`: policy integration adapter placeholder

## Important constraints

- No business feature logic is implemented here.
- The API layer does not directly depend on external providers.
- GO-Gate behavior is represented as an explicit boundary.
- Authorization is enforced through server-side services only.
