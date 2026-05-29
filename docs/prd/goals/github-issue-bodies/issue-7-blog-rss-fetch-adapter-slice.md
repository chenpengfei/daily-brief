# Goal 2 Slice: Blog/RSS Fetch Adapter

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/7
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

Configured Blog Sources can use the `rss` Fetch Adapter to collect RSS or Atom feed entries as normalized Blog Source Items that can feed Source-grounded Daily Brief generation.

## Scope

### Includes

- RSS feed entry parsing.
- Atom entry parsing.
- Local fixture and mocked remote response tests.
- Source Item fields for URL, title, author, published time, fetched time, analyzable text, and content hash.
- Markup stripping from analyzable text.
- Proof that Blog Source Items can enter Daily Brief Signal generation.

### Excludes

- Live network dependency in tests.
- Source Registry management.
- Source Item Store persistence.
- Discord Delivery.

## Acceptance Criteria

- Given an RSS feed file with one article,
  When the `rss` adapter collects the Source,
  Then it emits one Blog Source Item with normalized fields and content hash,
  Evidence: `npm test -- test/adapters/rss.test.ts`.

- Given a mocked remote Atom feed,
  When the `rss` adapter collects the Source,
  Then it emits one Blog Source Item using Atom title, alternate link, author, updated time, and summary,
  Evidence: `npm test -- test/adapters/rss.test.ts`.

- Given feed content with markup,
  When the Source Item is emitted,
  Then analyzable text is stripped to readable plain text,
  Evidence: `npm test -- test/adapters/rss.test.ts`.

- Given emitted Blog Source Items relevant to Agent Architecture or AI Coding,
  When the Brief Module receives them,
  Then they can become cited Top Signals,
  Evidence: `npm test -- test/adapters/rss.test.ts` calls `generateDailyBrief`.

## Evidence Required

- Commands:
  - `npm test -- test/adapters/rss.test.ts`
  - `npm run typecheck`
- Tests:
  - RSS fixture conversion.
  - Atom mocked remote conversion.
  - Source Item shape and hash assertions.
  - Brief Module compatibility assertion.
- Files:
  - `src/adapters/rss.ts`
  - `test/adapters/rss.test.ts`
- Logs/status:
  - Test output showing RSS adapter tests pass.

## Human Review Notes

- RSS/Atom behavior should remain deterministic and easy to debug.
- Adapter tests should not depend on live feeds.

## Current State Notes

- Existing:
  - RSS and Atom tests already exist.
  - The adapter emits content hashes and supports local and mocked remote targets.
- Likely gaps:
  - Explicit non-OK remote response and malformed feed tests may be worth adding during triage.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 2, 5
- Out of Scope Protected:
  - Live external network dependency in unit tests.
  - Autonomous Source discovery.
- Dependencies:
  - #2
  - #3
  - #4
