# ADR-004: AI Authorization Boundary

- Status: Accepted
- Date: 2026-09-14

## Context

The repository instructions make a strong distinction between AI recommendation and authorization. AI is allowed to summarize, classify, recommend, score, draft, analyze, and identify next actions, but it must not become the mechanism by which external actions are approved, executed, or privileged.

This is especially important because an AI system can otherwise accidentally widen its own capabilities or bypass the normal authorization and GO-Gate processes.

## Decision

Treat AI output as advisory only. Any consequential external action must pass through the explicit authorization and GO-Gate pipeline, independent of AI-generated suggestions.

## Rationale

- the repository explicitly states that “AI recommendation is not authorization”
- this boundary preserves security and policy integrity
- it enables AI to assist operations without allowing the model to cause unintended external effects
- it supports auditability by keeping AI-generated recommendations separate from execution authority

## Consequences

### Positive

- clearer separation between advisory intelligence and real action execution
- stronger security posture for external workflows
- easier compliance and audit review
- less risk of AI-induced privilege escalation or unintended side effects

### Negative

- some AI-assisted workflows will require an additional approval step for real-world action
- the product must clearly communicate AI recommendations as recommendations, not facts

## Notes

AI-generated content should be represented as Recommendation, not Authorization. Any approved action must be derived from explicit policy evaluation and server-side GO-Gate state.
