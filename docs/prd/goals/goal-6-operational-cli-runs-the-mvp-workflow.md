# Goal 6: Operational CLI Runs The MVP Workflow

## Publication Status

- GitHub Issue: Covered by https://github.com/chenpengfei/daily-brief/issues/1 and https://github.com/chenpengfei/daily-brief/issues/10
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

The Operational CLI exposes the MVP control surface for setup, Manual Runs, status, version reporting, and Source management, while `run-once` internally performs collection, generation, archive writing, and delivery in order.

## Scope

### Includes

- CLI commands: `setup`, `run-once`, `status`, `version`, `sources list`, `sources edit`, `sources validate`, `sources enable <source-id>`, and `sources disable <source-id>`.
- Help output listing all supported commands.
- Non-zero exit behavior for unknown commands and invalid source commands.
- `run-once` orchestration of collection, brief generation, archive writing, and Discord Delivery.
- Pi Agent Runtime participation in Daily Brief rendering, surfaced as human-readable Agent Stage progress by default.
- Command-level output that reports archive path, source counts, Source Item counts, delivery status, collection summaries, and Source ID guidance where applicable.

### Excludes

- Chat-based Control TUI.
- Natural-language control or skill routing.
- Scheduler implementation.
- Discord command handling.
- Adding or removing Sources through the CLI.

## Acceptance Criteria

- Given the installed project,
  When `npm run cli -- --help` runs,
  Then help output lists the supported public commands and omits `collect`, `generate`, `deliver`, `model`, and `delivery`,
  Evidence: `npm test -- test/cli/help.test.ts` or CLI boundary test covers help output; completion notes include sample output.

- Given an unknown command,
  When `npm run cli -- unknown-command` runs,
  Then the CLI exits non-zero with a clear `Unknown command` error,
  Evidence: CLI boundary test covers unknown command behavior.

- Given an invalid `sources` subcommand or missing Source id for enable/disable,
  When the CLI command runs,
  Then it exits non-zero with a clear error and does not modify the Source Registry,
  Evidence: CLI boundary test covers invalid source command behavior.

- Given a deterministic Source Registry, Source Item root, archive root, and fixed date,
  When the workflow-level `runOnce` path runs,
  Then collection, generation, archive writing, and delivery run in order, reruns do not duplicate equivalent Signals, and delivery status is reported,
  Evidence: `npm test -- test/agent/daily-workflow.test.ts` covers end-to-end workflow orchestration.

- Given no Sources are configured,
  When `runOnce` runs through the Pi Agent Runtime,
  Then the workflow reports failure honestly rather than archiving a false normal Daily Brief,
  Evidence: CLI and agent workflow tests cover no-usable-source failure behavior.

- Given `run-once` is executing,
  When collection and Agent Stages progress,
  Then the CLI prints human-readable phase output without raw Pi event names by default,
  Evidence: CLI run-once output test.

- Given the CLI `status` command runs,
  When Operational Status is available,
  Then it prints health and any material partial failures,
  Evidence: CLI boundary test for `status` plus `npm test -- test/workflow/status.test.ts`.

## Evidence Required

- Commands:
  - `npm test -- test/agent/run-once.test.ts`
  - `npm test -- test/agent/daily-workflow.test.ts`
  - `npm test -- test/workflow/status.test.ts`
  - `npm test -- test/cli`
  - `npm run typecheck`
  - `npm run cli -- --help`
  - `npm run cli -- --version`
- Tests:
  - CLI boundary tests for help, unknown command, status, run-once output, and source subcommands.
  - Workflow orchestration tests.
  - Human-readable run-once progress output test.
- Files:
  - `src/cli.ts`
  - `src/agent/daily-brief-agent.ts`
  - `src/workflow/status.ts`
  - `test/agent/run-once.test.ts`
  - `test/agent/daily-workflow.test.ts`
  - `test/cli`
- Logs/status:
  - Sample help output.
  - Sample version output.
  - Sample `run-once` output.
  - Sample `status` output.

## Human Review Notes

- CLI output should be compact, predictable, and useful for manual MVP operation.
- The Operational CLI should remain a control surface, not a chat product.

## Current State Notes

- Existing:
  - `src/cli.ts` exposes the intended commands.
  - `runOnce`, `generateOnce`, and `deliverOnce` exist in `src/agent/daily-brief-agent.ts`.
  - Workflow tests cover run-once orchestration, rerun deduplication, internal generate/deliver behavior, skipped delivery, and Pi runtime events.
  - `getOperationalStatus` supports the status command.
- Likely gaps:
  - Dedicated CLI boundary tests appear to be missing.
  - `src/cli.ts` may need refactoring to make command execution testable without spawning a process.
  - Command-level evidence for help, unknown command, `run-once`, and `status` still needs to be captured.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 14, 15
- Out of Scope Protected:
  - Control TUI.
  - Natural-language control and skill routing.
  - Discord control surface.
- Dependencies:
  - Goal 1: Source Registry Can Be Manually Managed.
  - Goal 3: Collection Persists Incremental Source Items Reliably.
  - Goal 4: Brief Module Generates Source-Grounded Daily Briefs.
  - Goal 5: Brief Archive And Discord Delivery Stay Separate.
