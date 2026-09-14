# CRM Roadmap

## Status

- Phase 0 (architecture foundation) is delivered via `docs/` (architecture, domain model, security model, audit model, API surface, ADRs).
- Phase 1 (foundation) is delivered and open as PR #1: full-stack monorepo with auth, RBAC, CRUD + audit, dashboard, and a React web app.
- Phases 2–6 remain future work per the ordering below.

## Phase 0 — Architecture foundation

This phase is complete. It established the architecture, domain model, security model, audit model, API contract, and ADRs.

### Deliverables

- architecture documentation
- domain boundaries
- security model
- audit model
- API surface definition
- ADRs for core decisions

## Phase 1 — Foundation

### Status

Complete and open as PR #1. The implementation includes the API (`@naeos-crm/api`), React web app (`@naeos-crm/web`), shared domain/security/audit packages, Prisma schema + migrations + seed, and CI with build, lint, and test gates.

### Scope

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

### Completion criteria

- users can authenticate and access only permitted records
- company, contact, lead, activity, and task operations are complete with authorization and audit
- dashboard provides a useful operational overview
- tests cover domain, integration, authorization, and audit behavior

## Phase 2 — Pipeline and campaigns

### Scope

- opportunities
- pipeline stages
- campaigns
- sequences
- follow-ups
- analytics

### Notes

The pipeline and campaign layer should evolve from the same domain boundaries without introducing premature integrations.

## Phase 3 — Ecosystem

### Scope

- contributors
- partners
- communities
- investors
- NAEOS use cases

### Notes

This phase expands the model beyond commercial relationship management into ecosystem relationship tracking.

## Phase 4 — Governance

### Scope

- policy integration
- authorization engine
- GO-Gate
- advanced audit
- execution verification

### Notes

This phase introduces the policy and external action control plane for consequential operations.

## Phase 5 — AI

### Scope

- AI assistant
- lead intelligence
- relationship intelligence
- recommendations

### Notes

AI functionality is intentionally deferred until the governance and audit foundations are in place.

## Phase 6 — Integrations

### Scope

- Gmail
- GitHub
- Calendar
- Discord
- other providers

### Notes

Provider adapters should be introduced only after the domain boundaries, authorization model, and audit model are mature.

## Delivery discipline

The following constraints apply throughout the roadmap:

- do not skip directly to Phase 5
- do not introduce Phase 6 integrations before Phase 4 governance is established
- avoid premature multi-tenancy complexity
- keep implementation incremental and reviewable

## Success measures

The roadmap should be considered successful when:

- architecture remains aligned with repository instructions
- domain boundaries are stable
- security and audit controls are verified
- implementation is phased instead of monolithic
- future SaaS evolution is not blocked by initial design choices

## Summary

The architecture foundation is the first priority. Once that foundation is stable, the project can proceed through the ordered phases without destabilizing the security and audit posture.
