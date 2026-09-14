# ADR-005: Policy Integration Boundary

- Status: Accepted
- Date: 2026-09-14

## Context

The repository requires future NAEOS policy integration without rewriting the CRM domain. Policy-aware access control, GO-Gate enforcement, and policy version tracking must therefore be expressible without embedding provider-specific policy logic into the core CRM domain.

## Decision

Introduce a governance-facing policy integration boundary that is consumed by the application layer and domain services through explicit interfaces and ports.

The boundary will provide the following capabilities:

- policy evaluation for permissions and conditions
- policy version retrieval
- authorization outcome metadata including reason codes
- GO-Gate state evaluation for consequential external actions

The CRM domain should depend only on the boundary contract, not on any concrete policy engine implementation.

## Rationale

- this preserves the separation between business logic and governance logic
- the domain remains stable even if the policy engine or NAEOS policy service changes
- it supports future SaaS tenant and policy evolution without domain rewrites
- it aligns with the repository’s requirement that AI be advisory and authorization remain explicit

## Consequences

### Positive

- clear dependency direction from domain/application to governance interface
- easier testing and policy mocking at the boundary
- less risk of domain leakage into policy or external integration code
- future policy services can be swapped without changing the domain model

### Negative

- one extra abstraction layer must be maintained
- the integration contract must be kept stable and reviewed as the policy system evolves

## Notes

The policy boundary must remain an implementation detail of governance, not a hidden dependency of the UI or external adapters. Any consequential action remains subject to the same explicit authorization and GO-Gate flow regardless of whether the policy decision comes from an internal or external source.
