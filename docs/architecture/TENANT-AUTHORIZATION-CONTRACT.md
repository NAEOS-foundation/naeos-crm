# NAEOS Tenant Authorization Contract

**Status:** Proposed contract; adapter implementation and tenant cutover remain staged  
**Version:** 1.0-draft  
**Scope:** CRM, Core/Control Plane, and Intelligence service boundaries

## Canonical identity

A human principal is identified by the exact pair:

- `issuer`: verified JWT issuer URL (`iss`)
- `subject`: verified JWT subject (`sub`)

The CRM's legacy CUID remains its local account key. The Supabase Auth user UUID is an external identity link and does not replace the CRM primary key. JWT `client_id` identifies a client and must not be substituted for a human subject.

## Tenant scope

Every tenant-scoped request names exactly:

- `organization_id`: canonical organization UUID
- `workspace_id`: canonical workspace UUID

Membership is resolved server-side using the issuer-qualified principal and exact organization/workspace scope. Cross-service resource identifiers do not grant permission by themselves.

## Authorization sequence

1. Validate bearer-token signature, allowlisted algorithm, issuer, audience, expiration, not-before, and subject using trusted key material.
2. Normalize the canonical principal as `(iss, sub)`; do not derive authorization from `user_metadata`, generic `authenticated` role, email match, or CRM legacy role alone.
3. Validate organization/workspace UUIDs and request capability.
4. Resolve an active membership for that exact principal and scope from a trusted server-side membership source.
5. Verify membership's principal, organization, and workspace match the requested values exactly; do not silently widen a workspace request to an organization-level membership.
6. Verify both the organization and requested workspace lifecycle states are `active`; `pending` and `suspended` tenants are denied even if a membership row remains active.
7. Evaluate a server-controlled capability policy against membership role keys and policy context.
8. Deny by default for missing membership, inactive membership or tenant, mismatch, insufficient capability, malformed scope, or unavailable authorization dependency.
9. Emit a domain-owned audit event with actor issuer/subject, organization/workspace, capability/action, resource, request/correlation ID, outcome, reason, timestamp, and schema version. Do not log bearer tokens.

## CRM TypeScript contract

Package `@naeos-crm/auth` defines `CanonicalPrincipal`, `TenantScope`, `ResolvedTenantMembership`, `TenantLifecycleStatus`, `TenantMembershipResolver`, `TenantPolicyEvaluator`, and `authorizeTenantRequest`. The resolved membership must carry organization and workspace lifecycle states; the orchestration denies unless both are `active`.

The function is a fail-closed policy orchestration boundary. It does not yet connect to the Supabase private identity schema, and its interfaces do not authorize requests unless a trusted resolver and policy evaluator are supplied. The proposed Core identity schema stores role-to-capability grants in `role_capabilities`; the membership-resolution connection should use the dedicated read-only `naeos_identity_runtime_login` group. Identity lifecycle writes require the separately credentialed `naeos_identity_admin_login` group. Audit events remain append-only. Existing CRM `admin/manager/member` roles remain legacy application roles; they are not globally tenant-scoped permissions.

## Scope rules

- Membership tenant/principal scope is immutable in the proposed identity schema; changes require reviewed workflows.
- Organization-level and workspace-level role scopes are distinct.
- Organization/workspace relationship is enforced by database composite constraints or an equivalent trusted check.
- Tenant ID is never accepted from user-editable profile metadata.
- A request without explicit tenant scope must only use a separately defined platform-scoped route and platform policy; it must not silently fall back to a default tenant.

## Runtime integration gates

Before this contract is wired into production routes:

- Implement and test a trusted membership resolver, with clearly identified database/runtime credentials and least-privilege grants.
- Resolve the migration role issue: the private schema's proposed NOLOGIN runtime role needs an explicit secure execution path from the deployed service; schema/table grants alone do not make it usable.
- Add organization/workspace ownership columns and exact scoping to CRM domain records; audit route/facade queries for tenant filters.
- Add negative tests for cross-tenant list/get/create/update/delete and privileged actions.
- Implement corresponding membership/capability checks in Core and Intelligence, including resource owner checks.
- Run staging integration tests with separate tenants and role variants, backup/restore, rollback rehearsal, and security review.
- Do not use a JWT custom-claim hook as the only authorization source unless membership revocation propagation and claim freshness are proven.
- Production cutover requires explicit operator approval.

## Error behavior

Externally, avoid tenant enumeration. Missing, mismatched, inactive membership and unauthorized capability should generally return a consistent `403 Forbidden` (or `404 Not Found` where resource concealment is required). Authentication failures remain `401 Unauthorized`; authorization dependency outage should be fail-closed and return service-unavailable behavior rather than granting access.

## Compatibility and migration

Existing local CRM sessions and roles remain supported during the compatibility period. No production data backfill, tenant default selection, or tenant-scoped migration is performed by this contract. Existing CRM records must not be assigned to a guessed organization. The initial tenant/backfill decision requires confirmed ownership and tested access semantics.
