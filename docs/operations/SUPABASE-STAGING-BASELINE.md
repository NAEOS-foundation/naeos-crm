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

## Migration provenance reconciliation

The 19 live history entries divide into four shared NAEOS migrations and 15 CRM-labelled entries. The shared identity foundation has a canonical source: `NAEOS-foundation/naeos/supabase/migrations/20261115193000_unified_identity_tenant_foundation.sql`, introduced in the Core repository and referenced by CRM PR #45. Its version and name match the staging history entry `20261115193000 unified_identity_tenant_foundation`.

For 14 of the 15 CRM entries, the corresponding checked-in Prisma SQL artifact and introducing PR have now been located. The staging version/name differs from the repository migration directory version/name; this is a provenance/name mismatch, not proof that the SQL content differs.

| Staging history entry | Candidate canonical Prisma migration | Source PR |
|---|---|---:|
| `crm_init_phase1` | `20260914085416_init_phase1` | [#1](https://github.com/NAEOS-foundation/naeos-crm/pull/1) |
| `crm_add_activity_contact_relation` | `20260914095456_add_activity_contact_relation` | [#1](https://github.com/NAEOS-foundation/naeos-crm/pull/1) |
| `crm_phase2_pipeline_campaigns` | `20260914174045_phase2_pipeline_campaigns` | [#3](https://github.com/NAEOS-foundation/naeos-crm/pull/3) |
| `crm_phase3_ecosystem_use_cases` | `20260914191445_phase3_ecosystem_use_cases` | [#5](https://github.com/NAEOS-foundation/naeos-crm/pull/5) |
| `crm_phase4_go_gate_policy` | `20260915033058_phase4_go_gate_policy` | [#5](https://github.com/NAEOS-foundation/naeos-crm/pull/5) |
| `crm_policy_rule_role_string` | `20260915040557_policy_rule_role_string` | [#5](https://github.com/NAEOS-foundation/naeos-crm/pull/5) |
| `crm_go_gate_actor_scalars` | `20260915042807_go_gate_actor_scalars` | [#5](https://github.com/NAEOS-foundation/naeos-crm/pull/5) |
| `crm_go_gate_execution_identity` | `20260926210000_go_gate_execution_identity` | [#15](https://github.com/NAEOS-foundation/naeos-crm/pull/15) |
| `crm_user_password_hash` | `20260927010000_user_password_hash` | [#18](https://github.com/NAEOS-foundation/naeos-crm/pull/18) |
| `crm_evidence_v1_audit_chain` | `20261005090000_evidence_v1_audit_chain` | [#23](https://github.com/NAEOS-foundation/naeos-crm/pull/23) |
| `crm_evidence_receipt_v1` | `20261005140000_evidence_receipt_v1` | [#24](https://github.com/NAEOS-foundation/naeos-crm/pull/24) |
| `crm_outbox_v1` | `20261005160000_outbox_v1` | [#26](https://github.com/NAEOS-foundation/naeos-crm/pull/26) |
| `crm_user_session_version` | `20261114190000_user_session_version` | [#43](https://github.com/NAEOS-foundation/naeos-crm/pull/43) |
| `crm_supabase_auth_identity_link` | `20261115190000_supabase_auth_identity_link` | [#44](https://github.com/NAEOS-foundation/naeos-crm/pull/44) |
| `crm_public_rls_service_only_hardening` | **No canonical SQL artifact located** | — |

The CRM migration SQL files above are source candidates recovered from repository history; the live `schema_migrations` table records names and versions, not SQL checksums. Therefore this mapping does not yet prove byte-for-byte identity between the SQL applied to staging and the checked-in artifacts. The service-only hardening migration remains unproven and must not be reconstructed from assumptions.

### Required reconciliation gates

1. Obtain the original SQL or immutable execution artifact for `crm_public_rls_service_only_hardening`; inspect its origin, commit, and exact statements.
2. Compare the 14 candidate SQL artifacts with the live catalog effects (columns, types, constraints, indexes, triggers, functions, grants, and RLS state). Record any intentional drift.
3. Confirm the exact migration runner that generated the staging timestamps/names and determine whether the history table was populated by Supabase migration tooling or another controlled process.
4. Preserve original SQL and provenance in the canonical repository; do not rename or rewrite already-applied history rows merely to make names align.
5. Validate the resulting migration sequence against a disposable PostgreSQL/Supabase-compatible database before any additional staging DDL.

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
