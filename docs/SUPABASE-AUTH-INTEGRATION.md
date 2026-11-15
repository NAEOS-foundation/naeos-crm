# CRM Supabase Auth integration

## Scope and compatibility

The CRM API supports Supabase Auth as an optional external identity provider for existing CRM users. Existing local email/password authentication and CRM-issued HS256 session cookies remain available. The provider integration does not replace CRM User IDs, CRM role assignments, or authorization checks.

A Supabase identity is linked to an existing CRM account only after proof of both identities. Matching email addresses alone do not create a link.

## API server configuration

Set these variables in the trusted CRM API runtime environment:

- `SUPABASE_URL`: project URL for the selected hosted Supabase Auth provider; HTTPS is required.
- `SUPABASE_PUBLISHABLE_KEY`: publishable API key for that project. The implementation also accepts `SUPABASE_ANON_KEY` as a compatibility fallback.

The API validates a supplied access token by calling the provider's `/auth/v1/user` endpoint with the publishable/anon key and bearer token. Requests use a five-second timeout and do not follow redirects.

Do not configure a Supabase service-role/secret key for these routes. Do not put any server key into the browser bundle, commit keys, or log bearer tokens.

## Existing-account linking

Endpoint: `POST /api/v1/auth/link-supabase`

Headers:

- `Authorization: Bearer <Supabase Auth access token>`
- `Content-Type: application/json`

JSON body:

- `email`: existing CRM account email
- `password`: existing CRM account password (15–128 characters)

Link succeeds only when:
1. Supabase Auth accepts the bearer token and returns a valid user UUID/email.
2. CRM validates the existing email/password credentials and the account is active.
3. Provider and CRM email values match case-insensitively.
4. The CRM identity-link field is currently null or already linked to that same provider UUID.

The identity link is stored in `User.supabaseAuthUserId` using a conditional update and a unique index. A conflicting identity link is rejected. On successful linking, the API issues its existing CRM session cookie.

## Login with a linked Supabase identity

Endpoint: `POST /api/v1/auth/supabase`

Headers:

- `Authorization: Bearer <Supabase Auth access token>`

No JSON body is required. The API requires an explicit UUID mapping to an active CRM User and a matching email. It then issues the existing CRM session cookie. Invalid or unlinked identities receive a generic 401 response.

## Rollout requirements

- Apply the additive Prisma migration in isolated staging first.
- Provision provider URL and publishable/anon key only in the API server environment.
- Validate link/login, inactive-account denial, conflict behavior, local-login compatibility, audit records, and rate limiting.
- Do not activate Production environment variables or apply the Production migration until the staging verification, backup/rollback rehearsal, and explicit operator approval are complete.
