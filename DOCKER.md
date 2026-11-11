# Docker

Copy `.env.example` to `.env`, then set strong values for `AUTH_SECRET` and
`AUTH_BOOTSTRAP_PASSWORD`. Build and start PostgreSQL, Redis, run database
migrations, and start the API:

```sh
docker compose build api
docker compose up -d
```

The API listens on `http://localhost:3000`. For the optional Intelligence
integration, Compose uses `INTELLIGENCE_DOCKER_API_URL` (default
`http://host.docker.internal:8080`) to reach the Intelligence service published
on the host. The `api` container starts only after PostgreSQL is healthy and
the migration job succeeds. PostgreSQL and
Redis use host ports `5434` and `6380` by default, avoiding clashes with the
Intelligence stack; override them with `CRM_POSTGRES_PORT` and `CRM_REDIS_PORT`.
