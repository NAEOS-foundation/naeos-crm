# NAEOS service integration

## Engineering analysis flow

The CRM exposes `POST /api/v1/intelligence/engineering-analysis` for admin actors only. The request accepts only a `repository` reference in `owner/name` form, and the reference must appear in `INTELLIGENCE_ALLOWED_REPOSITORIES`. The server submits a fixed, read-only analysis request to NAEOS Intelligence; Intelligence resolves the repository through its NAEOS Core connector. CRM contacts, leads, companies, and other CRM records are never included in this request.

```text
CRM user (admin)
  → CRM authorization + audit
  → Intelligence API (service JWT: intelligence:write + intelligence:read)
  → NAEOS Core (read-only repository metadata)
  → analysis result returned to CRM caller
```

The service call is disabled until `INTELLIGENCE_API_URL`, `INTELLIGENCE_ALLOWED_REPOSITORIES`, and `INTELLIGENCE_SERVICE_TOKEN` are configured. The token must be a pre-issued JWT trusted by Intelligence's configured JWKS verifier, with only `intelligence:write` and `intelligence:read` scopes. Do not use a user token or place the service token in source control. Intelligence separately requires a pre-issued RS256 service JWT in `NAEOS_CORE_SERVICE_TOKEN`, trusted by Core's JWKS verifier and scoped only to `naeos:repository:read`.

The request is analysis-only. Intelligence output is a proposal, not authorization or proof that an external action occurred. This endpoint does not trigger CRM GO-Gate actions.

## Remaining operational setup

- Configure the same trusted issuer, audience, and JWKS in Intelligence and issue the scoped service JWT.
- Configure the Core API URL, JWKS verifier, GitHub read credential, and repository allowlist in the Core runtime.
- Deploy services on a private network with TLS for non-local traffic.
- Confirm the deployed Core API exposes the repository endpoint expected by the Intelligence connector.
- Keep CRM personal data out of any future Intelligence contract unless a separate purpose, consent, minimization, retention, and authorization review approves it.
