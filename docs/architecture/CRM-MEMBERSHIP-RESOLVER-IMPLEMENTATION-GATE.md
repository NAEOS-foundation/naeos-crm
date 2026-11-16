# CRM Membership Resolver — Implementation Gate

**Status:** BLOCKED for runtime wiring; design and repository evidence reviewed  
**Related:** PR #45 `feat/tenant-authorization-contract`; Core migration `20261115193000_unified_identity_tenant_foundation.sql`

## Decision

Do not enable a live tenant membership resolver in the current CRM API yet. The authorization contract in `@naeos-crm/auth` is ready to accept a trusted resolver, but the running CRM authentication and deployment configuration do not currently provide the inputs or credentials required to call the Core identity schema safely.

This is a deliberate fail-closed gate, not a reason to fall back to CRM legacy roles, a Supabase service-role API key, or a privileged database login.

## Verified repository facts

1. `apps/api/src/middleware.ts` verifies a locally issued HS256 session with issuer `naeos-crm` and audience `naeos-crm-web`. It loads the local Prisma `User` row and constructs an actor with local CUID, email, and legacy roles. It does not produce a verified Supabase `(iss, sub)` principal.
2. `apps/api/src/prisma-ports.ts` creates one Prisma client from the CRM `DATABASE_URL`. The API package currently has no direct PostgreSQL `pg` dependency or separate identity connection adapter.
3. Core migration `20261115193000_unified_identity_tenant_foundation.sql` creates the private `naeos_identity` schema and NOLOGIN groups `naeos_identity_runtime` / `naeos_identity_admin`. It explicitly does not create LOGIN roles or passwords. Runtime login provisioning and membership grant are separate operator-managed steps.
4. The Core migration grants the runtime group SELECT on organizations, workspaces, memberships, role definitions, role assignments, and role capabilities. It grants only SELECT/INSERT on identity audit events. It does not grant writes to runtime.
5. Identity RLS relies on transaction-local settings `naeos.organization_id`, `naeos.workspace_id`, `naeos.issuer`, and `naeos.subject`. These values must be derived by trusted backend code only after JWT verification; a database connection capable of arbitrary SQL can set custom GUCs, so GUCs are not an independent authentication boundary.
6. The current CRM Prisma schema has no tenant ownership columns on CRM domain records. A working membership resolver alone would therefore not establish CRM record isolation.

## Required implementation sequence

### Gate A — trusted principal

- Decide and implement the CRM Supabase Auth transition or an explicitly approved identity-link exchange.
- Verify signature, algorithm, issuer, audience, expiry, not-before, and subject before constructing `CanonicalPrincipal`.
- Keep local CRM CUID as the CRM account key; use a separately verified identity link. Never derive subject from email, user metadata, client_id, or the local session subject.
- Keep local authentication compatibility until the migration and rollback plan is approved and tested.

### Gate B — runtime database connectivity

- Provision a dedicated LOGIN role that is a member of `naeos_identity_runtime`, using a secret manager and the intended staging database only.
- Confirm the role is NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOBYPASSRLS at the group level and inherits only the read-only runtime grants.
- Provide a separate identity database connection secret to the CRM API runtime. Do not reuse `DATABASE_URL`, `SUPABASE_SECRET_KEY`, `service_role`, or the identity admin credential.
- Verify network/TLS configuration, pool limits, connection rotation, and that the API deployment can reach the correct staging database.
- Use a transaction per resolver call. Begin a transaction, set all four GUCs with parameterized `set_config(..., true)`, execute only parameterized SELECT statements, then commit/rollback and release the connection. Never interpolate GUC values into SQL and never expose a generic SQL endpoint.

### Gate C — resolver and policy

- Query only the exact `issuer + subject + organization_id + workspace_id` membership tuple. Do not widen a workspace request to an organization-level membership.
- Join organization and workspace lifecycle state and assigned role/capability records; return no membership when any exact tuple is absent or inactive.
- Ensure role/capability reads are performed under the same trusted tenant context and transaction.
- Implement a capability evaluator based on the Core `role_capabilities` authority, not CRM `admin/manager/member` arrays.
- Add integration tests against an isolated staging database for active membership, wrong issuer, wrong subject, wrong organization, wrong workspace, inactive membership, inactive tenant, missing capability, RLS denial, connection failure, and transaction rollback.
- Keep the API authorization dependency fail-closed. Do not wire tenant routes until the principal and database gates pass.

### Gate D — CRM resource isolation

- Approve the CRM tenancy shape and initial organization/workspace mapping.
- Add tenant ownership to CRM roots and inherited scope to child records through additive migrations and verified backfill.
- Replace unscoped list/get/update/delete and nested queries with exact tenant-scoped operations.
- Test cross-tenant CRUD and owner/reference mismatch before enabling route enforcement.
- Production migration and cutover require explicit operator approval.

## Evidence required to unblock

- Staging JWT verification report with issuer, audience, JWKS and positive/negative test outcomes; no bearer tokens in the report.
- Staging database role membership/grant report proving runtime least privilege and RLS enforcement.
- Secret-manager variable names and deployment binding evidence (never secret values).
- Passing resolver/policy integration test run against isolated staging data.
- Approved tenant mapping and CRM ownership/backfill plan.

Until all evidence exists, the resolver remains an interface only, PR #45 remains Draft, and no Production configuration or data is changed.
