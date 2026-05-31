# Goal 16: Signal Narrative And Executive Summary Are Agent-Generated

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/24
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

The Signal Narrative Stage generates a Chinese Executive Summary and selected Signal narrative fields from ranked Signals and cited Source Items, including reader-facing `领域` and multi-valued `方向`.

## Scope

### Includes

- Agent-generated Executive Summary.
- Signal Lens fields: multi-valued `领域` and `方向`.
- Directions including `先进工具`, `长程任务`, `持续学习`, `自我改进`, and `人与 Agent 的边界`.
- Narrative fields: `是什么`, `不是什么`, `最小例子`, `为什么重要`.
- Preservation of English technical terms, project names, repository names, paper titles, and source titles.
- Low-signal Executive Summary generation.

### Excludes

- Final source-grounding audit.
- Markdown renderer implementation.
- Discord notification generation.
- New facts outside cited Source Items and Source Coverage.

## Acceptance Criteria

- Given ranked Signals and cited Source Items,
  When the Narrative Stage runs,
  Then each selected Signal has validated focus areas, directions, narrative fields, and citations,
  Evidence: Narrative Stage test with faux provider.

- Given selected Signals and Source Coverage,
  When the Narrative Stage runs,
  Then it produces a concise Chinese Executive Summary grounded in that context,
  Evidence: Executive Summary stage test.

- Given a Signal that crosses both Focus Areas,
  When narrative is validated,
  Then multi-valued `领域` and `方向` are accepted and preserved,
  Evidence: schema validation test.

- Given a low-signal result,
  When narrative runs,
  Then it produces a low-signal Executive Summary without unsupported filler,
  Evidence: low-signal narrative test.

## Evidence Required

- Commands:
  - `npm test -- test/agent`
  - `npm run typecheck`
- Tests:
  - Narrative success test.
  - Executive Summary test.
  - Multi-valued lens validation test.
  - Low-signal narrative test.
- Files:
  - Narrative Stage implementation.
  - Narrative schema.
- Logs/status:
  - Sample structured narrative output in artifact.

## Human Review Notes

- Narrative should be genuinely explanatory and should not sound like a template.
- `不是什么` should clarify boundaries, not dismiss the Signal's value.

## Current State Notes

- Existing:
  - A preliminary signal narrative file exists.
  - Markdown currently renders `Type` and `why_it_matters`.
- Likely gaps:
  - Executive Summary is not Agent-generated.
  - `领域`/`方向` lens is not implemented.
  - Reader-facing labels need Chinese rendering updates in a later goal.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Signal Narrative Stage, Executive Summary, Signal Lens.
- Out of Scope Protected:
  - Unsupported facts.
  - Raw Markdown generated directly by model.
- Dependencies:
  - Goal 15: https://github.com/chenpengfei/daily-brief/issues/23
