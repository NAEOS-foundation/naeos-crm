# CRM Domain Model

## Status

This document describes the domain model intended for NAEOS CRM and the bounded contexts that structure that model.

## Domain foundations

The repository instructions require that business logic live in the domain/application layers, not in UI components or database triggers. Domain types should be explicit rather than represented by ambiguous primitive values.

The domain model below is therefore intentionally expressed as a business language model, not a database schema.

## Bounded contexts and responsibilities

### 1. Relationship

Responsible for the core entity graph that describes who the CRM is managing and how those relationships evolve.

#### Core entities

- Company
  - id
  - name
  - industry
  - region
  - status
  - relationship_health
  - owner_id
  - created_at
  - updated_at

- Contact
  - id
  - company_id
  - full_name
  - email
  - role
  - status
  - preferred_channel
  - created_at
  - updated_at

- Lead
  - id
  - company_id
  - source
  - lead_status
  - owner_id
  - score
  - created_at
  - updated_at

- RelationshipHealth
  - id
  - entity_type
  - entity_id
  - health_score
  - notes
  - updated_at

#### Key rules

- A company may have many contacts and many leads.
- A contact belongs to exactly one company.
- Lead lifecycle states must be explicit, not ad hoc text.
- Relationship health should be derived from structured signals rather than hidden UI-only state.

### 2. Revenue

Responsible for opportunities, pipeline progression, and use-case tracking.

#### Core entities

- Opportunity
  - id
  - company_id
  - name
  - stage
  - amount
  - close_date
  - owner_id
  - created_at
  - updated_at

- PipelineStage
  - id
  - name
  - sequence
  - probability

- UseCase
  - id
  - opportunity_id
  - title
  - summary
  - value
  - owner_id

#### Key rules

- Opportunity stage transitions must be explicit and auditable.
- Use cases should remain attached to the opportunity rather than duplicated elsewhere.
- Revenue calculations should be based on domain data, not UI-calculated values.

### 3. Engagement

Responsible for activities, tasks, campaigns, and follow-up orchestration.

#### Core entities

- Activity
  - id
  - company_id
  - contact_id
  - type
  - channel
  - summary
  - occurred_at
  - owner_id

- Task
  - id
  - company_id
  - assignee_id
  - subject
  - due_at
  - status
  - created_at
  - updated_at

- Campaign
  - id
  - name
  - type
  - owner_id
  - status

- CampaignStep
  - id
  - campaign_id
  - sequence
  - action_type
  - template_id
  - status

- FollowUp
  - id
  - activity_id
  - due_at
  - status
  - owner_id

#### Key rules

- Follow-up state and campaign step state must be visible to users.
- Tasks and activities should be traceable to the owning company or contact.
- Campaign actions should be explicit operations, not hidden side effects.

### 4. Ecosystem

Responsible for relationship types beyond direct commercial prospects.

#### Core entities

- Contributor
  - id
  - name
  - role
  - community_affiliations
  - status

- Partner
  - id
  - name
  - partner_type
  - status

- Community
  - id
  - name
  - purpose
  - status

- Investor
  - id
  - name
  - investor_type
  - status

#### Key rules

- Ecosystem entities should be separately identifiable from leads, companies, and opportunities.
- Cross-entity relationships must remain explicit.

### 5. Governance

Responsible for policy, authorization, GO-Gate, and audit.

#### Core entities

- User
  - id
  - name
  - email
  - roles
  - status

- Role
  - id
  - name
  - description

- Permission
  - id
  - resource
  - action
  - condition

- Policy
  - id
  - name
  - version
  - effect
  - rules

- GoGateRequest
  - id
  - subject
  - action
  - target
  - status
  - requested_by
  - approved_by
  - expires_at
  - created_at
  - updated_at

- AuditEvent
  - id
  - actor_id
  - action
  - entity
  - entity_id
  - request_id
  - timestamp
  - source
  - authorization
  - policy_version
  - result
  - reason
  - previous_state
  - new_state

#### Key rules

- Governance entities are authoritative for authorization and audit decisions.
- GO-Gate states must be explicit and visible.
- Policies should be versioned and testable.

### 6. Intelligence

Responsible for advisory intelligence, scoring, and recommendations without treating AI output as authorization.

#### Core entities

- Recommendation
  - id
  - entity_type
  - entity_id
  - recommendation_type
  - confidence
  - rationale
  - generated_by
  - created_at

- LeadIntelligence
  - id
  - lead_id
  - score
  - explanation
  - generated_at

- RelationshipIntelligence
  - id
  - company_id
  - summary
  - generated_at

- NAEOSFitScore
  - id
  - company_id
  - score
  - classification
  - rationale
  - source

#### Key rules

- Recommendations must be clearly labeled as advisory.
- Scoring logic must be transparent and deterministic where possible.
- AI-generated scoring or recommendations must never be presented as verified facts.

## Domain types

The following explicit types should be favored over unstructured strings wherever relevant:

- LeadStatus
- OpportunityStage
- RelationshipStatus
- UserRole
- GoGateStatus
- ActivityType
- CampaignType
- PolicyEffect
- AuditResult

## Suggested aggregate boundaries

### Relationship aggregate

- Company aggregate root
  - includes company metadata
  - owns contacts, leads, and relationship health signals

### Revenue aggregate

- Opportunity aggregate root
  - owns pipeline progression and use cases

### Engagement aggregate

- Campaign aggregate root
  - owns campaign steps and follow-up schedules

### Governance aggregate

- Policy aggregate root
  - owns authorization rules and GO-Gate decisions

### Intelligence aggregate

- Recommendation aggregate root
  - owns advisory output with clear provenance

## Domain events

The architecture should use domain events where they provide real value. Suggested events include:

- CompanyCreated
- ContactAdded
- LeadCreated
- LeadQualified
- OpportunityCreated
- OpportunityStageChanged
- ActivityCreated
- TaskAssigned
- CampaignStepPrepared
- ExternalActionRequested
- GoGateRequested
- GoGateApproved
- ExternalActionExecuted
- ExternalActionFailed
- ContributorAdded

## Data ownership rules

- The domain owns business rules. The UI does not.
- The persistence layer stores state, not business intent.
- The integration layer handles provider-specific translation.
- Governance owns authorization decisions.
- Audit owns durable evidence of consequential changes.

## Open domain questions

- Should RelationshipHealth be a first-class aggregate or a derived read model?
- Should the NAEOS Fit Score be stored as a materialized score or recomputed on demand?
- Should campaigns and sequences be represented as one concept or two distinct aggregates?
- Should tasks remain separate from activities, or be treated as a specialized activity type?

## Summary

The domain model should remain clear, explicit, and bounded. The current architecture intends to treat the CRM as a modular monolith with well-defined contexts and consistent explicit types, making the system secure, auditable, and extensible without over-architecting the early implementation.
