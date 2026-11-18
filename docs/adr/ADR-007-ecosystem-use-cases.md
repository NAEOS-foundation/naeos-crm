# ADR-007: Ecosystem and NAEOS Use Case Modeling

- Status: Accepted
- Date: 2026-09-15

## Context

Phase 3 extends NAEOS CRM beyond commercial relationship management into ecosystem relationship tracking: contributors, partners, communities, and investors. It also introduces "NAEOS use cases" — concrete application scenarios of the NAEOS platform attached to sales opportunities.

Two modeling choices needed explicit decisions: how contributors relate to communities, and how use cases relate to opportunities.

Early discussions considered a many-to-many relation between contributors and communities (a contributor may be active in several communities). This adds a join table and more complex CRUD/filtering for what is, at Phase 3 scope, a lightweight social record.

Use cases could have been modeled as standalone entities or nested entirely under opportunities. They carry both a narrative (`title`, `summary`) and an optional business `value`, so they need to be addressable and queryable on their own while still belonging to a pipeline story.

## Decision

### Contributors have an optional single affiliation to a Community

- `Contributor.communityId` is an optional foreign key to `Community` with `onDelete: SetNull`.
- A contributor may belong to at most one community; a community may have many contributors.
- Deleting a community keeps the contributor but clears the affiliation.

### Use cases attach to an Opportunity with cascade delete

- `UseCase.opportunityId` is a required foreign key to `Opportunity` with `onDelete: Cascade`.
- A use case has a required `title`, optional `summary`, and optional `value` (`Decimal(14,2)`, normalized to `number` at the repository boundary).
- Use cases are a top-level REST resource (`/api/v1/use-cases`) and are filterable by `opportunityId` and `ownerId`.

### Ecosystem entities share four enums

- `EcosystemStatus` = `ACTIVE | INACTIVE | ARCHIVED`, shared by contributors, partners, communities, and investors.
- `ContributorRole` = `DEVELOPER | DESIGNER | REVIEWER | MAINTAINER | ADVISOR`.
- `PartnerType` = `TECHNOLOGY | INTEGRATION | STRATEGIC | CHANNEL | RESELLER`.
- `InvestorType` = `ANGEL | SEED | VENTURE | STRATEGIC | OTHER`.

### Write access is restricted to admins and managers

- All roles may read every ecosystem resource and use case.
- Only `admin` and `manager` may create, update, or delete them, enforced by `contributor/partner/community/investor/use-case` RBAC permissions and by write gates in the service layer.

## Rationale

- A single optional affiliation keeps the contributor model simple and avoids introducing a join table before a real multi-community need exists; promoting to M2M later does not disturb the contributor foreign key direction.
- Attaching use cases to opportunities ties the narrative of NAEOS applications to the commercial pipeline while `onDelete: Cascade` keeps deletions semantics predictable and prevents orphaned use cases.
- Sharing `EcosystemStatus` across all ecosystem entities keeps status filtering and UI badges consistent.
- Limiting writes to privileged roles matches the CRM's operator posture: ecosystem data is curated, not self-served by members.

## Consequences

### Positive

- Contributor, community, partner, and investor CRUD are straightforward single-table operations.
- Use cases are discoverable both directly and through their opportunity.
- The same `StatusBadge` component and status-based list filters work uniformly across all four ecosystem entities.
- Migration `20260914191445_phase3_ecosystem_use_cases` captures all Phase 3 schema changes.

### Negative

- A contributor's community affiliation is atomic (one community), so mixed-community contributors are not representable without a future schema change.
- Use cases are filtered by `opportunityId`/`ownerId` at the repository layer; there is no aggregated "use case value by pipeline stage" analytics yet (deferred to the analytics phase).
- Ecosystem write access is role-based rather than ownership-scoped, so members cannot curate their own ecosystem records.

## Notes

Use case values use the same precision conventions as opportunity amounts (`Decimal(14,2)` normalized to `number`). Ecosystem and use-case operations emit `*.created/updated/deleted` audit events (resource names `contributor`, `partner`, `community`, `investor`, `use-case`).