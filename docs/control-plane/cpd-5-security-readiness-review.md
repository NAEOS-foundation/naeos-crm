# CPD-5 Security Review and Readiness Assessment

Review date: 2026-11-19
Reviewed branch: `feat/crm-control-plane-bff-v1`
Review scope: CRM BFF and internal read-only Control Plane dashboard (PR #63)
Environment status: not configured or enabled in any environment

## Verified evidence

- CI workflow run #327 for pagination validation fix commit `93acacb11ef29c4354c60bed2d0f3d41ff09b757` completed successfully.
- CRM routes use fixed upstream paths; no browser-supplied target URL.
- CRM BFF checks authenticated actor and `control-plane:read` authorization before forwarding.
- BFF signs a short-lived (60 seconds) assertion; supported algorithms RS256 and ES256; RSA keys under 2048 bits rejected.
- Issuer must be HTTPS origin; configured upstream must use HTTPS except localhost HTTP in non-production.
- Redirects are rejected; upstream timeout is 5 seconds.
- Request is GET only; browser cookies and browser authorization header are not forwarded.
- BFF returns no-store; response size limit is 1 MiB; JSON parse required.
- Success and upstream failures attempt audit logging; successful response is withheld if audit record cannot be persisted.
- Public JWKS contains derived public key only; no private key material.
- Dashboard has no mutation controls; no policy, deployment, rollback, or write operation.
- Integration remains unconfigured; no secrets or environment changes were made.
- CPD-4 Docker execution remains pending.

## Review findings / follow-up before enabling

### F-01 — Content-Type validation
The BFF parses upstream body as JSON but does not explicitly require a JSON Content-Type. Recommend reject unexpected content types before reading/parsing body and add a test. Severity: Low; parsing still rejects invalid JSON.

### F-02 — Response size enforcement
The 1 MiB cap is checked after `upstream.text()` buffers the body. This limits returned payloads but does not bound memory used during read. Before enabling in a shared environment, implement streaming size enforcement or verify the upstream is trusted and strictly bounded; add oversized-response test. Severity: Medium hardening.

### F-03 — JWKS rotation overlap
The integration document states the current JWKS endpoint publishes only one active key, with no overlap/dual-key rotation. Rotation requires coordinated maintenance and cache refresh. Implement overlap/previous-key support before enabling long-lived service integration. Severity: Medium operational.

### F-04 — Audit failure semantics
Successful data is withheld if audit persistence fails, which is fail-closed. Upstream error audit failure also resolves to 503. Verify CRM auth-denial events are independently captured by existing auth/audit middleware. Severity: follow-up evidence.

### F-05 — No E2E evidence
Docker E2E is not executed from this assistant session. This is an explicit blocker for promotion from draft or enabling any environment.

## Readiness decision

**Not ready to enable or merge.** CI is green, and source review supports a read-only design with strong trust boundaries, but the following remain required:

1. CPD-4 local Docker integration tests with isolated disposable environment.
2. Address F-01 and F-02 or document an accepted risk with bounded upstream response guarantees.
3. Confirm auth denial and audit evidence.
4. Establish safe JWKS key-rotation overlap procedure/support.
5. Independent final review of the full diff and CI evidence.
6. Explicit user approval before merge or any environment enablement.

No production, staging, database, secret, or deployment configuration was changed during this review.
