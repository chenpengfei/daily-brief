# Goal 8: Daily Cadence Is Scheduler-Ready

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/10
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

The repository documents the MVP Daily Brief Cadence and exposes stable CLI commands that can be invoked by an external scheduler without binding the product to a specific host or scheduling technology.

## Scope

### Includes

- Documenting the expected local cadence: collection at 06:00 and delivery at 07:00.
- Documenting that scheduler integration is deployment-neutral.
- Identifying supported scheduler options such as cron, launchd, systemd timers, GitHub Actions, or another scheduler.
- Ensuring the commands required by a scheduler are stable and documented: `collect`, `generate`, `deliver`, `status`, and `run-once`.
- Documenting rerun behavior so repeated scheduled invocations do not duplicate equivalent Source Items or Signals.

### Excludes

- Implementing a scheduler inside the repository.
- Choosing cron, launchd, systemd, GitHub Actions, or any other host-specific scheduler as the MVP default.
- Real-time polling or alerts.
- V2 Control TUI behavior.

## Acceptance Criteria

- Given the MVP operations documentation,
  When a maintainer reads it,
  Then it states that collection runs at 06:00 local time and delivery runs at 07:00 local time,
  Evidence: `docs/operations.md` contains the cadence.

- Given the MVP operations documentation,
  When a maintainer reads scheduler guidance,
  Then it states that scheduler integration is deployment-neutral and may be handled by cron, launchd, systemd timer, GitHub Actions, or another scheduler,
  Evidence: `docs/operations.md` contains deployment-neutral scheduler guidance.

- Given a scheduler wants to run the MVP workflow,
  When it invokes CLI commands,
  Then `collect`, `generate`, `deliver`, `status`, and `run-once` are documented as supported commands,
  Evidence: `docs/operations.md` and `npm run cli -- --help` list the supported commands.

- Given scheduled commands are rerun for the same Collection Window,
  When `run-once` or collection is repeated,
  Then equivalent Source Items and Signals are not duplicated,
  Evidence: `npm test -- test/collection/collect.test.ts` and `npm test -- test/agent/daily-workflow.test.ts` cover rerun deduplication.

- Given Goal 8 is complete,
  When a maintainer looks for scheduler source files or workflow configuration,
  Then no specific scheduler implementation is required by the MVP,
  Evidence: documentation states scheduler neutrality; review notes confirm no mandatory scheduler config was added.

## Evidence Required

- Commands:
  - `npm test -- test/collection/collect.test.ts`
  - `npm test -- test/agent/daily-workflow.test.ts`
  - `npm run cli -- --help`
  - `npm run typecheck`
- Tests:
  - Rerun deduplication tests.
  - CLI help or command contract tests from Goal 6.
- Files:
  - `docs/operations.md`
  - `src/cli.ts`
  - `test/collection/collect.test.ts`
  - `test/agent/daily-workflow.test.ts`
- Logs/status:
  - Sample CLI help output.
  - Documentation excerpt or link showing 06:00/07:00 cadence and scheduler neutrality.

## Human Review Notes

- Cadence documentation should be direct enough that a maintainer can wire their preferred scheduler without reverse-engineering the CLI.
- Do not over-design deployment before the local MVP workflow is reliable.

## Current State Notes

- Existing:
  - `docs/operations.md` documents `collect`, `generate`, `deliver`, `status`, and `run-once`.
  - `docs/operations.md` states 06:00 collection and 07:00 delivery.
  - `docs/operations.md` states scheduler integration is deployment-neutral.
  - Collection and workflow tests cover rerun deduplication.
- Likely gaps:
  - CLI help should be kept in sync with operations docs through Goal 6 tests.
  - If a future PRD chooses a scheduler implementation, this Goal should be revised rather than silently adding scheduler config.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 3, 4
- Out of Scope Protected:
  - Continuous polling.
  - Real-time alerts.
  - Binding the MVP to a specific scheduler or host.
- Dependencies:
  - Goal 6: Operational CLI Runs The MVP Workflow.
