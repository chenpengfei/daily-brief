# Goal 9: Installed CLI Uses User Home Configuration And Data

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/16
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

The installed `daily-brief` command uses user-home configuration and generated-data locations rather than repository-local runtime files, so it can run from an external scheduler without depending on a checkout.

## Scope

### Includes

- Default config home at `~/.daily-brief/`.
- Default data home at `~/.daily-brief/data/`.
- `DAILY_BRIEF_HOME` override for `config.yaml`, `sources.yaml`, and `auth.json`.
- `DAILY_BRIEF_DATA_HOME` override for `source-items/`, `agent-runs/`, and `briefs/`.
- Runtime path resolution shared by CLI, storage, collection, generation, and delivery.
- Repository example file `config/sources.example.yaml`.
- Removal of repository-local `config/sources.yaml` as the default runtime source.

### Excludes

- Setup Wizard prompts.
- Model provider authentication.
- Agent Stage implementation.
- Named profiles.
- Built-in scheduler or Gateway.

## Acceptance Criteria

- Given no environment overrides,
  When the installed CLI resolves paths,
  Then config files resolve under `~/.daily-brief/` and generated artifacts resolve under `~/.daily-brief/data/`,
  Evidence: unit tests cover default path resolution.

- Given `DAILY_BRIEF_HOME` is set,
  When config paths are resolved,
  Then `config.yaml`, `sources.yaml`, and `auth.json` resolve under that directory,
  Evidence: unit tests cover `DAILY_BRIEF_HOME`.

- Given `DAILY_BRIEF_DATA_HOME` is set,
  When artifact paths are resolved,
  Then Source Items, Agent Run Artifacts, and Brief Archive entries resolve under that data root,
  Evidence: unit tests cover `DAILY_BRIEF_DATA_HOME`.

- Given the repository is inspected,
  When source configuration files are listed,
  Then `config/sources.example.yaml` exists and real `config/sources.yaml` is not tracked,
  Evidence: `git status --short` and `git ls-files config` output in completion notes.

## Evidence Required

- Commands:
  - `npm test`
  - `npm run typecheck`
  - `git ls-files config`
- Tests:
  - Path resolution tests for default, `DAILY_BRIEF_HOME`, and `DAILY_BRIEF_DATA_HOME`.
- Files:
  - User home path resolver.
  - Storage path integration.
  - `config/sources.example.yaml`.
- Logs/status:
  - Sample resolved path output from a test or CLI status fixture.

## Human Review Notes

- The path model should feel obvious to a user reading `~/.daily-brief/`.
- Avoid scattering personal runtime files back into the repository.

## Current State Notes

- Existing:
  - `config/sources.example.yaml` exists.
  - `.gitignore` ignores `config/sources.yaml`.
  - Current code still defaults to repository-local paths in several places.
- Likely gaps:
  - A shared installed path resolver does not yet exist.
  - Storage and config loaders likely need to be wired to the new resolver.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Installed CLI, User Configuration Directory, User Data Directory.
- Out of Scope Protected:
  - Named profiles.
  - Gateway or built-in scheduler.
- Dependencies:
  - None.
