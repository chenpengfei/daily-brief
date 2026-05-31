# Goal 20: NPM-Compatible Package Installs The Daily Brief CLI

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/28
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

Daily Brief can be installed as an npm-compatible CLI package that exposes `daily-brief`, includes setup examples, and runs without a repository checkout.

## Scope

### Includes

- `package.json` `bin` entry for `daily-brief`.
- Build output suitable for installed CLI usage.
- Packaged or embedded setup example data.
- Documentation for installed usage vs development usage.
- Verification through local package install or package tarball workflow.
- Compatibility with GitHub source, GitHub Releases, GitHub Packages, or npm registry distribution.

### Excludes

- Publishing to a public registry as part of this goal.
- Scheduler configuration.
- Native binary packaging.
- GUI installer.

## Acceptance Criteria

- Given the package is built,
  When package metadata is inspected,
  Then it exposes a `daily-brief` bin entry pointing at built CLI output,
  Evidence: package metadata test or `npm pack --dry-run` output.

- Given the package is installed from a local tarball or path,
  When `daily-brief --help` runs outside the repository checkout,
  Then it prints installed CLI help,
  Evidence: install smoke test.

- Given `daily-brief setup` runs from the installed package,
  When example Sources are needed,
  Then the CLI can initialize user files without reading repository-local files,
  Evidence: installed setup smoke test with temp home.

- Given documentation is read,
  When a user wants to run Daily Brief,
  Then installed usage uses `daily-brief ...` and development usage uses `npm run cli -- ...`,
  Evidence: operations or install docs update.

## Evidence Required

- Commands:
  - `npm run build`
  - `npm pack --dry-run`
  - local install smoke command
  - `npm run typecheck`
- Tests:
  - Package/bin metadata test or smoke script.
  - Installed setup example availability test.
- Files:
  - `package.json`
  - Build config
  - Packaged example config
  - Operations/install docs
- Logs/status:
  - Sample installed `daily-brief --help` output.

## Human Review Notes

- The installed package should not accidentally depend on local source tree paths.
- Distribution docs should not over-promise a registry publishing path before it exists.

## Current State Notes

- Existing:
  - CLI source exists.
  - Package is currently private and development-oriented.
- Likely gaps:
  - `bin` and package files may need updates.
  - Build output may not be configured for global install.
  - Example config packaging needs verification.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: npm-compatible CLI package, installed usage.
- Out of Scope Protected:
  - Registry publication.
  - Scheduler setup.
- Dependencies:
  - Goal 10: https://github.com/chenpengfei/daily-brief/issues/22
  - Goal 19: https://github.com/chenpengfei/daily-brief/issues/27
