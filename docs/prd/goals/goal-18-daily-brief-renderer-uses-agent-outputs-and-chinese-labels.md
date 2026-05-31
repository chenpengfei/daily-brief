# Goal 18: Daily Brief Renderer Uses Agent Outputs And Chinese Labels

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/26
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

The deterministic renderer turns audited Agent outputs into the reader-facing Chinese Daily Brief with Signal Lens fields, Chinese labels, deterministic Source Coverage and Sources, and stable same-date overwrite.

## Scope

### Includes

- Rendering Agent-generated Executive Summary.
- Rendering each Signal with `领域`, `方向`, `是什么`, `不是什么`, `最小例子`, `为什么重要`, and `引用`.
- Removing reader-facing `Type` and `why_it_matters` labels.
- Deterministic Source Coverage.
- Deterministic Sources URL lookup section.
- Same-date Brief Archive overwrite.

### Excludes

- Agent Stage model prompts.
- Source collection changes.
- Discord interaction controls.
- Rich Discord notification rendering.
- Versioned Markdown archive.

## Acceptance Criteria

- Given audited Agent output,
  When the Daily Brief renders,
  Then each Signal displays the agreed Chinese fields in the agreed order,
  Evidence: renderer snapshot/unit test.

- Given multiple focus areas or directions,
  When the Signal renders,
  Then values are joined with ` / `,
  Evidence: renderer test.

- Given cited Source Items,
  When the Daily Brief renders,
  Then Signal `引用` lists ids and the Sources section expands ids into title links,
  Evidence: renderer test.

- Given a date is regenerated,
  When Brief Archive is written,
  Then the same date path is overwritten directly,
  Evidence: storage test.

## Evidence Required

- Commands:
  - `npm test -- test/brief`
  - `npm test -- test/storage`
  - `npm run typecheck`
- Tests:
  - Markdown renderer tests.
  - Multi-value lens render tests.
  - Sources section tests.
  - Brief overwrite tests.
- Files:
  - Brief renderer.
  - Brief archive writer.
- Logs/status:
  - Sample generated Markdown.

## Human Review Notes

- The brief should read as a Chinese daily intelligence artifact, not as raw schema dumped into Markdown.
- The Sources section should remain compact but sufficient for traceback.

## Current State Notes

- Existing:
  - Markdown renderer exists.
  - Brief Archive writer exists.
- Likely gaps:
  - Renderer currently uses `Type`, `why_it_matters`, and rule-shaped Signal data.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Daily Brief renderer, Sources, Source Coverage.
- Out of Scope Protected:
  - LLM-generated Discord notification.
  - Rich Discord notification rendering.
  - Versioned Markdown archive.
- Dependencies:
  - Goal 16: https://github.com/chenpengfei/daily-brief/issues/24
  - Goal 17: https://github.com/chenpengfei/daily-brief/issues/25
