# CRM Tenant Data Ownership and Isolation Map

**Status:** Proposed for implementation review  
**Basis:** Current Prisma model inventory on `main`; this is a design map, not evidence of implemented tenant isolation.

## Core rule

Every tenant-owned CRM record must be bound to one canonical `organization_id` and, where the customer has multiple workspaces, one `workspace_id`. The owner scope must be resolved from an active membership for the verified `(iss, sub)` principal. Client-supplied tenant IDs are selectors only; server authorization must validate them.

For child records, ownership must be inherited from the parent and enforced by scoped query predicates plus database constraints. Do not trust only a route-level check before an unscoped query.

## Model classification

| Prisma model | Proposed ownership | Scope propagation / notes |
|---|---|---|
| User | Identity/account-level; many-to-many tenant membership | Existing CUID and provider UUID link remain. Legacy `roles[]` are not tenant authorization. |
| Company | Tenant-owned root | Add org/workspace scope; owner user must be an active member of same scope. |
| Partner | Tenant-owned root | Same as Company; partner records should not be globally visible by default. |
| Community | Tenant-owned root | Existing global unique name must become scoped uniqueness if tenant-local naming is intended. |
| Investor | Tenant-owned root | Scope read/write and ownership assignment. |
| Campaign | Tenant-owned root | CampaignStep inherits scope from Campaign. |
| PipelineStage | Currently appears platform/global catalog | Preserve as shared catalog only if that is the product decision; tenant-custom pipeline requires organization/workspace scope and scoped uniqueness. |
| PolicyRule | Platform or tenant-scoped policy catalog | Must add explicit scope kind and tenant IDs; never treat legacy role strings as tenant capability grants. |
| PolicyDecision | Audit/policy event with tenant context | Record tenant scope at decision time; maintain policy version and decision evidence. |
| GoGateRequest | Tenant-owned consequential workflow | Bind organization/workspace and requester/approver membership; validate target and execution authorization within scope. |
| EvidenceReceipt | Child of GoGateRequest | Tenant context inherited and consistent with request. |
| OutboxEvent | Tenant context inherited from aggregate | Include tenant context in event envelope; workers must enforce tenant-bound handlers and idempotency. |
| AuditEvent | Append-only tenant-aware audit record | Store canonical issuer/subject and organization/workspace where applicable; avoid only legacy CRM actor ID. |
| Contact | Child of Company | Inherit scope from Company; composite relation or server-side validation prevents cross-tenant company links. |
| Lead | Child of Company | Inherit scope; owner must be a same-tenant member. |
| Opportunity | Child of Company | Inherit scope; owner and related UseCase records same tenant. |
| Activity | Optional child of Company and/or Contact | Validate both references resolve to the same tenant; nullable company/contact requires explicit actor scope. |
| Task | Optional child of Company | Tenant scope must not disappear when companyId is null; explicit scope fields needed. |
| FollowUp | Child of Activity | Inherit scope from Activity; owner must be tenant member. |
| Contributor | Tenant-owned or Community child | If communityId exists, scope must match Community; otherwise explicit scope required. |
| CampaignStep | Child of Campaign | Inherit Campaign scope; constrain nested routes by tenant. |
| UseCase | Child of Opportunity | Inherit Opportunity scope; owner must be tenant member. |

## Candidate database invariants

- Tenant root rows have non-null organization/workspace IDs and a unique composite key `(organization_id, workspace_id, id)`.
- Child rows have composite foreign keys to parent `(organization_id, workspace_id, parent_id)` wherever feasible; ordinary single-column foreign keys do not prove tenant consistency.
- Nullable parent references (Activity, Task, Contributor) must not permit null scope. Scope remains explicit on the child even when parent link is absent.
- User/owner relations are validated against membership scope through a trusted service or membership FK model. A CRM User ID alone does not establish tenant membership.
- Tenant-local unique keys (e.g. Community name, policy keys) must be reviewed and converted from global uniqueness deliberately.
- All list/get/update/delete queries filter by authenticated organization/workspace; nested routes verify parent ownership.
- RLS policies, if CRM database direct access is enabled, use verified trusted claims or a secure backend role/function. Do not expose service-role bypass to browser clients.
- Audit/outbox and consequential workflow tables receive stricter grants, immutability and worker authorization than ordinary CRUD.

## Backfill and rollout

1. Inventory Production records, ownership references, uniqueness constraints, and existing role semantics using read-only queries.
2. Decide whether current CRM is one internal NAEOS organization, a customer-facing multi-tenant CRM, or both with separate tenant boundaries. This is a product/ownership decision; do not infer it from current row contents.
3. Choose and approve the initial organization/workspace IDs and map users to memberships using verified identity/admin evidence.
4. Add nullable scope columns and composite keys in an additive migration; preserve existing indexes and CUID relations.
5. Backfill in staging with explicit mapping; report orphan and conflicting rows, and fail rather than guess.
6. Make tenant columns non-null only after all rows and references pass verification.
7. Introduce tenant-filtered repository methods and route-level scope checks; test every CRUD path and nested relation.
8. Enforce composite foreign keys and RLS/grants after application queries are tenant-aware.
9. Validate two-tenant isolation, role/capability boundaries, audit, background workers, and restore/rollback.
10. Production execution remains gated by explicit operator approval.

## Deferred decisions / blockers

- CRM product tenancy shape and initial tenant mapping have not been approved.
- Membership authority source and secure database runtime connectivity for the proposed `naeos_identity` schema are not yet implemented.
- PipelineStage and PolicyRule global-vs-tenant semantics need product-owner review.
- Existing role arrays and platform-admin semantics require migration design, not mechanical conversion.
- No tenant ownership columns, backfill, RLS policies, or Production changes are made by this document.
