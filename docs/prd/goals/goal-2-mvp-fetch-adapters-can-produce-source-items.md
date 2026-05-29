# Goal 2: MVP Fetch Adapters Can Produce Source Items

## Publication Status

- GitHub Issue: Split across https://github.com/chenpengfei/daily-brief/issues/7, https://github.com/chenpengfei/daily-brief/issues/8, and https://github.com/chenpengfei/daily-brief/issues/9
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

Configured RSS, GitHub trend/search, and X-style bounded Sources can be collected through Fetch Adapters that emit normalized Source Items suitable for later collection, Signal selection, citation, and deduplication.

## Scope

### Includes

- RSS and Atom feed targets for Blog Source Items.
- GitHub trend/search style targets from fixture JSON, API-like JSON, or mocked trending HTML.
- X-style account, list, or bounded-search targets from fixture JSON or mocked remote responses.
- Stable Source Item ids based on Source id plus adapter-specific item identity.
- Source Item fields needed by the domain contract: `id`, `sourceId`, `platform`, `url`, `title`, optional `author`, optional `publishedAt`, `fetchedAt`, `analyzableText`, optional `metadata`, and `contentHash`.
- Filtering behavior that keeps Focus Area-relevant X posts and removes reposts without added interpretation.

### Excludes

- Live production credentials, paid APIs, browser automation, or external network dependency in unit tests.
- Source Item Store persistence.
- Signal scoring and Daily Brief generation beyond proving produced items can be consumed by the Brief Module.
- Autonomous Source discovery or Source addition.

## Acceptance Criteria

- Given an RSS feed file with one article,
  When the `rss` Fetch Adapter collects the Source,
  Then it emits one Blog Source Item with stable id, URL, title, author, normalized published time, fetched time, analyzable text with markup stripped, and a 64-character content hash,
  Evidence: `npm test -- test/adapters/rss.test.ts` covers RSS feed entry conversion.

- Given a mocked remote Atom feed,
  When the `rss` Fetch Adapter collects the Source,
  Then it emits an equivalent Blog Source Item from Atom entry fields,
  Evidence: `npm test -- test/adapters/rss.test.ts` covers Atom entry conversion without live network.

- Given a GitHub search/API-style JSON fixture,
  When the `github-trending` Fetch Adapter collects the Source,
  Then it emits GitHub Source Items with repository URL, repository title, owner, pushed time when available, star/fork/watch metadata, momentum text, and content hash,
  Evidence: `npm test -- test/adapters/github-trending.test.ts` covers JSON fixture conversion.

- Given mocked GitHub trending HTML,
  When the `github-trending` Fetch Adapter collects the Source,
  Then it emits GitHub Source Items without requiring live GitHub network access,
  Evidence: `npm test -- test/adapters/github-trending.test.ts` covers mocked trending HTML parsing.

- Given an X-style fixture containing original posts, reposts, replies, and quote posts,
  When the `x` Fetch Adapter collects the Source,
  Then reposts without added interpretation and irrelevant replies are excluded, while Focus Area-relevant originals and quote posts become X Source Items,
  Evidence: `npm test -- test/adapters/x.test.ts` covers X filtering and item conversion.

- Given a mocked remote X-style target,
  When the `x` Fetch Adapter collects the Source,
  Then account/list/search-like remote targets can be exercised without live X network dependency,
  Evidence: `npm test -- test/adapters/x.test.ts` covers mocked remote target collection.

- Given Source Items emitted by each MVP Fetch Adapter,
  When those items are passed to the Brief Module,
  Then relevant items can become Source-grounded Signals with citations,
  Evidence: adapter tests call `generateDailyBrief` with emitted Source Items.

## Evidence Required

- Commands:
  - `npm test -- test/adapters/rss.test.ts`
  - `npm test -- test/adapters/github-trending.test.ts`
  - `npm test -- test/adapters/x.test.ts`
  - `npm run typecheck`
- Tests:
  - RSS and Atom adapter tests.
  - GitHub JSON and mocked trending HTML tests.
  - X fixture and mocked remote target tests.
  - Source Item shape and content hash assertions.
- Files:
  - `src/adapters/rss.ts`
  - `src/adapters/github-trending.ts`
  - `src/adapters/x.ts`
  - `src/adapters/types.ts`
  - `src/domain/source-item.ts`
  - `test/adapters/rss.test.ts`
  - `test/adapters/github-trending.test.ts`
  - `test/adapters/x.test.ts`
- Logs/status:
  - Test output showing all MVP Fetch Adapter tests pass.

## Human Review Notes

- Adapter behavior should stay Source-grounded and conservative; adapters should not turn every platform event into a Signal-worthy item.
- Mocked remote tests are preferred for deterministic coverage; live network confidence can be added later as operational smoke tests, not unit tests.

## Current State Notes

- Existing:
  - RSS adapter supports RSS and Atom.
  - GitHub adapter supports JSON fixtures/API-like payloads and mocked trending HTML.
  - X adapter supports fixture or mocked remote JSON, filters reposts, and keeps Focus Area-relevant originals, replies, and quote posts.
  - Adapter tests assert key Source Item fields and content hashes.
- Likely gaps:
  - Adapter error cases for malformed payloads or non-OK remote responses may need explicit tests.
  - The Source Registry examples/tests may need to consistently use the registered `github-trending` adapter name where collection is expected.
  - YouTube is named in the broader Source Platform vocabulary but is not part of this MVP adapter Goal unless a later PRD adds it.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 2, 5
- Out of Scope Protected:
  - Open-ended web research.
  - Autonomous Source discovery or Source addition.
  - Full external-content mirroring.
- Dependencies:
  - Goal 1: Source Registry Can Be Manually Managed.
