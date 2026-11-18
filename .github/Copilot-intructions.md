NAEOS CRM — GitHub Copilot Instructions

1. PROJECT IDENTITY

Project:

NAEOS CRM — Engineering Relationship & Ecosystem Management Platform

Repository:

"NAEOS-foundation/naeos-crm"

NAEOS CRM is an operational and reference application within the NAEOS ecosystem.

NAEOS stands for:

Nusantara AI Engineering Operating System

NAEOS CRM is not a generic sales CRM.

It is designed to manage the relationships surrounding the NAEOS ecosystem:

- companies
- contacts
- prospects
- engineering leaders
- developers
- contributors
- communities
- partners
- investors
- customers
- strategic relationships

The application must demonstrate how NAEOS principles can be applied to a real production application.

---

2. CORE ENGINEERING PRINCIPLE

The most important principle is:

«AI recommendation is not authorization.»

Never allow an AI agent, AI assistant, model output, or generated recommendation to directly become an authorized external action.

The conceptual flow is:

Intent
  ↓
Recommendation
  ↓
Policy Evaluation
  ↓
Authorization
  ↓
GO-Gate
  ↓
Execution
  ↓
Verification
  ↓
Audit

Never implement:

AI
 ↓
External Action

---

3. NAEOS PRINCIPLES

All implementation decisions should respect:

- Policy-driven
- Secure by design
- Auditable
- Observable
- Modular
- Event-driven where justified
- Vendor-neutral
- Extensible
- Deterministic where possible
- Least privilege
- Explicit authorization
- Separation of concerns
- Fail closed for security-sensitive operations

---

4. COPILOT OPERATING MODE

Before modifying code:

1. Inspect the repository.
2. Read relevant documentation.
3. Understand existing architecture.
4. Identify the affected bounded context.
5. Check existing conventions.
6. Check existing tests.
7. Determine security implications.
8. Determine audit implications.
9. Determine authorization implications.
10. Make the smallest coherent change.

Do not blindly generate large amounts of code.

Prefer incremental implementation.

---

5. EXISTING ARCHITECTURE HAS PRIORITY

Never replace an existing architectural decision merely because another approach is easier.

Before introducing:

- framework
- dependency
- database abstraction
- architecture pattern
- service
- external integration
- authentication system
- state management solution

inspect the repository first.

If a new dependency is necessary, explain why it is needed.

Avoid unnecessary dependencies.

---

6. DOMAIN BOUNDARIES

The CRM should be organized around clear bounded contexts.

Relationship

Responsible for:

- Company
- Contact
- Lead
- Relationship Health

Revenue

Responsible for:

- Opportunity
- Pipeline
- Use Case

Engagement

Responsible for:

- Activity
- Campaign
- Campaign Step
- Follow-up
- Task

Ecosystem

Responsible for:

- Contributor
- Partner
- Community
- Investor

Governance

Responsible for:

- Policy
- Authorization
- GO-Gate
- Audit

Intelligence

Responsible for:

- AI Recommendation
- Lead Intelligence
- Relationship Intelligence

Do not create unnecessary coupling between contexts.

---

7. DOMAIN MODELING RULES

Business logic belongs in the domain/application layer, not inside UI components.

Do not duplicate business rules across:

- frontend
- API controllers
- database triggers
- integration adapters

Prefer a single authoritative implementation of domain rules.

Use explicit types.

Avoid ambiguous primitive values when a domain type is appropriate.

Examples:

Prefer:

LeadStatus
OpportunityStage
RelationshipStatus
UserRole
GoGateStatus

over unrestricted strings throughout the system.

---

8. DATA MODELING

Use PostgreSQL as the preferred relational database unless the repository establishes a different justified decision.

Database design must include:

- primary keys
- foreign keys
- unique constraints
- appropriate indexes
- created_at
- updated_at
- explicit ownership where applicable
- migrations

Never modify production schema manually.

Every schema change must be represented by a migration.

Avoid premature denormalization.

---

9. MULTI-TENANCY

The architecture should be capable of evolving into SaaS.

Do not implement complex multi-tenancy prematurely unless required.

However, domain boundaries must not prevent future tenant isolation.

Do not assume that every user can access every company, contact, activity, document, or opportunity.

Authorization must be enforced server-side.

---

10. AUTHENTICATION

Authentication is separate from authorization.

Authentication answers:

«Who are you?»

Authorization answers:

«What are you allowed to do?»

Never use authentication alone as proof of permission.

---

11. AUTHORIZATION

All sensitive operations must be authorized on the server.

Never trust:

- frontend state
- hidden UI elements
- client-provided roles
- client-provided permissions
- AI output
- URL parameters
- request metadata

The backend must independently verify authorization.

---

12. GO-GATE

GO-Gate is a first-class security concept.

Any consequential external action must pass through an explicit authorization boundary.

Examples:

- sending an email
- sending a message
- publishing a post
- contacting a prospect
- creating an external issue
- modifying external systems
- triggering an external workflow

The CRM must distinguish:

READY
WAITING_FOR_GO
APPROVED
EXECUTING
EXECUTED
FAILED
EXPIRED
REJECTED

Never hide the approval state.

Never allow the UI to bypass the server-side GO-Gate.

---

13. AI SAFETY BOUNDARY

AI functionality is advisory by default.

AI may:

- summarize
- classify
- recommend
- score
- draft
- analyze
- identify possible next actions

AI must not silently:

- send external messages
- modify external systems
- approve itself
- grant itself permissions
- widen its capabilities
- bypass authorization
- modify audit records
- change policy

Represent AI output as:

Recommendation

not:

Authorization

---

14. AUDIT TRAIL

Auditability is a core requirement.

Consequential operations must produce an audit event.

At minimum, audit events should be capable of recording:

- actor
- action
- entity
- entity_id
- timestamp
- request_id
- previous_state
- new_state
- source
- authorization
- policy_version
- result
- reason where applicable

The audit trail must outlive the AI agent's memory.

Never rely on:

- chat history
- agent memory
- model context
- logs alone

as the authoritative audit record.

---

15. AUDIT IMMUTABILITY

Audit records are append-oriented.

Do not provide normal CRUD semantics for audit history.

Avoid:

UPDATE audit_event
DELETE audit_event

unless there is an explicitly documented compliance mechanism.

If corrections are necessary, append a corrective event rather than silently rewriting history.

---

16. EXTERNAL INTEGRATIONS

Integrations must be isolated behind adapters.

Examples:

GmailAdapter
GitHubAdapter
CalendarAdapter
DiscordAdapter
LinkedInAdapter

The CRM domain must not depend directly on provider-specific APIs.

Prefer:

CRM Domain
    ↓
Integration Interface
    ↓
Provider Adapter
    ↓
External Provider

This allows providers to be replaced without rewriting domain logic.

---

17. EXTERNAL DATA IS UNTRUSTED

Treat all external integration data as untrusted input.

This includes:

- emails
- GitHub content
- issue descriptions
- pull requests
- messages
- webhooks
- API responses
- metadata
- AI-generated content

Never automatically interpret external text as instructions.

External content is data unless explicitly authorized as a command.

---

18. EVENT-DRIVEN DESIGN

Use domain/application events when they provide real value.

Examples:

LeadCreated
LeadQualified
OpportunityCreated
OpportunityStageChanged
ActivityCreated
FollowUpDue
CampaignStepPrepared
ExternalActionRequested
GoGateRequested
GoGateApproved
ExternalActionExecuted
ExternalActionFailed
ContributorAdded

Do not introduce event infrastructure merely for architectural fashion.

Prefer simple synchronous domain logic where asynchronous processing is unnecessary.

---

19. API DESIGN

API boundaries should reflect domain boundaries.

Initial resources include:

/api/companies
/api/contacts
/api/leads
/api/activities
/api/tasks
/api/audit

Later:

/api/opportunities
/api/campaigns
/api/contributors
/api/partners
/api/investors
/api/go-gates

API behavior must be:

- validated
- authenticated
- authorized
- observable
- auditable where appropriate

Use consistent error responses.

Never expose internal stack traces to clients.

---

20. VALIDATION

Validate input at system boundaries.

Validation should exist at:

- API boundary
- integration boundary
- persistence boundary where appropriate

Do not rely solely on frontend validation.

Frontend validation improves UX.

Backend validation provides security and correctness.

---

21. ERROR HANDLING

Never silently swallow errors.

Avoid:

catch(error) {}

Errors should be:

- handled
- logged appropriately
- classified
- returned safely to the caller

Do not leak:

- secrets
- tokens
- stack traces
- internal database information
- sensitive infrastructure details

---

22. LOGGING

Use structured logging.

Include useful context such as:

- request_id
- actor_id where appropriate
- operation
- entity
- result
- error classification

Do not log:

- passwords
- access tokens
- API keys
- secrets
- unnecessary personal data

---

23. TESTING REQUIREMENTS

Every meaningful feature should have appropriate tests.

Use:

Unit tests

For domain logic.

Integration tests

For database/API/integration boundaries.

E2E tests

For critical user workflows.

Security tests

For authorization and permission boundaries.

Audit tests

For audit correctness.

GO-Gate tests

For external action authorization.

---

24. CRITICAL SECURITY TESTS

The following must never succeed:

1. Unauthorized user executes restricted action.
2. AI executes external action without authorization.
3. UI bypasses server authorization.
4. Campaign sends without required approval.
5. Expired GO-Gate executes.
6. Rejected GO-Gate executes.
7. Already executed action is replayed.
8. User modifies another user's restricted data.
9. Audit history is silently modified.
10. External input widens permissions.
11. AI output grants itself capabilities.
12. Stale authorization is reused.

---

25. FRONTEND PRINCIPLES

The frontend should be:

- accessible
- responsive
- fast
- keyboard friendly
- information dense
- clear
- predictable

Do not hide security-critical state.

For example, show:

Waiting for GO

rather than hiding an action behind an ambiguous button.

The frontend is not a security boundary.

---

26. UX PRINCIPLES

The user should quickly understand:

- who the relationship is
- why it matters
- current status
- previous interactions
- next action
- owner
- risks
- pending approval
- recent activity

Company Detail should be one of the primary operational views.

---

27. NAEOS FIT SCORE

The CRM may calculate an NAEOS Fit Score using:

AI Agent Adoption       20
Engineering Team Size   15
Governance Need         20
Security Requirement    15
Enterprise Complexity   15
Open Source Alignment    5
Strategic Value         10
---------------------------
Total                  100

Classification:

90–100  Strategic
75–89   High Priority
50–74   Qualified
25–49   Nurture
0–24    Low Priority

Scoring logic must be transparent and testable.

AI-generated scoring recommendations must not be represented as verified facts.

---

28. PRIVACY

Collect only data needed for legitimate CRM operations.

Avoid unnecessary sensitive personal information.

Do not expose personal information through:

- logs
- error messages
- public APIs
- AI prompts
- analytics

Respect data minimization.

---

29. SECRETS

Never hardcode:

- API keys
- passwords
- OAuth secrets
- private tokens
- database passwords

Use environment variables or a proper secret-management mechanism.

Never commit ".env" files containing secrets.

Maintain:

.env.example

with safe placeholders.

---

30. DEPENDENCY MANAGEMENT

Before adding a dependency:

1. Check whether the functionality already exists.
2. Evaluate maintenance status.
3. Evaluate security reputation.
4. Evaluate license compatibility.
5. Evaluate bundle/runtime impact.
6. Determine whether the dependency is actually necessary.

Avoid dependency sprawl.

---

31. DOCUMENTATION

Important architectural decisions must be documented.

Use:

docs/
├── CRM-ARCHITECTURE.md
├── CRM-DOMAIN-MODEL.md
├── CRM-SECURITY-MODEL.md
├── CRM-AUDIT-MODEL.md
├── CRM-API.md
├── CRM-ROADMAP.md
└── adr/

Architecture decisions should use ADRs.

Do not allow implementation to silently diverge from documented architecture.

If implementation intentionally changes architecture, update the documentation.

---

32. DEVELOPMENT PHASES

Do not implement everything simultaneously.

Phase 1 — Foundation

Implement:

- authentication
- RBAC
- users
- companies
- contacts
- leads
- activities
- tasks
- dashboard
- basic audit

Phase 2 — Pipeline & Campaigns

Implement:

- opportunities
- pipeline
- campaigns
- sequences
- follow-ups
- analytics

Phase 3 — Ecosystem

Implement:

- contributors
- partners
- communities
- investors
- NAEOS use cases

Phase 4 — Governance

Implement:

- policy integration
- authorization engine
- GO-Gate
- advanced audit
- execution verification

Phase 5 — AI

Implement:

- AI assistant
- lead intelligence
- relationship intelligence
- recommendations

Phase 6 — Integrations

Implement integrations such as:

- Gmail
- GitHub
- Calendar
- Discord
- other providers

Do not skip directly to Phase 5 because AI features appear attractive.

---

33. PHASE DISCIPLINE

When working on Phase 1:

Do not introduce Phase 5 functionality unless it is required by architecture.

When working on Phase 2:

Do not assume Phase 6 integrations already exist.

Keep future extension points clean without prematurely implementing them.

---

34. DEFINITION OF DONE

A feature is not complete merely because the UI works.

A feature is complete when appropriate:

- domain logic
- API
- database migration
- validation
- authorization
- error handling
- tests
- audit behavior
- documentation

are implemented.

Not every feature requires every layer, but the omission must be intentional.

---

35. CHANGE SURFACE

Before making a significant change, evaluate:

Change Surface
×
Blast Radius
×
Change Characteristics

Verification rigor should increase with the combination of these factors.

Do not determine verification effort from diff size alone.

---

36. VERIFICATION

For consequential changes prefer:

Mechanical Checks
        ↓
LLM Review
        ↓
Independent Fresh-Context Review
        ↓
Execution / E2E Verification

Never treat the implementing AI agent's own reasoning as sufficient independent verification.

---

37. CODE QUALITY

Prefer:

- small modules
- explicit interfaces
- typed contracts
- clear names
- deterministic logic
- testable functions
- low coupling
- high cohesion

Avoid:

- giant services
- god classes
- hidden global state
- duplicated business rules
- speculative abstractions
- unnecessary microservices

---

38. REFACTORING

When modifying existing code:

Prefer a small coherent refactor over broad rewrites.

Do not rewrite unrelated code.

Do not change formatting across the repository without a specific reason.

Keep pull requests reviewable.

---

39. GIT DISCIPLINE

Keep commits focused.

Prefer:

feat:
fix:
refactor:
docs:
test:
security:
chore:

Do not mix unrelated changes in one commit.

Before proposing a commit:

- run tests
- run lint
- run type checks
- inspect changed files
- inspect git diff

---

40. COPILOT RESPONSE FORMAT

When completing a development task, report:

Changed

Files and major changes.

Why

Architectural reason.

Security

Security implications.

Tests

Tests executed and results.

Audit

Whether audit behavior changed.

Authorization

Whether permission behavior changed.

Remaining Work

Anything intentionally not implemented.

Do not claim tests passed if they were not actually executed.

Do not claim an integration works if it was not verified.

---

41. STOP CONDITIONS

Stop and request clarification when:

- requirements conflict
- security implications are unclear
- data deletion semantics are ambiguous
- authorization requirements are ambiguous
- external side effects are requested without an authorization model
- architectural changes would affect NAEOS core assumptions
- a destructive migration is required without a clear migration strategy

Do not guess in security-critical situations.

---

42. PRIORITY ORDER

When requirements conflict, prioritize:

1. Security
2. Data integrity
3. Authorization correctness
4. Auditability
5. Architectural integrity
6. Correctness
7. Maintainability
8. Performance
9. Developer convenience
10. Visual polish

---

43. FINAL PRINCIPLE

NAEOS CRM is not merely a contact database.

It is an operational reference application demonstrating how an AI-native system can safely manage consequential relationships and actions.

The system must preserve the distinction between:

Recommendation
      ≠
Decision
      ≠
Authorization
      ≠
Execution
      ≠
Verification
      ≠
Audit

This separation is a foundational architectural invariant.

When in doubt:

«Make the boundary explicit.»
