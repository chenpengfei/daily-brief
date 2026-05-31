# Goal 17: Source-Grounding Audit Gates Brief Generation

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/25
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

The Source-grounding Audit Stage validates Executive Summary and Signal narrative against cited Source Items and Source Coverage before any normal Brief Archive entry is written.

## Scope

### Includes

- Audit Stage prompt and schema.
- Validation of citations, Source Item ids, Signal Lens, Executive Summary, and narrative fields.
- Detection of unsupported claims, missing citations, overconfident trend interpretation, generic AI drift, and open-ended research leakage.
- At most one repair attempt when audit fails.
- Analysis Failure when audit remains failed.
- Artifact records for audit findings and repair attempts.

### Excludes

- Rewriting the whole brief outside the bounded repair path.
- Copy editing as the audit's main job.
- Network or tool use during audit.
- Discord notification behavior.

## Acceptance Criteria

- Given valid narrative and citations,
  When the Audit Stage runs,
  Then it passes and records an audit result,
  Evidence: Audit Stage success test.

- Given narrative that cites an unknown Source Item,
  When audit runs,
  Then generation fails as Analysis Failure and no normal Brief Archive is written,
  Evidence: audit failure generation-gate test.

- Given narrative that introduces an unsupported claim,
  When audit runs,
  Then the system performs at most one repair attempt and fails if the violation remains,
  Evidence: repair attempt test with artifact assertion.

- Given Source Coverage includes partial failures,
  When audit checks Executive Summary,
  Then it rejects summaries that overstate collection completeness,
  Evidence: Source Coverage audit test.

## Evidence Required

- Commands:
  - `npm test -- test/agent`
  - `npm test -- test/storage`
  - `npm run typecheck`
- Tests:
  - Audit pass/fail tests.
  - Repair attempt test.
  - Unknown citation test.
  - Generation/archive gate test.
  - Partial Source Coverage audit test.
- Files:
  - Audit Stage implementation.
  - Audit schema.
  - Workflow gate.
- Logs/status:
  - Sample artifact showing audit violation and repair attempt.

## Human Review Notes

- Audit failures should be clear enough for the user to understand whether the problem is source data, model output, or configuration.
- The audit should protect trust without becoming a generic style critic.

## Current State Notes

- Existing:
  - Source-grounding is a domain rule.
  - No dedicated audit stage exists.
- Likely gaps:
  - Generation may currently archive output without a final grounding gate.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Source-grounding Audit Stage, Analysis Failure.
- Out of Scope Protected:
  - Best-effort warning-only audit.
  - Open-ended research.
- Dependencies:
  - Goal 16: https://github.com/chenpengfei/daily-brief/issues/24
