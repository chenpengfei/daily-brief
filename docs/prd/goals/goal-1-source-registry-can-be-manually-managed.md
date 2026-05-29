# Goal 1: Source Registry Can Be Manually Managed

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/2
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

The Daily Brief Agent can use a manually maintained Source Registry as the source of truth for collection scope, and the Operational CLI can inspect and explicitly enable or disable configured Sources without autonomous discovery.

## Scope

### Includes

- Loading `config/sources.yaml` as the default Source Registry.
- Validating that each Source has exactly `id`, `platform`, `adapter`, `target`, `enabled`, and `notes`.
- Rejecting missing fields, empty required strings, invalid boolean values, duplicate Source ids, and unknown fields.
- Listing configured Sources through the Operational CLI.
- Enabling and disabling an existing Source by Source id through the Operational CLI.
- Preserving the boundary that Source changes are explicit manual operations.

### Excludes

- Autonomous Source discovery, recommendation, addition, or removal.
- Source priority, source kind, fallback adapters, concrete tool names, automatic discovery rules, or secrets in the Source Registry.
- Fetch Adapter implementation behavior beyond referencing the logical adapter name.
- Collection, brief generation, Discord Delivery, scheduling, or status behavior.

## Acceptance Criteria

- Given the default `config/sources.yaml`,
  When the Source Registry is loaded,
  Then it parses as a valid Source Registry even when `sources` is empty,
  Evidence: `npm test -- test/config/source-registry.test.ts` covers empty registry loading and validation.

- Given a Source with `id`, `platform`, `adapter`, `target`, `enabled`, and `notes`,
  When the Source Registry is parsed,
  Then the Source is accepted with enabled and disabled states preserved,
  Evidence: `npm test -- test/config/source-registry.test.ts` covers valid enabled and disabled Sources.

- Given a Source missing any required field or using an invalid field type,
  When the Source Registry is parsed or loaded,
  Then validation fails with a clear Source Registry validation error and no partial Source is accepted,
  Evidence: `npm test -- test/config/source-registry.test.ts` covers missing required fields, empty required strings, and invalid `enabled` boolean values.

- Given a Source Registry containing fields outside the Source Registry contract, such as `priority`,
  When the Source Registry is parsed,
  Then validation fails and reports that the extra field is not allowed,
  Evidence: `npm test -- test/config/source-registry.test.ts` covers unknown field rejection.

- Given a Source Registry containing duplicate Source ids,
  When the Source Registry is parsed,
  Then validation fails and reports the duplicate Source id,
  Evidence: `npm test -- test/config/source-registry.test.ts` covers duplicate id rejection.

- Given a valid Source Registry on disk,
  When `npm run cli -- sources list` runs,
  Then the CLI exits successfully and prints each Source id with enabled/disabled state, platform, adapter, and target,
  Evidence: `npm test -- test/cli/source-commands.test.ts` covers `sources list`; completion notes include sample command output.

- Given a valid Source Registry with an existing Source id,
  When `npm run cli -- sources disable <source-id>` and `npm run cli -- sources enable <source-id>` run,
  Then the Source's `enabled` value is updated on disk and the rest of the Source definition is preserved,
  Evidence: `npm test -- test/config/source-registry.test.ts` covers on-disk enable/disable behavior; `npm test -- test/cli/source-commands.test.ts` covers command invocation.

- Given a request to enable or disable a Source id that does not exist,
  When `npm run cli -- sources enable <source-id>` or `npm run cli -- sources disable <source-id>` runs,
  Then the CLI exits non-zero with a clear `Source not found` error and does not create a new Source,
  Evidence: `npm test -- test/cli/source-commands.test.ts` covers unknown Source id failure.

- Given this MVP Source Registry contract,
  When Goal 1 is complete,
  Then there is no code path that automatically discovers, adds, removes, or prioritizes Sources,
  Evidence: `npm run cli -- --help` output contains `sources list`, `sources enable`, and `sources disable` but no source add/remove/discover commands; `npm test -- test/config/source-registry.test.ts` rejects unsupported fields such as `priority`.

## Evidence Required

- Commands:
  - `npm test -- test/config/source-registry.test.ts`
  - `npm test -- test/cli/source-commands.test.ts`
  - `npm run typecheck`
  - `npm run cli -- --help`
  - `npm run cli -- sources list`
- Tests:
  - Source Registry parsing and validation tests.
  - On-disk load and enable/disable tests.
  - CLI boundary tests for `sources list`, `sources enable`, `sources disable`, and unknown Source id.
- Files:
  - `config/sources.yaml`
  - `src/domain/source.ts`
  - `src/config/source-registry.ts`
  - `src/cli.ts`
  - `test/config/source-registry.test.ts`
  - `test/cli/source-commands.test.ts`
- Logs/status:
  - Sample CLI output for `sources list`.
  - Sample CLI error for unknown Source id.

## Human Review Notes

- Source Registry error messages should be specific enough for a maintainer to fix YAML without reading the parser code.
- The Source Registry should feel intentionally small and manually controlled, not like a subscription recommendation system.

## Current State Notes

- Existing:
  - `parseSourceRegistry` validates required Source fields, rejects unknown fields, and rejects duplicate Source ids.
  - `loadSourceRegistry` loads YAML from disk.
  - `setSourceEnabled` updates an existing Source's `enabled` value on disk.
  - `formatSourceRegistry` prints Source state and identity fields.
  - `src/cli.ts` exposes `sources list`, `sources enable`, and `sources disable`.
- Likely gaps:
  - CLI boundary tests for `sources list`, `sources enable`, `sources disable`, and unknown Source id.
  - Command-level sample evidence for successful `sources list` and failed unknown Source id.
  - Validation coverage for invalid boolean values and empty required strings may need to be made explicit if not already covered by missing-field tests.
  - `src/cli.ts` may need a testable command boundary or subprocess-based CLI tests if direct invocation remains hard.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 1, 2, 14
- Out of Scope Protected:
  - Open-ended web research.
  - Autonomous Source discovery or Source addition.
  - Creator modeling and cross-platform Creator aggregation.
  - Full external-content mirroring.
- Dependencies:
  - None. This is the first Goal Issue in the suggested execution order.
