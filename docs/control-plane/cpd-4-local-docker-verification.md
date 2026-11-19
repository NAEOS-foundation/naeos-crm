# CPD-4: local Docker integration verification

Status: test plan; local execution evidence is pending. This plan is for an isolated developer machine only and must not use production credentials, URLs, databases, or secrets.

## Isolation prerequisites

- Docker Compose project name is unique (for example `naeos-cpd4`).
- Use only local containers, temporary signing keys, and a disposable test database.
- Set CRM `CONTROLPLANE_API_URL` to a local Control Plane service.
- Set Control Plane issuer, audience, and JWKS URL to the local CRM API.
- Ensure CRM and Control Plane do not have production environment files mounted.
- Disable external network access for test containers where practical, except package installation before the test.

## Test sequence and expected evidence

| ID | Test | Expected |
| --- | --- | --- |
| CPD4-01 | CRM JWKS endpoint | HTTP 200 with public key only; no private JWK fields |
| CPD4-02 | CRM BFF overview | Admin receives read-only overview from local Control Plane |
| CPD4-03 | CRM BFF decisions | Admin can request default and paginated records |
| CPD4-04 | Query validation | Numeric `limit` 1–100 and non-negative integer `after` accepted; invalid values rejected with 400 |
| CPD4-05 | Service assertion | Core accepts correct issuer/audience/signature/kid and 60-second expiry |
| CPD4-06 | Scope | Missing or wrong scope rejected by Control Plane |
| CPD4-07 | CRM authorization | Admin allowed; manager/member denied unless explicit policy is separately configured |
| CPD4-08 | Audit | Successful reads and upstream failures are recorded with actor/request ID |
| CPD4-09 | Fail-closed | Missing signing config, bad signature, unavailable JWKS/ledger, timeout, non-JSON, and oversized response never return operational data |
| CPD4-10 | Boundary | Browser requests only CRM BFF; no browser assertion or core credentials; no mutation endpoints |
| CPD4-11 | Environment isolation | Test can run with production configuration absent and no production network/database access |

## Suggested operator run

1. Generate a temporary RSA key (3072-bit) and use a test-only `kid`.
2. Create local environment files from the non-secret example templates; do not copy production env files.
3. Start the CRM dependencies and CRM API under a unique Compose project name.
4. Start the Control Plane with an isolated test ledger/database and point its JWKS config to the local CRM API.
5. Run CRM API unit/integration tests and the manual endpoint checks above.
6. Capture sanitized logs, test results, and the exact commit SHAs as evidence.
7. Tear down containers and volumes, then securely remove temporary private keys.

## Current status

The CRM PR CI is green. CPD-4 has not been executed in a local Docker runtime from this assistant session; the checklist is an execution guide, not a claim of test success. Do not promote this integration or configure any environment until the evidence is reviewed.
