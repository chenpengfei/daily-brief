# Foundation Slice: Pi Runtime + Operational CLI Skeleton

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/1
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

The repository has a TypeScript/Node skeleton that can run a low-signal Daily Brief flow through the Pi Agent Runtime and write a Markdown Brief Archive entry even when no Sources are configured.

## Scope

### Includes

- TypeScript/Node project skeleton.
- Minimal `run-once` workflow entry.
- Pi Agent Runtime participation in brief rendering.
- Low-signal Daily Brief generation when the Source Registry is empty.
- Writing the Daily Brief to `briefs/YYYY/MM/YYYY-MM-DD.md`.

### Excludes

- Full Operational CLI command coverage beyond the skeleton.
- Real Fetch Adapters.
- Discord Delivery.
- Scheduler integration.
- Natural-language control or Control TUI.

## Acceptance Criteria

- Given an empty Source Registry,
  When `runOnce` runs for a fixed date,
  Then the workflow completes without treating low signal as a failure,
  Evidence: `npm test -- test/agent/run-once.test.ts`.

- Given `runOnce` completes,
  When the archive path is inspected,
  Then a Markdown Daily Brief exists at `briefs/YYYY/MM/YYYY-MM-DD.md`,
  Evidence: `npm test -- test/agent/run-once.test.ts` asserts archive path and file contents.

- Given the archived low-signal Daily Brief,
  When its Markdown is read,
  Then it contains `Executive Summary`, `Top Signals`, `Source Coverage`, and `Sources`,
  Evidence: `npm test -- test/agent/run-once.test.ts`.

- Given the workflow renders through Pi Agent Runtime,
  When the result is inspected,
  Then Pi runtime event evidence includes `agent_start`,
  Evidence: `npm test -- test/agent/run-once.test.ts`.

## Evidence Required

- Commands:
  - `npm test -- test/agent/run-once.test.ts`
  - `npm run typecheck`
- Tests:
  - Low-signal `runOnce` archive test.
  - Pi runtime event evidence test.
- Files:
  - `src/agent/daily-brief-agent.ts`
  - `src/cli.ts`
  - `test/agent/run-once.test.ts`
- Logs/status:
  - Sample archive path for the fixed test date.

## Human Review Notes

- This issue is a foundation slice, not the final Operational CLI goal.
- The skeleton should prove the architectural direction without pretending real collection is complete.

## Current State Notes

- Existing:
  - `runOnce` exists and uses Pi Agent Runtime through `renderBriefThroughPiRuntime`.
  - `test/agent/run-once.test.ts` covers empty Source Registry low-signal archive behavior.
- Likely gaps:
  - This issue may already be implemented and should be triaged for closure once evidence is confirmed.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 9, 12, 15
- Out of Scope Protected:
  - Control TUI.
  - Real-time alerts.
  - Autonomous Source discovery.
- Dependencies:
  - None.
