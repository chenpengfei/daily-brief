# Goal 2 Slice: X.com Fetch Adapter

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/9
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

Configured X-style account, list, or bounded-search Sources can use the `x` Fetch Adapter to collect relevant original, quote, or reply posts as X Source Items while filtering reposts without added interpretation.

## Scope

### Includes

- Fixture and mocked remote JSON targets.
- Original, repost, quote, and reply post handling.
- Filtering for Agent Architecture and AI Coding relevance.
- Source Item fields for URL, title, author, published time, fetched time, analyzable text, metadata, and content hash.
- Preserving original links for citations.

### Excludes

- Live X network dependency in unit tests.
- Open-ended X discovery.
- Source Registry management.
- Browser automation unless hidden inside future adapter implementation.

## Acceptance Criteria

- Given an X fixture with original posts, reposts, replies, and quote posts,
  When the `x` adapter collects the Source,
  Then relevant originals and quote posts become X Source Items while reposts without added interpretation and irrelevant replies are excluded,
  Evidence: `npm test -- test/adapters/x.test.ts`.

- Given a quote post with added text and quoted context,
  When the adapter emits a Source Item,
  Then analyzable text includes the added perspective and quoted context,
  Evidence: `npm test -- test/adapters/x.test.ts`.

- Given a mocked remote account/list/search target,
  When the adapter collects the Source,
  Then it emits Source Items without live X network dependency,
  Evidence: `npm test -- test/adapters/x.test.ts`.

- Given emitted X Source Items relevant to Agent Architecture or AI Coding,
  When the Brief Module receives them,
  Then they can become cited Top Signals,
  Evidence: `npm test -- test/adapters/x.test.ts` calls `generateDailyBrief`.

- Given a Source Registry entry for X collection,
  When the Source is configured,
  Then the registry stores only the logical adapter name and target, not concrete scraping tool names,
  Evidence: Source Registry validation rejects unsupported concrete-tool fields under #2.

## Evidence Required

- Commands:
  - `npm test -- test/adapters/x.test.ts`
  - `npm run typecheck`
- Tests:
  - Fixture post filtering.
  - Quote/reply relevance behavior.
  - Mocked remote target collection.
  - Brief Module compatibility assertion.
- Files:
  - `src/adapters/x.ts`
  - `test/adapters/x.test.ts`
- Logs/status:
  - Test output showing X adapter tests pass.

## Human Review Notes

- X adapter behavior should stay conservative; reposts without added perspective should not create noise.
- The concrete collection mechanism can evolve later without changing Source Registry language.

## Current State Notes

- Existing:
  - X adapter fixture and mocked remote tests already exist.
  - Repost filtering and quote context handling are covered.
- Likely gaps:
  - Error cases for malformed X payloads and failed remote responses may need explicit tests.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 2, 5
- Out of Scope Protected:
  - Open-ended X discovery.
  - Live network dependency in unit tests.
  - Concrete scraping tool names in Source Registry.
- Dependencies:
  - #2
  - #3
  - #4
