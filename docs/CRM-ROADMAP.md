# CRM Roadmap

## Status

- Phase 0 (architecture foundation) is delivered via `docs/` (architecture, domain model, security model, audit model, API surface, ADRs).
- Phase 1 (foundation) is delivered and open as PR #1: full-stack monorepo with auth, RBAC, CRUD + audit, dashboard, and a React web app.
- Phase 2 (pipeline and campaigns) is complete: opportunities, pipeline stages, campaigns and sequences, follow-ups, analytics, RBAC, audit, and web UI.
- Phase 3 (ecosystem) is complete: contributors, partners, communities, investors, and NAEOS use cases with RBAC, audit, seed data, and web UI.
- Phase 4 (governance) is complete: versioned policy rules, GO-Gate external action gate with approval lifecycle, execution verification, policy-aware `requireAuth`, advanced audit, seed data, and web UI.
- Phases 5–6 remain future work per the ordering below.

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

### Status

Complete. Phase 2 adds the revenue pipeline and campaign/sequence layer on top of the Phase 1 foundation:

- Prisma models and migration for pipeline stages, opportunities, campaigns, campaign steps, and follow-ups (see `docs/adr/ADR-006-campaign-modeling.md`).
- Repository ports, facades, validation, RBAC (`opportunity`, `pipeline`, `campaign`, `follow-up`, `analytics`), and REST routes in `@naeos-crm/api`.
- Analytics endpoints for pipeline, campaigns, and follow-ups.
- React web pages for Opportunities, Pipeline, Campaigns, Follow-ups, and Analytics with role-aware navigation.
- Seed data for default pipeline stages, opportunities, a campaign with steps, and a follow-up.
- Tests covering service-layer facades, authorization policy, and API integration (Phase 2 suites).
- `opportunity.stage-changed` audit event emitted whenever an opportunity moves between stages.

### Scope

- opportunities
- pipeline stages
- campaigns
- sequences
- follow-ups
- analytics

### Notes

The pipeline and campaign layer evolve from the same domain boundaries without introducing premature integrations. Sequence execution/automation (running steps against contacts) is intentionally deferred to a later phase; only configuration and orchestration data are modeled now.

## Phase 3 — Ecosystem

### Status

Complete. Phase 3 extends the model into ecosystem relationship tracking beyond commercial relationships (see `docs/adr/ADR-007-ecosystem-use-cases.md`):

- Prisma models and migration for communities, contributors, partners, investors, and use cases, plus four shared enums (`EcosystemStatus`, `ContributorRole`, `PartnerType`, `InvestorType`).
- Contributors have an optional single affiliation to a community (`onDelete: SetNull`); use cases are attached to an opportunity (`onDelete: Cascade`) with an optional monetary value.
- Repository ports, facades, validation, RBAC (`contributor`, `partner`, `community`, `investor`, `use-case`), and REST routes in `@naeos-crm/api`.
- Write access to ecosystem records is limited to admins and managers; all roles can read them.
- React web pages for Contributors, Partners, Communities, Investors, and Use Cases with role-aware navigation.
- Seed data for a community, contributors, partners, investors, and a use case tied to the first seeded opportunity.
- Tests covering service-layer facades, authorization policy, and API integration (Phase 3 suites).

### Scope

- contributors
- partners
- communities
- investors
- NAEOS use cases

### Notes

This phase expands the model beyond commercial relationship management into ecosystem relationship tracking. Contributor-to-community affiliation is modeled as a single optional link rather than a many-to-many relation; this is a deliberate simplification that can be promoted to M2M in a future phase without schema churn on the foreign key side.

## Phase 4 — Governance

### Status

Complete. Phase 4 introduces the policy and external action control plane for consequential operations (see `docs/adr/ADR-008-go-gate-policy-rules.md`):

- Prisma models and migration for `PolicyRule` and `GoGateRequest`, including `GoGateStatus` and `GoGateActionType` enums (see `docs/adr/ADR-005-policy-integration-boundary.md` for the original boundary).
- Versioned policy rules with `resource`/`action`/`role` wildcard support, `priority`, `ALLOW`/`DENY` effects (fail closed on no match), and evaluation that breaks ties in favor of `DENY`. `role` is a text column so `'*'` roles can be persisted.
- GO-Gate lifecycle `READY → WAITING_FOR_GO → APPROVED → EXECUTING → EXECUTED | FAILED` plus `REJECTED` and `EXPIRED`, with a 15-minute approval window. Requests denied by policy are recorded as `REJECTED` with the decision reason and policy version.
- Execution verification: after the external adapter returns, the request is marked `EXECUTED`/`verified` or `FAILED`. Adapters (`EmailAdapter`, `GitHubAdapter`) are simulated via `ExternalActionPort` and swappable for real providers.
- Policy-aware `requireAuth`: DB policy rules are evaluated first and are authoritative when they match; otherwise authorization falls back to the static `UserRole` matrix in `@naeos-crm/auth`. `POLICY_VERSION` bumped to `2026.09.17`.
- RBAC additions (`go-gate:read/write/approve/execute`, `policy:read/write/delete`) and advanced audit families `go-gate.*` and `policy-rule.*` recorded on every transition.
- REST routes for `/api/v1/go-gate` (list, create, get, approve, reject, execute) and `/api/v1/policy/rules` (admin CRUD).
- React web pages for GO-Gate and Policy with role-aware navigation.
- Seed data for default policy rules covering `go-gate` and `policy` resources.
- Tests covering the policy adapter (priority, DENY tie-break, fail-closed), service-layer facades, authorization policy, and API integration (Phase 4 suites); 67 API tests total.

### Scope

- policy integration
- authorization engine
- GO-Gate
- advanced audit
- execution verification

### Notes

Policy rules are fail-closed: a consequential external action must be explicitly allowed by a rule. The `READY` state is reserved for future pre-flight flows; requests are currently created directly as `WAITING_FOR_GO` or `REJECTED`. The runtime evaluation queries the policy store on each authorized request; caching is deferred.

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
