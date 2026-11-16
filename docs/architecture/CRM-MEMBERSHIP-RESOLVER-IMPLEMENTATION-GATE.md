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


## Additional runtime findings (2026-11-17)

Repository inspection confirms the deployment boundary and narrows the database-adapter choice:

- The root `Dockerfile` builds the API in `node:24.21.0-bookworm-slim`, generates the Prisma client, and starts `apps/api/dist/main.js`. This is a Node.js service, not a Cloudflare Worker runtime.
- `wrangler.jsonc` is for the CRM web Worker and proxies API traffic through `API_ORIGIN`. Its current configured production origin and preview origin are Railway API URLs. The web Worker should not own the identity database connection.
- `apps/api/src/main.ts` starts the Express API and Prisma-backed outbox worker. The current API process has one Prisma client and no identity-pool lifecycle or shutdown hook.
- `apps/api/src/app.ts` exposes `/ready` based only on the CRM Prisma database. Identity readiness must not silently become a mandatory dependency until a rollout mode and rollback behavior are explicitly designed.
- `apps/api/src/middleware.ts` still verifies only the local HS256 CRM session. The canonical Supabase principal cannot be populated from the current actor/session.

### Adapter decision

Use a separate Node-compatible PostgreSQL pool for the identity schema in the Railway-hosted API, rather than connecting from the Cloudflare web Worker or reusing the CRM Prisma connection. Keep the pool lazy and disabled when no dedicated staging identity connection is configured. The adapter must:

1. Require an explicit staging-only identity connection variable (proposed name: `NAEOS_IDENTITY_DATABASE_URL`); never fall back to `DATABASE_URL`.
2. Use TLS with certificate verification and bounded pool size/timeouts.
3. Acquire one client and run a transaction for the entire membership + capability resolution.
4. Set all tenant GUCs with parameterized `set_config(key, value, true)` calls inside that transaction; run only fixed, parameterized SELECT statements.
5. Roll back on every error and release the client in `finally`; expose no raw SQL input.
6. Close the pool during API shutdown.
7. Remain unwired to request authorization until verified Supabase JWT principal handling, staging login-role provisioning, exact schema query validation, and tenant resource ownership gates pass.

No PostgreSQL driver or connection secret has been added yet. Before selecting and pinning a driver, inspect the current package lock and test compatibility with the repository's Node 24 build. The Railway production and preview endpoints in the Worker config are evidence of routing only; they are not authorization to change Railway variables or deploy services.


### Identity-schema contract details confirmed from the Core migration

- `naeos_identity.memberships` stores the provider issuer as text and the provider subject in `user_id UUID`. The API must validate that the verified JWT `sub` is a UUID before querying; it must not map by email or coerce an arbitrary subject.
- Membership uniqueness is `(organization_id, workspace_id, issuer, user_id)` with NULLS NOT DISTINCT. Organization-level memberships (`workspace_id IS NULL`) are a distinct scope. For this CRM contract, a workspace authorization request must resolve only the exact requested workspace membership; an organization-level membership must not be silently widened into workspace access.
- Role assignment scope is enforced by a database trigger: organization roles belong to organization-level memberships, and workspace roles belong to workspace-level memberships. The resolver must preserve this distinction.
- The migration seeds only `organization_admin` and `workspace_admin`, each with `naeos.identity.audit.read`. No `crm:*` capabilities are currently seeded. Consequently, every CRM capability request must remain denied until an approved identity-administration workflow defines and assigns the required capabilities. Do not insert capabilities from the runtime connection.
- The RLS policies are context-sensitive and use the four transaction-local GUCs. The adapter must set all four before any identity SELECT, including role/capability lookup, and must keep all reads in the same transaction so pooled connections cannot leak tenant context.
