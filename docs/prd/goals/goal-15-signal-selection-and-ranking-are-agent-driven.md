# Goal 15: Signal Selection And Ranking Are Agent-Driven

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/23
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

Production Signal selection, low-signal classification, merge, shortlist, and final ranking are driven by Agent Stages rather than deterministic keyword rules.

## Scope

### Includes

- Signal Selection Stage from Source Item annotations.
- Exclusion reasons for items that should not become Signals.
- Batched selection with global merge when needed.
- Signal Ranking Stage with global comparison.
- `brief.maxSignals` default of 5.
- Agent-driven low-signal decision.
- Preservation and validation of citations.

### Excludes

- Signal narrative prose.
- Executive Summary.
- Source-grounding final audit.
- Rule-based production selection/ranking fallback.

## Acceptance Criteria

- Given Source Item annotations,
  When Signal Selection runs,
  Then candidate Signals and exclusions are returned with source-grounded reasons and valid citations,
  Evidence: Selection Stage test with faux provider.

- Given batched selection outputs duplicate candidates,
  When the global merge step runs,
  Then duplicates are merged and citations are preserved,
  Evidence: merge test.

- Given more candidate Signals than `brief.maxSignals`,
  When Ranking runs,
  Then at most the configured maximum is selected and weak Signals are not added just to fill the quota,
  Evidence: Ranking Stage test.

- Given no strong Signals exist despite successful collection,
  When Selection/Ranking completes,
  Then the run produces an Agent-driven low-signal result rather than a keyword-filter result,
  Evidence: low-signal stage test.

## Evidence Required

- Commands:
  - `npm test -- test/agent`
  - `npm run typecheck`
- Tests:
  - Selection success test.
  - Exclusion reason test.
  - Batched merge test.
  - Ranking maxSignals test.
  - Low-signal test.
- Files:
  - Selection Stage.
  - Ranking Stage.
  - Merge logic.
- Logs/status:
  - Sample artifact containing exclusions and ranking reasons.

## Human Review Notes

- Selection reasons should feel specific to the Source Items, not generic rubric text.
- Low-signal output should preserve quality without padding.

## Current State Notes

- Existing:
  - Current production generation still has rule-based relevance/classification logic.
- Likely gaps:
  - Rule-based production Signal decisions need removal or demotion to tests/fixtures.
  - Selection/Ranking stage contracts need integration.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Signal Selection Stage, Signal Ranking Stage, low-signal decision.
- Out of Scope Protected:
  - Rule-based production selection.
  - Rigid Signal Type enum.
- Dependencies:
  - Goal 14: https://github.com/chenpengfei/daily-brief/issues/21
