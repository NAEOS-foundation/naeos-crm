# CRM to Control Plane BFF integration

Status: implementation proposal; not enabled in any environment.

This integration keeps the browser on the CRM origin. The CRM API authenticates the existing CRM session, authorizes the dedicated `control-plane:read` permission, and creates a 60-second RS256 or ES256 assertion for the Control Plane. The browser never receives the signing key or service assertion.

## Trust contract

The CRM API publishes only the derived public key at:

`https://<crm-api-origin>/.well-known/jwks.json`

The Control Plane validates the assertion using its configured issuer, audience, and JWKS URL. These values must match exactly:

| CRM API setting | Control Plane setting |
| --- | --- |
| `CONTROLPLANE_BFF_ISSUER` | `NAEOS_CONTROLPLANE_ISSUER` |
| `CONTROLPLANE_BFF_AUDIENCE` | `NAEOS_CONTROLPLANE_AUDIENCE` |
| Public JWKS endpoint derived from issuer origin | `NAEOS_CONTROLPLANE_JWKS_URL` |

The issuer must be the HTTPS origin serving the CRM API and its JWKS route. Do not use the browser's CRM session issuer or the Supabase user-token issuer.

## CRM API environment

Configure these values only in the private environment of the CRM API service:

- `CONTROLPLANE_BFF_ISSUER`: exact HTTPS origin, with no path, query, or fragment.
- `CONTROLPLANE_BFF_AUDIENCE`: `naeos-control-plane` (must match the Control Plane audience).
- `CONTROLPLANE_BFF_KEY_ID`: a unique key identifier, e.g. `crm-bff-2026-01`.
- `CONTROLPLANE_BFF_PRIVATE_KEY`: PEM-encoded RSA private key (at least 2048 bits) or P-256 EC private key. Store it as a secret; never commit it.
- `CONTROLPLANE_API_URL`: HTTPS base URL of the Control Plane API. HTTP is accepted only for localhost during non-production development.

The JWKS route returns 503 when signing is not configured. BFF requests also fail closed when any required configuration is missing.

## Control Plane environment

Configure these values in the Control Plane service:

- `NAEOS_CONTROLPLANE_ISSUER`: same value as `CONTROLPLANE_BFF_ISSUER`.
- `NAEOS_CONTROLPLANE_AUDIENCE`: same value as `CONTROLPLANE_BFF_AUDIENCE`.
- `NAEOS_CONTROLPLANE_JWKS_URL`: `https://<crm-api-origin>/.well-known/jwks.json`.

Do not point the Control Plane at a different or user-controlled JWKS endpoint. The Control Plane must be able to fetch the CRM API's HTTPS JWKS endpoint before it becomes ready.

## Authorization and data flow

1. Browser calls only `/api/v1/control-plane/overview` or `/api/v1/control-plane/decisions` on the CRM API.
2. Existing CRM session middleware resolves the active actor from the database and checks session revocation.
3. CRM authorization requires the dedicated `control-plane:read` permission. The default role mapping grants it only to administrators.
4. CRM API signs an assertion with `iss`, `aud`, `sub` (the authenticated CRM actor ID), `iat`, `exp` (60 seconds), and the exact `control-plane:read` scope.
5. CRM API calls only the fixed Control Plane read endpoints. It does not forward browser Authorization headers, cookies, request bodies, or arbitrary target URLs.
6. Control Plane independently verifies signature, issuer, audience, expiry, JWKS key ID, and scope.

The BFF does not expose policy mutation, approvals, execution, deployment, database administration, or rollback operations.

## Key lifecycle

- Generate the private key outside the repository and inject it through the CRM API secret manager.
- Publish only the public key through JWKS.
- Use a new unique `kid` for rotation. Publish the new public key before switching the signer.
- Keep the previous public key published until all assertions signed with it have expired and the Control Plane JWKS cache has refreshed.
- Revoke the old key by removing it from JWKS after the overlap window.
- Never reuse the CRM session `AUTH_SECRET` as a service signing key.

## Deployment boundary

No environment has been configured by this change. Do not enable the BFF until the CRM API origin, Control Plane API origin, issuer/audience values, and private-key storage are confirmed. Production secrets and Control Plane runtime configuration require a separate approved change.
