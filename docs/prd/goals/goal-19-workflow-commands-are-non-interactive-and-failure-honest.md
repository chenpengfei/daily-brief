# Goal 19: Workflow Commands Are Non-Interactive And Failure-Honest

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/27
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

Workflow commands run safely under external schedulers, support date-based replay, preserve partial collection failure context, keep Delivery optional, and report Core Workflow Failure, Analysis Failure, low-signal days, and recent run state honestly.

## Scope

### Includes

- Non-interactive `run-once` and `status`.
- `--date YYYY-MM-DD` for workflow commands.
- Default date resolution using the runtime system timezone.
- Partial collection failure propagation into generation and Source Coverage.
- Full collection failure behavior.
- Analysis Failure behavior with no normal Brief Archive entry.
- `status` with Configuration readiness and Recent Run state.
- `run-once` orchestration of collect and generate, with `deliver` invoked only when Delivery is enabled.

### Excludes

- Interactive setup or configuration prompts in workflow commands.
- Built-in scheduler.
- Gateway.
- Rule-based production fallback when Agent Stages fail.
- Rich Delivery notification rendering or workflow failure notifications.

## Acceptance Criteria

- Given workflow commands run without config,
  When user configuration is missing,
  Then commands fail non-interactively with an actionable `daily-brief setup` message,
  Evidence: CLI failure test.

- Given `--date YYYY-MM-DD`,
  When `run-once` runs,
  Then the command uses that date's Source Item Store, Agent Run Artifact path, Brief Archive path, and optional delivery target when Delivery is enabled,
  Evidence: CLI date option tests.

- Given Delivery is disabled,
  When `run-once` completes collection and generation successfully,
  Then the Brief Archive entry is written and delivery is skipped without turning the run into a failure,
  Evidence: workflow optional-delivery test.

- Given some Sources fail but usable Source Items exist,
  When `run-once` runs,
  Then generation continues and partial failures appear in Agent Run Artifact and Source Coverage,
  Evidence: workflow partial failure test.

- Given all enabled Sources fail and no usable Source Items exist,
  When `run-once` runs,
  Then it reports failure rather than a low-signal brief,
  Evidence: workflow failure test.

- Given an Agent Stage fails validation or audit,
  When `generate` runs,
  Then an Analysis Failure is recorded and no normal Brief Archive entry is written,
  Evidence: Analysis Failure workflow test.

- Given `status` runs,
  When configuration and prior runs exist,
  Then it prints Configuration readiness and Recent Run state without secrets,
  Evidence: status command test.

## Evidence Required

- Commands:
  - `npm test -- test/cli`
  - `npm test -- test/agent/daily-workflow.test.ts`
  - `npm test -- test/workflow`
  - `npm run typecheck`
- Tests:
  - Non-interactive missing config test.
  - Date option tests.
  - Partial collection failure tests.
  - Analysis Failure tests.
  - Optional delivery disabled test.
  - Status output tests.
- Files:
  - CLI workflow commands.
  - Workflow orchestration.
  - Status module.
- Logs/status:
  - Sample `daily-brief status` output.

## Human Review Notes

- Failure messages should help a sleeping future maintainer fix the right layer quickly.
- Scheduled execution must never hang waiting for input.
- Delivery should remain optional; lack of a webhook must not block collection, generation, or archiving.

## Current State Notes

- Existing:
  - Workflow commands already exist in development form.
  - Status module exists.
- Likely gaps:
  - Commands still use repo-local defaults.
  - Agent-driven Analysis Failure does not exist.
  - `status` does not yet include the new readiness/recent-run split.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Scheduler Boundary, Failure Behavior, Status Output.
- Out of Scope Protected:
  - Setup prompts in workflow commands.
  - Built-in scheduler.
  - Rich Delivery notification rendering.
  - Workflow failure notification delivery.
- Dependencies:
  - Goal 10: https://github.com/chenpengfei/daily-brief/issues/22
  - Goal 13: https://github.com/chenpengfei/daily-brief/issues/19
  - Goal 17: https://github.com/chenpengfei/daily-brief/issues/25
  - Goal 18: https://github.com/chenpengfei/daily-brief/issues/26
  - Goal 21: https://github.com/chenpengfei/daily-brief/issues/20
