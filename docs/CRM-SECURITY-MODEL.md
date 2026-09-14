# CRM Security Model

## Status

This document establishes the security architecture for NAEOS CRM prior to Phase 1 implementation.

## Security objectives

The repository instructions define the system’s security expectations:

- explicit authorization
- no implicit trust in client-side state
- centralized policy enforcement
- secure by design
- least privilege
- fail closed where security-sensitive operations are involved
- AI advisory boundaries that never become authorization

## Trust boundaries

The system has several important trust boundaries:

1. Browser / frontend boundary
2. API boundary
3. Application boundary
4. Persistence boundary
5. Integration boundary
6. AI boundary
7. Governance / policy boundary

The frontend is not a security boundary. The backend must independently validate every sensitive operation.

## Authentication model

Authentication answers the question: “Who are you?”

### Proposed approach

- Use an OIDC-compatible identity provider for user authentication.
- Maintain application-level user records linked to the external identity subject.
- Store minimal identity metadata required for CRM operations.
- Keep authentication separate from authorization.

### Required characteristics

- strong session management
- token verification at the backend
- no trust in client-supplied roles or permissions
- centralized logout and session revocation support

## Authorization model

Authorization answers the question: “What are you allowed to do?”

### Core rule

All sensitive operations must be authorized server-side.

### Required enforcement points

- API endpoint authorization
- domain operation authorization
- data access authorization
- external action authorization
- audit event authorization context

### Recommended authorization model

- RBAC for high-level roles
- ABAC or policy-based conditions for finer-grained access
- server-side checks against the authenticated actor and resource context
- explicit denial by default for actions that do not match policy

### Mandatory authorization pipeline

Sensitive operations must follow a strict server-side approval pipeline:

1. authenticate the caller
2. resolve the actor and resource scope
3. evaluate policy and authorization on the backend
4. reject unauthorized requests with a safe error response
5. for consequential external actions, create a GO-Gate request
6. require a server-side approved GO-Gate state before execution
7. emit audit evidence for the decision and result

The frontend must never be treated as an authority source for role, permission, policy, or GO-Gate state. Client-provided values must be revalidated by the backend and ignored for authorization decisions.

### Fail-closed security behavior

Security-sensitive operations must fail closed. This means:

- missing or stale policy metadata must deny the request
- expired GO-Gate approvals must not execute
- rejected, revoked, or already-executed requests must be rejected
- unsafe or incomplete integration responses must not be treated as successful execution
- any inability to verify authorization must result in denial, not partial execution

### Examples of protected operations

- creating or modifying company records
- changing lead ownership
- assigning tasks
- approving or rejecting GO-Gate requests
- sending external messages
- creating external issues or workflows
- modifying policy or authorization metadata

## GO-Gate model

GO-Gate is a first-class security concept.

### GO-Gate states

- READY
- WAITING_FOR_GO
- APPROVED
- EXECUTING
- EXECUTED
- FAILED
- EXPIRED
- REJECTED

### GO-Gate requirements

- Consequential external actions must pass through GO-Gate.
- The UI must surface GO-Gate state clearly.
- Rejected, expired, or already executed requests must not be replayed.
- The backend must verify approval and state before execution.

### External action boundary

Examples of actions that should require GO-Gate:

- sending an email
- sending a message
- publishing a post
- contacting a prospect
- creating an external issue
- modifying external systems
- triggering an external workflow

## AI safety boundary

AI functionality is advisory by default.

### Allowed AI behavior

- summarize
- classify
- recommend
- score
- draft
- analyze
- identify possible next actions

### Forbidden AI behavior

- sending external messages without authorization
- modifying external systems directly
- approving or granting permissions
- widening its own capabilities
- bypassing authorization
- modifying audit records
- changing policy by itself

### AI authorization rule

AI output is represented as Recommendation, not Authorization.

Any AI-generated recommendation must flow through the same policy evaluation and GO-Gate path for any consequential external action.

## Data handling model

### Least privilege

- Access should be granted only for the minimum scope needed.
- Role scope should be explicitly mapped to resources and actions.
- Data should be isolated by ownership and tenancy boundaries where applicable.

### Data minimization

- Store only the information needed for legitimate CRM operations.
- Avoid collecting unnecessary sensitive personal data.
- Do not expose personal data through logs, error messages, or public APIs.

## Secret management

- Never hardcode secrets.
- Use environment variables or production secret-management tools.
- Maintain `.env.example` with placeholders only.
- Never commit real `.env` files.

## Input validation and trust minimization

### Input validation

Validation must happen at:

- API boundary
- integration boundary
- persistence boundary where appropriate

### Untrusted inputs

External integration data, AI content, webhooks, and user-provided metadata must all be treated as untrusted unless explicitly validated and authorized.

## Error handling and logging

- Never swallow errors.
- Return safe error responses to clients.
- Log structured identifiers such as request_id and actor_id when appropriate.
- Do not leak stack traces, secrets, internal DB details, or sensitive infrastructure metadata.

## Security testing

The following security tests must never succeed:

1. Unauthorized user executes restricted action.
2. AI executes external action without authorization.
3. UI bypasses server authorization.
4. Campaign sends without required approval.
5. Expired GO-Gate executes.
6. Rejected GO-Gate executes.
7. Already executed action is replayed.
8. User modifies another user’s restricted data.
9. Audit history is silently modified.
10. External input widens permissions.
11. AI output grants itself capabilities.
12. Stale authorization is reused.

## Security architecture summary

The security design for NAEOS CRM should be grounded in three ideas:

1. Authentication answers identity.
2. Authorization answers permission.
3. GO-Gate and audit provide explicit control over consequential actions.

This gives the platform a clear security posture while maintaining the opportunity to evolve toward SaaS-ready tenant isolation in later phases.
