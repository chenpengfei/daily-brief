# Goal 14: Source Item Understanding Stage Annotates Collected Items

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/21
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

The Source Item Understanding Stage runs through Pi over supplied Source Items and produces validated annotations that describe claims, Focus Area relevance, evidence boundaries, and weak-item hints without tool use or network research.

## Scope

### Includes

- Understanding Stage prompt and orchestration.
- Batched processing when selected model limits are exceeded.
- Annotation validation.
- Artifact records for batch metadata and outputs.
- Faux/mocked provider tests.
- No open-ended tool calls during the stage.

### Excludes

- Signal selection or ranking.
- Network fetching beyond Fetch Adapters.
- Full external-content mirroring.
- Raw prompt/transcript artifact storage.

## Acceptance Criteria

- Given collected Source Items that fit the selected model context,
  When the Understanding Stage runs,
  Then one validated annotation is produced for each Source Item,
  Evidence: Agent stage test with faux provider.

- Given Source Items exceed the model context limit,
  When the Understanding Stage runs,
  Then orchestration splits inputs into batches and merges validated annotations,
  Evidence: batching test with a mocked limit.

- Given a Source Item annotation references an unknown Source Item id,
  When validation runs,
  Then the stage fails with an Analysis Failure-compatible validation error,
  Evidence: validation failure test.

- Given the stage runs,
  When Agent Run Artifact is inspected,
  Then it records batch metadata and structured annotation outputs without raw prompt text,
  Evidence: artifact test.

## Evidence Required

- Commands:
  - `npm test -- test/agent`
  - `npm run typecheck`
- Tests:
  - Understanding success test.
  - Understanding batching test.
  - Unknown Source Item validation test.
  - Artifact output test.
- Files:
  - Understanding Stage implementation.
  - Understanding schema.
  - Stage orchestration.
- Logs/status:
  - Sample stage event summary in artifact.

## Human Review Notes

- Annotation language should be concise and useful for later selection, not reader-facing prose yet.
- The stage should preserve uncertainty and evidence boundaries.

## Current State Notes

- Existing:
  - Source Items include `analyzableText` and metadata.
  - Pi Agent Runtime is already a dependency.
- Likely gaps:
  - No Understanding Stage exists.
  - No batching around model limits exists.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Source Item Understanding Stage, no tool use, batching.
- Out of Scope Protected:
  - Open-ended research.
  - Tool use inside Agent Stages.
- Dependencies:
  - Goal 11: https://github.com/chenpengfei/daily-brief/issues/17
  - Goal 13: https://github.com/chenpengfei/daily-brief/issues/19
