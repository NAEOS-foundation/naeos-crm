# NAEOS CRM

NAEOS CRM is an operational and reference application within the NAEOS ecosystem, built to enforce explicit authorization, durable audit, and clean domain boundaries before any AI or integration layer is added.

## Current repository status

Phase 1 (foundation) is implemented across the full stack:

- **Authentication**: JWT bearer-token middleware with OIDC-compatible config and a development mode (`AUTH_DISABLED=true`) that lets the web app sign in without an identity provider
- **RBAC**: role-based permission matrix (`admin`, `manager`, `member`) enforced server-side on every route, with denied attempts written to the audit log
- **Users, companies, contacts, leads, activities, tasks**: full CRUD with `zod` validation at the API boundary
- **Basic audit**: every consequential operation appends a durable `AuditEvent` with actor, action, entity, request id, and before/after state
- **Dashboard**: aggregated read model across all Phase 1 entities
- **Web app**: React + Vite with login, sidebar navigation, and views for every entity plus the audit log

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
| Dashboard       | `GET /dashboard`                                 |
| Audit           | `GET /audit`                                     |

## Roadmap

See `docs/CRM-ROADMAP.md` for the phased plan. Phase 1 is delivered; Phases 2–6 (pipeline/campaigns, ecosystem, governance, AI, integrations) remain intentionally deferred.