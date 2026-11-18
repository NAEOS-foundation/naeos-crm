# ADR-009: Supabase as the Unified Backend Foundation

- Status: Proposed for staging validation
- Date: 2026-11-18
- Decision owners: NAEOS maintainers
- Scope: NAEOS CRM and shared Supabase staging project `naeos.db`
- Production impact: None. This ADR authorizes no production change, deployment, secret modification, or key rotation.

## Context

NAEOS is adopting a Supabase-centric backend while retaining Go services as the governance and verification runtime. Supabase is the target for PostgreSQL persistence, identity provider, storage, and realtime capabilities. The CRM API remains a trusted application boundary for domain operations and authorization until the IAM and tenant-isolation contracts are verified.

The staging Supabase project inspected for this work is:

- Project name: `naeos.db`
- Project ref: `kqmhpsftijskesjdovjm`
- Region: `ap-northeast-1`
- PostgreSQL: 17.6
- Project state at inspection: `ACTIVE_HEALTHY`

The CRM production Supabase project is separate and explicitly out of scope.

## Verified staging baseline

At inspection:

- 19 Supabase migration-history entries were present: four shared NAEOS foundation/control-plane entries and fifteen CRM-labelled entries.
- The current `naeos-crm/main` Prisma migration directory contains fourteen migration directories.
- The staging migration history includes `crm_public_rls_service_only_hardening`; no matching migration directory is present in the current CRM `main` tree.
- The 22 CRM tables in `public` have RLS enabled and no table-specific policies. The inspected grants show no direct table grants to `anon` or `authenticated`; `service_role` has broad table privileges.
- The shared `naeos_identity` and `naeos_control_plane` schemas have dedicated runtime/admin database roles and role-scoped policies.
- Staging contains one Supabase Auth user, zero CRM `User` rows, zero CRM `Company` rows, one organization, one workspace, and two memberships.

These observations are a baseline, not a security certification. The service-role key bypasses RLS and must remain server-side. Public CRM access must continue through the trusted API until an explicit RLS contract and tests are approved.

## Current application boundary

The CRM currently uses Prisma with `DATABASE_URL`. Its authentication implementation calls Supabase Auth's `/auth/v1/user` endpoint to validate a supplied access token, maps the provider UUID to a CRM user, and then issues a separate CRM HS256 session cookie. Therefore Supabase Auth is integrated, but it is not yet the sole session/token authority for the CRM.

The CRM's existing RBAC and Go governance boundaries must not be weakened during the migration. The separate NAEOS Intelligence ES256/JWKS work is not automatically a replacement for CRM's own session contract.

## Decision

1. Use the `naeos.db` project as the only database target for this staging work.
2. Keep the CRM API and Go governance/verification services as trusted server-side boundaries; do not move authorization decisions into client code.
3. Treat Supabase Auth as the intended identity provider. Adopt direct JWT/JWKS verification only after issuer, audience, algorithm, key-rotation, account-linking, and session-revocation contracts are reviewed and tested.
4. Keep CRM domain tables backend-only for now. RLS being enabled without public policies is intentional defense-in-depth for the current service-only access model; it is not a tenant-isolation implementation for direct client access.
5. Do not introduce a second copy of CRM domain tables in another schema. Reconcile the existing `public` CRM schema with the shared identity schemas before adding cross-schema relationships.
6. Do not add or apply a new database migration until every migration already present in staging has a canonical, reviewable source artifact in version control and the Prisma migration history has been reconciled.
7. Do not configure `directUrl`, change runtime connection modes, or update deployment secrets as part of this documentation-only baseline. The current CI and production migration workflows consume `DATABASE_URL`; any later connection split must update CI safely and remain isolated from production.

## Consequences

- Supabase becomes the planned unified data and identity platform without removing the Go governance runtime.
- Staging remains the only integration target during this phase.
- A migration-provenance reconciliation task is a blocking prerequisite for future schema changes.
- Direct browser access to CRM tables remains disabled; the frontend continues to use the CRM API.
- Production changes require a separate reviewed plan, backup/rollback evidence, and explicit approval.

## Acceptance criteria for the next implementation phase

- Every staging migration has a canonical source file and deterministic ordering.
- Prisma schema and staging catalog are reconciled with no unexplained drift.
- Database connectivity is validated from a non-production test process without printing or committing credentials.
- Supabase Auth issuer/audience/ES256 verification and CRM identity-linking behavior have automated negative and positive tests.
- Tenant isolation is proven with cross-tenant denial tests before any direct client data access is enabled.
- No production deployment or configuration change is part of staging acceptance.
