# Goal 12: Source Registry Is User-Managed Outside The Repository

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/18
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

The real Source Registry lives in the user's Daily Brief home, while the repository ships only examples, and the CLI exposes simple Source Registry operations without a separate Source Registry path override.

## Scope

### Includes

- Default Source Registry at `~/.daily-brief/sources.yaml`.
- `DAILY_BRIEF_HOME`-derived Source Registry path.
- Repository example at `config/sources.example.yaml`.
- `daily-brief sources list`.
- `daily-brief sources edit` as a simple open-or-print-path command for the user-home registry.
- `daily-brief sources enable`.
- `daily-brief sources disable`.
- `daily-brief sources validate`.
- Manual YAML editing supported through validation.

### Excludes

- Separate Source Registry path override.
- Repository-committed personal `config/sources.yaml`.
- Autonomous Source discovery.
- Field-by-field interactive Source add/edit wizard.
- Secrets, priorities, model config, or adapter implementation details in Source Registry.

## Acceptance Criteria

- Given no overrides,
  When Sources are loaded,
  Then the CLI reads `~/.daily-brief/sources.yaml`,
  Evidence: path resolution test.

- Given `DAILY_BRIEF_HOME` is set,
  When Sources are loaded,
  Then the CLI reads `sources.yaml` from that home,
  Evidence: path resolution test.

- Given the repository is inspected,
  When config files are listed,
  Then `config/sources.example.yaml` is tracked and `config/sources.yaml` is not tracked,
  Evidence: `git ls-files config` output.

- Given a user edits `sources.yaml`,
  When `daily-brief sources validate` runs,
  Then schema errors are reported clearly without modifying the file,
  Evidence: CLI validation test.

- Given a valid user-home Source Registry,
  When `daily-brief sources list` runs,
  Then it prints configured Sources from `~/.daily-brief/sources.yaml` without reading repository-local personal Sources,
  Evidence: CLI list test with temporary `DAILY_BRIEF_HOME`.

- Given `daily-brief sources edit` runs,
  When the user wants to change Sources,
  Then the CLI opens or prints the user-home `sources.yaml` path and instructs the user to run `sources validate` after editing,
  Evidence: CLI edit command test.

- Given a Source exists,
  When `daily-brief sources enable` or `daily-brief sources disable` runs,
  Then only that Source's enabled state changes and the rest of the registry is preserved,
  Evidence: CLI enable/disable tests.

## Evidence Required

- Commands:
  - `npm test -- test/config`
  - `npm test -- test/cli`
  - `npm run typecheck`
  - `git ls-files config`
- Tests:
  - User home Source Registry loading.
  - Source list/edit/enable/disable command tests.
  - Validation failure tests.
- Files:
  - Source Registry loader.
  - CLI source commands.
  - `config/sources.example.yaml`.
- Logs/status:
  - Sample `sources validate` output.

## Human Review Notes

- The Source Registry should feel personal and safe to keep out of Git.
- CLI Source editing should make it obvious that the file is plain YAML and validation is the safety net.

## Current State Notes

- Existing:
  - Source Registry schema/parser exists.
  - Source commands exist for list/enable/disable.
  - `config/sources.example.yaml` exists.
- Likely gaps:
  - Default source path still needs to move to user home.
  - Edit/validate commands may not exist.
  - Source Registry path should come from `DAILY_BRIEF_HOME`, not from a separate path override.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Source Registry, User Configuration Directory.
- Out of Scope Protected:
  - Source discovery.
  - Repository-local personal Sources.
  - Field-by-field interactive Source add/edit wizard.
- Dependencies:
  - Goal 9: https://github.com/chenpengfei/daily-brief/issues/16
