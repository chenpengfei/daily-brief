# Goal 2 Slice: GitHub Trending Fetch Adapter

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/8
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

Configured GitHub trend/search Sources can use the `github-trending` Fetch Adapter to collect meaningful repository candidates as GitHub Source Items without treating ordinary commits as Source Items.

## Scope

### Includes

- GitHub search/API-style JSON fixtures.
- Mocked GitHub trending HTML responses.
- Repository URL, name, owner, description, star/fork/watch metrics, momentum text, and content hash.
- `tool-repo` or architecture-compatible Signal generation.
- Explicit exclusion of ordinary commit streams.

### Excludes

- Live GitHub network dependency in unit tests.
- Full repository mirroring.
- Ordinary commit collection.
- Source Registry management.

## Acceptance Criteria

- Given a GitHub search/API-style JSON fixture,
  When the `github-trending` adapter collects the Source,
  Then it emits GitHub Source Items with repository identity, metrics, owner, pushed time, momentum text, and content hash,
  Evidence: `npm test -- test/adapters/github-trending.test.ts`.

- Given mocked GitHub trending HTML,
  When the `github-trending` adapter collects the Source,
  Then it emits repository Source Items without live GitHub network access,
  Evidence: `npm test -- test/adapters/github-trending.test.ts`.

- Given repository metrics include current and previous stars or stars today,
  When analyzable text is built,
  Then momentum is described in analyzable text,
  Evidence: `npm test -- test/adapters/github-trending.test.ts`.

- Given a GitHub candidate from this adapter,
  When it enters the Brief Module,
  Then it can become a `tool-repo` Signal,
  Evidence: `npm test -- test/adapters/github-trending.test.ts`.

- Given ordinary commits are not part of the MVP GitHub Source Item definition,
  When the adapter builds analyzable text,
  Then it explicitly states ordinary commits are not treated as Source Items,
  Evidence: `npm test -- test/adapters/github-trending.test.ts`.

## Evidence Required

- Commands:
  - `npm test -- test/adapters/github-trending.test.ts`
  - `npm run typecheck`
- Tests:
  - JSON fixture conversion.
  - Mocked trending HTML conversion.
  - Momentum text.
  - Ordinary commit exclusion.
  - Brief Module compatibility assertion.
- Files:
  - `src/adapters/github-trending.ts`
  - `test/adapters/github-trending.test.ts`
- Logs/status:
  - Test output showing GitHub adapter tests pass.

## Human Review Notes

- The adapter should capture repository-level signals, not every repository event.
- Trend/search support should remain bounded by configured Source Targets.

## Current State Notes

- Existing:
  - JSON fixture and mocked trending HTML tests already exist.
  - The adapter emits metrics and momentum text.
- Likely gaps:
  - Error cases for malformed GitHub payloads and failed remote responses may need explicit tests.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 2, 5
- Out of Scope Protected:
  - Ordinary commit stream collection.
  - Full repository mirroring.
  - Live network dependency in unit tests.
- Dependencies:
  - #2
  - #3
  - #4
