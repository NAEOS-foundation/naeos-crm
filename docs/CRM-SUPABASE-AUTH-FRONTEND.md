# CRM browser sign-in through Supabase Auth

## Browser configuration

The CRM web build requires these public configuration variables:

- `VITE_SUPABASE_URL`: HTTPS URL of the canonical Supabase Auth project.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key for that project. `VITE_SUPABASE_ANON_KEY` is accepted as a compatibility fallback.

Only a publishable/anon key belongs in browser configuration. Never expose a Supabase secret/service-role key through a `VITE_*` variable.

The API runtime separately requires `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as documented in `SUPABASE-AUTH-INTEGRATION.md`. Both browser and API must point to the same canonical Auth project.

## Sign-in sequence

1. The browser submits email/password to Supabase Auth's password-grant endpoint over HTTPS.
2. The browser keeps the returned access token in memory only; it does not persist provider tokens in localStorage or sessionStorage.
3. The browser exchanges the access token with `POST /api/v1/auth/supabase`.
4. The API validates the token with the configured Supabase Auth `/auth/v1/user` endpoint and requires an explicit `User.supabaseAuthUserId` mapping to an active CRM user.
5. If the verified identity is not yet linked, the browser may attempt the explicit account-link flow. The API requires the existing CRM email/password and verifies both identities; matching email alone is insufficient.
6. After successful exchange/link, the API issues its existing HttpOnly, Secure, SameSite=Strict CRM session cookie. The current actor is restored through `GET /api/v1/me`.

Logout revokes the CRM session. If the current page still holds the provider access token in memory, it also requests Supabase sign-out.

## Important rollout limitation

This is a compatibility bridge, not yet a direct Supabase-JWT-per-request architecture. API business routes still authenticate the CRM-issued session cookie and still use legacy CRM roles. Tenant membership authorization and resource-level tenant isolation are separate, blocked rollout gates.

The additive Prisma migrations `20261114190000_user_session_version` and `20261115190000_supabase_auth_identity_link` must be applied to the selected database before the corresponding API code can run safely. Apply and verify them in staging first. Do not apply them to Production or change Production secrets/deployments without explicit operator approval.
