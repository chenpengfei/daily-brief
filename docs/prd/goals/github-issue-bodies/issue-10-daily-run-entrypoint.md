# Goal 6/8 Slice: Daily Run Entrypoint

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/10
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

The Operational CLI can run the MVP daily workflow through independent commands or `run-once`, and operations documentation defines the 06:00 collection / 07:00 delivery cadence without binding the MVP to a specific scheduler.

## Scope

### Includes

- CLI commands: `collect`, `generate`, `deliver`, `status`, and `run-once`.
- `run-once` order: collect, generate, archive, deliver.
- Rerun behavior that avoids duplicate equivalent Source Items and Signals.
- Operations documentation for 06:00 collection and 07:00 delivery.
- Deployment-neutral scheduler guidance.

### Excludes

- Implementing a scheduler in the repository.
- Control TUI.
- Discord interaction controls.
- Source add/remove/discover commands.

## Acceptance Criteria

- Given the Operational CLI,
  When help output is inspected,
  Then it lists `collect`, `generate`, `deliver`, `status`, and `run-once`,
  Evidence: CLI boundary test plus sample `npm run cli -- --help` output.

- Given a deterministic Source Registry and fixed date,
  When `runOnce` runs,
  Then collection, generation, archive writing, and delivery run in order,
  Evidence: `npm test -- test/agent/daily-workflow.test.ts`.

- Given `runOnce` is repeated for the same Collection Window,
  When the second run completes,
  Then equivalent Source Items and Signals are not duplicated,
  Evidence: `npm test -- test/agent/daily-workflow.test.ts`.

- Given generation and delivery need to be run separately,
  When `generateOnce` and `deliverOnce` run,
  Then generation writes the archive and delivery returns sent/skipped/failed status,
  Evidence: `npm test -- test/agent/daily-workflow.test.ts`.

- Given a maintainer reads operations docs,
  When they look for cadence,
  Then docs state 06:00 collection and 07:00 delivery,
  Evidence: `docs/operations.md`.

- Given a maintainer reads scheduler guidance,
  When they look for deployment expectations,
  Then docs state scheduler integration is deployment-neutral,
  Evidence: `docs/operations.md`.

## Evidence Required

- Commands:
  - `npm test -- test/agent/daily-workflow.test.ts`
  - `npm test -- test/agent/run-once.test.ts`
  - `npm run cli -- --help`
  - `npm run typecheck`
- Tests:
  - Workflow orchestration.
  - Rerun deduplication.
  - Separate generate/deliver.
  - CLI help/command boundary tests.
- Files:
  - `src/cli.ts`
  - `src/agent/daily-brief-agent.ts`
  - `docs/operations.md`
  - `test/agent/daily-workflow.test.ts`
  - `test/agent/run-once.test.ts`
- Logs/status:
  - Sample help output.
  - Sample `run-once` output.

## Human Review Notes

- This should remain scheduler-ready, not scheduler-bound.
- CLI output should be compact enough for humans and predictable enough for scheduled logs.

## Current State Notes

- Existing:
  - `runOnce`, `generateOnce`, and `deliverOnce` exist.
  - Workflow tests cover orchestration, rerun deduplication, and separate generate/deliver.
  - `docs/operations.md` documents cadence and scheduler neutrality.
- Likely gaps:
  - CLI boundary tests and sample command output may need to be added.
  - This issue overlaps Goal 6 and Goal 8 and should be triaged against both.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 3, 4, 14, 15
- Out of Scope Protected:
  - Scheduler implementation.
  - Control TUI.
  - Discord control surface.
- Dependencies:
  - #2
  - #3
  - #4
  - #5
  - #6
  - #7
  - #8
  - #9
