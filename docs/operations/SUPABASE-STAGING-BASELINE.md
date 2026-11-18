# Supabase Staging Baseline and Operations

## Scope and safety

This runbook covers the NAEOS CRM staging database only.

| Item | Value |
|---|---|
| Supabase project | `naeos.db` |
| Project ref | `kqmhpsftijskesjdovjm` |
| Region | `ap-northeast-1` |
| PostgreSQL | 17.6 |
| Target environment | Staging |
| Deployment | Not authorized |
| Production | Explicitly out of scope |

Never put database URLs, passwords, Supabase secret keys, JWT signing material, or access tokens in this document, source control, issue comments, or logs.

## Baseline observations (2026-11-18)

- Supabase project status: `ACTIVE_HEALTHY`.
- Migration history: 19 entries.
- Schemas present: `public`, `naeos_identity`, `naeos_control_plane`.
- CRM tables: 22 in `public`; all inspected tables have RLS enabled.
- CRM `public` policies: zero.
- Inspected table grants: `anon` and `authenticated` have no direct CRM table grants; `service_role` has broad CRUD and related privileges across the 22 CRM tables.
- Shared identity and control-plane schemas use dedicated database roles and scoped RLS policies.
- Row counts: one Auth user; zero CRM users; zero CRM companies; one organization; one workspace; two memberships.

Interpretation: the current design is backend-only for CRM domain data. Do not expose the service-role key or grant browser clients direct table access. The absence of public CRM policies is not evidence of a completed tenant RLS model.

## Migration provenance blocker

The live staging migration history contains these CRM-labelled entries:

```text
20261117154240 crm_init_phase1
20261117154244 crm_add_activity_contact_relation
20261117154247 crm_phase2_pipeline_campaigns
20261117154251 crm_phase3_ecosystem_use_cases
20261117154255 crm_phase4_go_gate_policy
20261117154258 crm_policy_rule_role_string
20261117154301 crm_go_gate_actor_scalars
20261117154304 crm_go_gate_execution_identity
20261117154308 crm_user_password_hash
20261117154311 crm_evidence_v1_audit_chain
20261117154321 crm_evidence_receipt_v1
20261117154325 crm_outbox_v1
20261117154329 crm_user_session_version
20261117154332 crm_supabase_auth_identity_link
20261117154354 crm_public_rls_service_only_hardening
```

The current `naeos-crm/main` tree has fourteen Prisma migration directories with different directory timestamps; the final service-only hardening entry has no matching directory on the inspected main branch. The live migration history therefore cannot yet be reproduced solely from the current checked-in migration tree.

Required reconciliation:

1. Retrieve the exact SQL artifacts used to apply the 15 CRM migrations to staging.
2. Determine which repository/branch/commit is the canonical source for each artifact.
3. Compare every artifact with the live catalog and Prisma schema.
4. Restore missing artifacts to the canonical repository with original SQL preserved; do not synthesize migration contents from the live catalog.
5. Establish a repeatable migration process and prove it against a disposable database before any further staging DDL.

Do not use `prisma migrate reset`, `db push`, destructive DDL, or migration-history edits to make the discrepancy disappear.

## Connection contract (future implementation)

- Runtime application connections use a least-privilege, server-side database credential.
- A pooler may be used for long-lived or high-concurrency application traffic when the selected Prisma/PostgreSQL mode is verified.
- Schema migrations use a direct connection where required by the migration engine.
- Do not add a required Prisma `directUrl` until local development, CI, and all affected non-production workflows provide it. The existing production migration workflow must not be silently broken.
- Keep credentials in the deployment platform's secret manager. This phase does not create or update secrets.

## Authentication and authorization contract (future implementation)

- Supabase Auth is the intended identity provider.
- Verify JWT signature and claims (issuer, audience, expiry, not-before, subject, and allowed algorithm) using trusted JWKS configuration.
- Treat the Supabase user UUID as an external principal identifier; preserve CRM's existing CUID primary keys until a separately reviewed migration says otherwise.
- Link identities only through a verified ownership-proof flow.
- Keep CRM RBAC and NAEOS tenant membership/role assignment semantics explicit; do not infer authorization from email or client-supplied metadata.
- Fail closed on unknown `kid`, invalid signatures, stale/revoked identities, unavailable required verification, and ambiguous tenant membership.
- Do not enable direct client access to CRM tables until tenant-scoped RLS policies and cross-tenant denial tests pass.

## Staging verification checklist

- [ ] Canonical migration source inventory complete.
- [ ] Migration history reconciled against repository and catalog.
- [ ] Prisma schema drift reviewed.
- [ ] Disposable database migration rehearsal passes.
- [ ] Staging connection test succeeds without exposing credentials.
- [ ] JWT/JWKS positive and negative tests pass.
- [ ] Account-linking and revocation tests pass.
- [ ] Cross-tenant access tests prove denial.
- [ ] Backup and rollback plan documented before any data migration.
- [ ] Production remains unchanged.

## Operational prohibitions

This runbook does not authorize deployment, production configuration changes, secret modification, signing-key rotation/deactivation, data deletion, or migration-history repair.
