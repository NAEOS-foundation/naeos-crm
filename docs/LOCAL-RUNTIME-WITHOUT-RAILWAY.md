# Local CRM runtime (Railway-independent)

This setup runs the CRM API and its development PostgreSQL database locally. It does not deploy anything and does not connect to the NAEOS Production project.

## Prerequisites

- Docker Desktop with Docker Compose
- Node.js 24.x and npm 11.x (for the Vite web app)
- A local copy of this repository on branch `chore/local-runtime-without-railway`

## First-time setup

1. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set a unique local `AUTH_SECRET` (at least 32 random characters), plus a local bootstrap admin email and password. Do not commit `.env`.
3. Start the local database and API:

   ```bash
   docker compose up -d postgres
   docker compose build api
   docker compose up -d api
   ```

4. Apply the checked-in CRM Prisma migrations to the local database:

   ```bash
   docker compose exec api npx prisma migrate deploy
   ```

5. Check API liveness and readiness:

   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/ready
   ```

6. Start the web app in a second terminal:

   ```bash
   npm ci
   npm run dev:web
   ```

   Open http://localhost:5173. Vite proxies same-origin `/api` requests to the local API at http://localhost:3000. With no `VITE_SUPABASE_*` variables set, the login page uses the local CRM bootstrap account; when Supabase frontend configuration is present, the existing Supabase Auth flow remains active.

## Safety boundaries

- Compose intentionally points Prisma at its local `postgres` container, not Supabase. This is the default development path and cannot write to NAEOS staging or Production.
- The API's outbox worker is disabled in Compose to prevent background processing during local development.
- Do not replace the local `DATABASE_URL` with a Supabase URL unless you deliberately intend to test against shared staging and have reviewed the test's write impact.
- Do not use a Supabase service-role/secret key in the browser or this local API setup. The Supabase Auth bridge requires only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or the documented anon-key compatibility variable) when that integration is being tested.
- Never put real credentials in `.env.example`, source control, issue comments, or logs.
- This local setup does not restore public hosting for `crm.naeos.dev`. A separate hosting decision is required for public pilot access.

## Stop and clean up

Stop containers without deleting local database data:

```bash
docker compose down
```

To remove the local database volume and all local development data (destructive):

```bash
docker compose down -v
```
