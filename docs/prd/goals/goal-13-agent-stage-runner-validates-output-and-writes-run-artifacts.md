# Goal 13: Agent Stage Runner Validates Output And Writes Run Artifacts

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/19
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

Daily Brief has a minimal shared Agent Stage runner that validates Structured Agent Output and writes append-only minimal Agent Run Artifacts, so later Agent Stages can plug into a proven execution, validation, and audit path.

## Scope

### Includes

- Stage contract definitions for Understanding, Selection, Ranking, Narrative, and Audit.
- Minimal shared Agent Stage runner around the Pi-backed stage boundary.
- Structured Agent Output validation.
- Agent Run Artifact writer under `data/agent-runs/YYYY/MM/YYYY-MM-DD/RUN_ID.json`.
- Artifact content for run id, timestamps, provider/model metadata, compact input references, structured outputs, validation/audit results, and failure details.
- Default exclusion of raw prompts, streamed deltas, and full transcripts.

### Excludes

- Full implementation of each Agent Stage's model prompt.
- Debug transcript capture.
- Provider event stream capture, full input mirrors, input hash strategy, and detailed retry timeline.
- Brief rendering changes.
- Discord delivery behavior.

## Acceptance Criteria

- Given a valid stage output,
  When validation runs,
  Then the output is accepted and can be passed to the next stage,
  Evidence: schema validation unit tests.

- Given a mocked Agent Stage is executed through the shared stage runner,
  When it returns valid Structured Agent Output,
  Then the runner validates the output and records the stage result in an Agent Run Artifact,
  Evidence: stage runner smoke test.

- Given invalid JSON, missing fields, or impossible references,
  When validation runs,
  Then validation fails with a structured error suitable for Analysis Failure reporting,
  Evidence: schema validation failure tests.

- Given a generation attempt,
  When an Agent Run Artifact is written,
  Then it is appended under a unique run id for the date and contains the minimal stage records without raw prompt text or full input mirrors,
  Evidence: artifact store test.

- Given multiple generation attempts for the same date,
  When artifacts are written,
  Then existing artifacts are not overwritten,
  Evidence: append-only artifact test.

## Evidence Required

- Commands:
  - `npm test -- test/agent`
  - `npm test -- test/storage`
  - `npm run typecheck`
- Tests:
  - Stage schema validation tests.
  - Stage runner smoke test with mocked stage output.
  - Artifact path/write/read tests.
  - Append-only same-date tests.
- Files:
  - Agent stage schema/contracts.
  - Shared Agent Stage runner.
  - Agent Run Artifact store.
- Logs/status:
  - Sample artifact JSON with secrets/prompts absent.

## Human Review Notes

- Artifact contents should be useful for debugging without becoming a hidden transcript archive or a full data mirror.
- Validation errors should be specific enough for a future Coding Agent to fix schema mismatches quickly.

## Current State Notes

- Existing:
  - A preliminary Signal narrative Agent file exists.
  - Source Item Store and Brief Archive storage exist.
- Likely gaps:
  - Full stage contract set does not exist.
  - Agent Run Artifact store does not exist.
  - Existing narrative implementation may need replacement to fit the staged contract.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Structured Agent Output, minimal Agent Run Artifact.
- Out of Scope Protected:
  - Raw transcript capture by default.
  - Provider event stream capture.
  - Full input mirror capture.
  - Direct Markdown generation by models.
- Dependencies:
  - Goal 9: https://github.com/chenpengfei/daily-brief/issues/16
  - Goal 11: https://github.com/chenpengfei/daily-brief/issues/17
