# NAEOS CRM

NAEOS CRM is an operational and reference application within the NAEOS ecosystem.

## Current repository status

This repository currently contains:

- architecture and governance documentation under `docs/`
- ADRs under `docs/adr/`
- a Phase 1-ready monorepo scaffold
- a React web app
- an Express API app
- PostgreSQL Prisma schema
- a Docker Compose setup for local dependencies

## Structure

```text
.
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── audit/
│   ├── auth/
│   ├── domain/
│   └── shared/
├── prisma/
├── docs/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── tsconfig.base.json
└── README.md
```

## Phase 1 foundation scope

This repository is intentionally set up as a safe foundation for Phase 1:

- authentication boundaries
- RBAC foundation
- user and company domain placeholders
- audit model placeholders
- API and web app skeletons
- Prisma schema for core entities

No business feature logic is implemented yet.

## Local development

```bash
npm install
npm run build --workspaces --if-present
```

## Next recommended step

Proceed with Phase 1 implementation in the following order:

1. auth and RBAC contracts
2. users and company-domain services
3. contacts, leads, activities, and tasks
4. dashboard read models
5. audit event emission and verification tests
