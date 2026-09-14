# ADR-006: Campaign, Pipeline, and Follow-up Modeling

- Status: Accepted
- Date: 2026-09-14

## Context

Phase 2 adds the revenue pipeline and campaign layer: opportunities with configurable pipeline stages, campaigns composed of ordered sequence steps, and follow-ups attached to activities. Three modeling choices needed explicit decisions.

The pipeline stages had to feed weighted-value analytics. Early discussions considered a fully free-form list of stages keyed only by `sequence`. However, opportunities carry a `stage` value that must reconcile with the stage configuration to compute probabilities and weighted amounts reliably.

Campaigns and their steps had to be modeled without coupling to email/SMS providers, since Phase 6 (integrations) is explicitly deferred.

Follow-ups were modeled as a tracking mechanism over the existing activity model, but authorization had to remain coherent with company ownership.

## Decision

### PipelineStage is a 1:1 configuration for the OpportunityStage enum

- `PipelineStage.stage` is a `@unique` column typed as the `OpportunityStage` enum (`NEW | QUALIFIED | PROPOSAL | NEGOTIATION | WON | LOST`).
- `sequence` and `probability` configure ordering and win likelihood per stage.
- Analytics join opportunities to the stage configuration by the `stage` value to compute weighted value.

### Campaigns own their steps as an aggregate

- `Campaign` is the root; `CampaignStep` belongs to a campaign (`campaignId` with cascade delete) with `@unique([campaignId, sequence])`.
- Steps are created through `POST /api/v1/campaigns/:id/steps` and updated/deleted through `/api/v1/campaign-steps/:id`.
- Steps only model configuration (`actionType`, `subject`, `scheduledAt`, `status`); execution against contacts is deferred.

### Follow-ups attach to activities with company-scoped access

- `FollowUp.activityId` is a foreign key to `Activity` with cascade delete.
- A `FollowUp.status`, `dueAt`, `ownerId`, and `notes` capture follow-up tracking.
- Access control reuses company ownership: members may create/update follow-ups only for activities on companies they own (or where the follow-up is owner-self-scoped).

### Decimal amounts are stored precisely and surfaced as numbers

- Prisma stores opportunity `amount` as `Decimal(14,2)`; repository ports normalize to `number` on read and write.

## Rationale

- A 1:1 stage configuration keeps weighted analytics coherent: weighted value = `amount × stage.probability`, always resolvable from the enum value.
- Aggregating steps under a campaign matches how sequences are authored and reordered atomically, and avoids orphaned steps.
- Deferring execution keeps the domain wait-state-free until governance (Phase 4) and integrations (Phase 6) mature.
- Reusing company ownership for follow-up access avoids a parallel authorization model for a thin tracking entity.

## Consequences

### Positive

- Weighted pipeline analytics is deterministic and simple to compute.
- Campaign authoring (create campaign, append steps) is a single coherent flow.
- Follow-ups stay consistent with the existing activity and company access model.
- Migration `20260914174045_phase2_pipeline_campaigns` captures all Phase 2 schema changes.

### Negative

- Because `PipelineStage.stage` is unique and enumerates all enum values, admins configure probability/name/order rather than invent arbitrary new stages; creating a duplicate stage returns 409.
- Campaign step ordering is enforced by an application-assigned `sequence`; moving steps requires a reorder operation (single-step insert between existing steps is handled by assigning the next sequence).
- Sequence execution engines and provider integrations still need to be designed in later phases.

## Notes

Follow-ups rely on activity presence; creating a follow-up for a missing activity reference is rejected by the persistence layer. Analytics intentionally read from the same repository ports used by the write paths, keeping one source of truth.