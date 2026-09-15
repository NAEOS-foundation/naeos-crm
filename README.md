# NAEOS CRM

NAEOS CRM is an operational and reference application within the NAEOS ecosystem, built to enforce explicit authorization, durable audit, and clean domain boundaries before any AI or integration layer is added.

## Current repository status

Phase 1 (foundation), Phase 2 (pipeline and campaigns), Phase 3 (ecosystem), and Phase 4 (governance) are implemented across the full stack:

- **Authentication**: JWT bearer-token middleware with OIDC-compatible config and a development mode (`AUTH_DISABLED=true`) that lets the web app sign in without an identity provider
- **RBAC**: role-based permission matrix (`admin`, `manager`, `member`) enforced server-side on every route, with denied attempts written to the audit log
- **Users, companies, contacts, leads, activities, tasks**: full CRUD with `zod` validation at the API boundary
- **Pipeline (Phase 2)**: configurable pipeline stages plus opportunities with stage, amount, and close date; weighted-value analytics computed from stage probability
- **Campaigns (Phase 2)**: campaigns with ordered sequence steps (email/call/task/wait) and follow-ups attached to activities
- **Analytics (Phase 2)**: pipeline, campaign, and follow-up analytics endpoints
- **Basic audit**: every consequential operation appends a durable `AuditEvent` with actor, action, entity, request id, and before/after state — including `opportunity.stage-changed`
- **Ecosystem (Phase 3)**: contributors, partners, communities, investors, and NAEOS use cases with RBAC, audit, seed data, and web pages
- **Governance (Phase 4)**: versioned policy rules (`/api/v1/policy/rules`) with wildcard/priority evaluation and a GO-Gate (`/api/v1/go-gate`) that gates consequential external actions behind request → approve (15-min window) → execute → verify, with simulated email/GitHub adapters, policy-aware `requireAuth`, and `go-gate.*`/`policy-rule.*` audit events
- **Dashboard**: aggregated read model across all entities
- **Web app**: React + Vite with login, sidebar navigation, and views for every entity, the pipeline/campaigns/follow-ups/analytics screens built in Phase 2, the GO-Gate and Policy screens built in Phase 4, plus the audit log

## Structure

```text
.
├── apps/
│   ├── api/       # Express REST API (auth, RBAC, CRUD, dashboard, audit)
│   └── web/       # React + Vite operational UI
├── packages/
│   ├── audit/     # AuditService + audit event types
│   ├── auth/      # AuthorizationService + RBAC matrix
│   ├── domain/    # Domain types and repository ports
│   └── shared/    # Shared types and response helpers
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
├── .github/workflows/
├── docker-compose.yml
└── package.json
```

## Local development

```bash
npm install
docker-compose up -d postgres   # start PostgreSQL
cp .env.example .env
npx prisma migrate dev          # create/apply the schema
npx prisma db seed              # seed dev data
npm run dev:api                 # API on :3000
npm run dev:web                 # web app on :5173
```

The web app signs in through the development login screen, which offers role-based (admin/manager/member) sign-in. Point `VITE_API_URL` (default `http://localhost:3000`) at the API.

## Testing

```bash
npm test          # unit + integration tests across all workspaces
npm run build     # typecheck and build all workspaces
```

## API overview

All routes live under `/api/v1` and require authentication. RBAC is enforced per route; `admin` gets full access, `manager` gets operational write access, `member` gets read plus self-scoped operations on relationship data.

| Resource        | Endpoints                                        |
| --------------- | ------------------------------------------------ |
| Users           | `GET/POST/PUT/DELETE /users`                     |
| Companies       | `GET/POST/PUT/DELETE /companies`                 |
| Contacts        | `GET/POST/PUT/DELETE /contacts`                  |
| Leads           | `GET/POST/PUT/DELETE /leads`                     |
| Activities      | `GET/POST/PUT/DELETE /activities`                |
| Tasks           | `GET/POST/PUT/DELETE /tasks`                     |
| Pipeline        | `GET/POST/PUT/DELETE /pipeline-stages` + `POST /pipeline-stages/reorder` |
| Opportunities   | `GET/POST/PUT/DELETE /opportunities`             |
| Campaigns       | `GET/POST/PUT/DELETE /campaigns`                 |
| Campaign steps  | `GET/POST /campaigns/:id/steps`, `GET/PUT/DELETE /campaign-steps/:id` |
| Follow-ups      | `GET/POST/PUT/DELETE /follow-ups`                |
| Contributors    | `GET/POST/PUT/DELETE /contributors`              |
| Partners        | `GET/POST/PUT/DELETE /partners`                  |
| Communities     | `GET/POST/PUT/DELETE /communities`               |
| Investors       | `GET/POST/PUT/DELETE /investors`                 |
| Use cases       | `GET/POST/PUT/DELETE /use-cases`                 |
| Policy rules    | `GET/POST/PUT/DELETE /policy/rules`              |
| GO-Gate         | `GET/POST /go-gate`, `POST /go-gate/:id/approve`, `POST /go-gate/:id/reject`, `POST /go-gate/:id/execute` |
| Analytics       | `GET /analytics/pipeline`, `GET /analytics/campaigns`, `GET /analytics/follow-ups` |
| Dashboard       | `GET /dashboard`                                 |
| Audit           | `GET /audit`                                     |

## Roadmap

See `docs/CRM-ROADMAP.md` for the phased plan. Phases 1–4 are delivered; Phases 5–6 (AI, integrations) remain intentionally deferred. Modeling decisions are recorded in `docs/adr/ADR-006-campaign-modeling.md`, `docs/adr/ADR-007-ecosystem-use-cases.md`, and `docs/adr/ADR-008-go-gate-policy-rules.md` (with the Phase 4 integration boundary in `docs/adr/ADR-005-policy-integration-boundary.md`).