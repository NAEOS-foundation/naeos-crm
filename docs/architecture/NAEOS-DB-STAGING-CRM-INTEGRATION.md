# NAEOS CRM — Supabase Staging Target

**Environment:** Staging only  
**Supabase project:** `naeos.db`  
**Project ref:** `kqmhpsftijskesjdovjm`  
**Region:** `ap-northeast-1`  
**PostgreSQL:** 17  
**Status checked:** 2026-11-17

## Environment selection

The project `naeos.db` is the designated staging database for CRM identity and tenant-authorization integration. The separately named `naeos-crm-production` project is not the target of this work. No Production project, credentials, schema, or data are to be changed as part of this staging task.

## Verified state

- Supabase project status: `ACTIVE_HEALTHY`.
- Migration `20261115193000_unified_identity_tenant_foundation` is present in migration history.
- Private schema `naeos_identity` exists, with RLS enabled on its identity tables.
- Runtime group `naeos_identity_runtime` exists and is `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, and `NOBYPASSRLS`.
- Admin group `naeos_identity_admin` exists and is also `NOLOGIN`; the built-in `postgres` role is a member of both groups.
- No dedicated CRM runtime LOGIN role exists yet.
- Current staging data counts: organizations 0; workspaces 0; memberships 0; role definitions 2; role assignments 0; role capabilities 2; audit events 0.
- Existing role definitions are `organization_admin` and `workspace_admin`; both currently carry only `naeos.identity.audit.read`.
- No staging tenant or membership fixture has been created by this integration task.
- No live CRM connection or JWT verification has been performed against this project.

## Next safe staging steps

1. Confirm the intended Supabase Auth issuer and audience using the project's Auth configuration and a non-secret staging JWT verification report. Do not put bearer tokens or secret keys in repository files or chat.
2. Provision a dedicated LOGIN role as a member of `naeos_identity_runtime` using an approved secret-delivery path. Do not use the `postgres`, `service_role`, or `naeos_identity_admin` credentials in the CRM runtime.
3. Bind the dedicated staging database credential to the CRM staging deployment's secret manager. Do not store credentials in GitHub, migrations, logs, or this document.
4. Create clearly marked synthetic organization/workspace/membership fixtures only after the staging issuer and test subject are known. Never invent a production identity or seed real customer records.
5. Run positive and negative resolver/RLS integration tests with the dedicated runtime login, including wrong issuer, subject, organization, workspace, inactive membership, inactive tenant, missing capability, and connection failure.
6. Keep CRM route enforcement disabled until JWT verification, least-privilege connection, resolver tests, and resource ownership migrations all pass.

## Security boundary

The Supabase MCP database connection is an operator inspection channel, not the CRM application's runtime connection. Successful SQL execution through the MCP does not prove that CRM can connect using the least-privilege runtime role. The CRM runtime must use its own dedicated credential and independently pass the staging tests.
