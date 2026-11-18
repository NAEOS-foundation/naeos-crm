# ADR-002: Domain Boundaries

- Status: Accepted
- Date: 2026-09-14

## Context

The repository instructions define six bounded contexts:

- Relationship
- Revenue
- Engagement
- Ecosystem
- Governance
- Intelligence

Because the repository is currently empty, the project needs clear domain boundaries before any implementation begins. Without these boundaries, coupling would likely grow quickly, especially around auth, audit, and AI concerns.

## Decision

Organize the CRM into the six bounded contexts listed in the repository instructions and keep them loosely coupled through explicit interfaces and well-defined domain events.

## Rationale

- Each bounded context owns a coherent set of business concepts.
- The domains map naturally to the product’s proposed operational areas.
- Governance and audit remain separate from relationship data, reducing accidental coupling.
- Intelligence remains advisory and decoupled from authorization or external action execution.

## Consequences

### Positive

- clearer ownership of business logic
- simpler testing and authorization model
- easier future evolution toward SaaS or service extraction
- reduced risk of duplicated business rules across layers

### Negative

- the initial implementation will need explicit mapping between resources and contexts
- some cross-context queries may require careful application coordination

## Notes

The relationship and revenue contexts should remain independent enough that changes in one do not require redesign of the other. Governance must remain authoritative for permissions and GO-Gate concerns.
