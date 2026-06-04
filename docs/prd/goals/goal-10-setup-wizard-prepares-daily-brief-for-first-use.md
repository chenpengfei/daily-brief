# Goal 10: Setup Wizard Prepares Daily Brief For First Use

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/22
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

`daily-brief setup` provides the first-use Setup Wizard, creates required user files and data directories, initializes Sources from the packaged example, guides model provider and optional delivery configuration in one interactive flow, preserves existing files by default during reconfiguration, and ends with a readiness check without running the daily workflow.

## Scope

### Includes

- Interactive `daily-brief setup` command.
- Creation of `config.yaml`, `sources.yaml`, `auth.json`, and generated data root.
- Initialization of `sources.yaml` from packaged or embedded example Sources.
- Fixed first-version `brief.language: zh`.
- Guidance to edit the user-home Source Registry YAML and validate it.
- Guided LLM Provider, credential, and optional Discord Delivery configuration inside setup.
- Readiness check at the end of setup.
- Reentrant setup with explicit preserve-or-update prompts that avoid deleting credentials or generated data.
- Non-interactive setup failure with actionable file/environment-variable configuration guidance.

### Excludes

- Running collection, model calls, brief generation, or delivery during setup.
- Built-in scheduler configuration or scheduler-specific guidance.
- Full model provider transport implementation beyond the model configuration internals.
- Field-by-field interactive Source add/edit wizard.
- Delivery Channel credential internals beyond setup-managed Discord configuration.
- `--force` or any force-overwrite setup flag.
- Fine-grained config merge or partial replacement semantics beyond explicit preserve or update.
- Named profiles.

## Acceptance Criteria

- Given a fresh user home,
  When `daily-brief setup` completes,
  Then user config files and data directories exist with valid initial contents,
  Evidence: CLI integration test using a temporary `DAILY_BRIEF_HOME` and `DAILY_BRIEF_DATA_HOME`.

- Given setup runs interactively,
  When `daily-brief setup` runs,
  Then setup can initialize Sources, show the Source Registry edit/validate path, and guide LLM Provider configuration plus optional Discord Delivery configuration from one flow,
  Evidence: setup integration test with prompt-backed model and delivery choices.

- Given setup is rerun with existing files,
  When the user keeps existing values,
  Then existing values and credentials are preserved by default and generated data is not deleted,
  Evidence: setup reentrancy test.

- Given setup is invoked with `--force`,
  When the command runs,
  Then it fails clearly because setup does not accept force-overwrite flags,
  Evidence: setup command-boundary test.

- Given setup completes,
  When readiness validation runs,
  Then it reports config file status, Source Registry parse status, model readiness, delivery enabled/disabled state, and data writability without running `collect`, `generate`, or `deliver`,
  Evidence: setup test asserts readiness output and absence of workflow side effects.

## Evidence Required

- Commands:
  - `npm test -- test/cli`
  - `npm run typecheck`
- Tests:
  - Setup fresh-home test.
  - Setup prompt-backed model and delivery configuration test.
  - Setup reentrant test.
  - Setup non-interactive failure test.
  - Setup `--force` rejection test.
  - Readiness check test.
- Files:
  - CLI setup command.
  - User config writers.
  - Packaged or embedded source example.
- Logs/status:
  - Sample setup summary with secrets redacted.

## Human Review Notes

- The wizard should feel safe: no surprise overwrites, no hidden network/model calls, and no secret leakage.
- Reconfiguration should be intentionally simple: skip or overwrite, never merge silently.
- Prompts should be concise enough for a technical user to complete quickly.

## Current State Notes

- Existing:
  - CLI command framework exists.
  - Source Registry parser exists.
  - `config/sources.example.yaml` exists.
- Likely gaps:
  - Older docs and goal maps may still mention separate public model/delivery commands.
  - Setup prompt copy and readiness output may need product review after implementation.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Setup Wizard, Installation and User Configuration.
- Out of Scope Protected:
  - Scheduler-specific setup.
  - Automatic daily workflow execution during setup.
  - Fine-grained config merge.
- Dependencies:
  - Goal 9: https://github.com/chenpengfei/daily-brief/issues/16
  - Goal 11: https://github.com/chenpengfei/daily-brief/issues/17
  - Goal 12: https://github.com/chenpengfei/daily-brief/issues/18
  - Goal 21: https://github.com/chenpengfei/daily-brief/issues/20
