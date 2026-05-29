# Foundation Slice: Source Item Store And Fixture Fetch Adapter

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/3
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

A deterministic fixture-backed collection slice can collect Source Items, persist them to the Source Item Store, deduplicate reruns, and report Source collection status.

## Scope

### Includes

- Fixture Fetch Adapter for local deterministic Source Items.
- Source Item Store JSONL path `data/source-items/YYYY/MM/YYYY-MM-DD.jsonl`.
- Stable Source Item fields and content hash.
- Deduplication by Source Item id and content hash.
- Collection statuses for success, skipped, and failed Sources.

### Excludes

- RSS, GitHub, or X production adapter behavior.
- Brief generation.
- Discord Delivery.
- Scheduler integration.

## Acceptance Criteria

- Given a Source Registry with one enabled fixture Source,
  When collection runs,
  Then deterministic Source Items are fetched and written to the daily JSONL file,
  Evidence: `npm test -- test/collection/collect.test.ts`.

- Given a collected Source Item,
  When it is read from storage,
  Then it includes stable id, source id, platform, URL, title, optional author, optional published time, fetched time, analyzable text, and content hash,
  Evidence: `npm test -- test/collection/collect.test.ts`.

- Given the same Collection Window is collected twice,
  When the second collection runs,
  Then duplicate Source Items are skipped and not written twice,
  Evidence: `npm test -- test/collection/collect.test.ts`.

- Given a disabled Source,
  When collection runs,
  Then the Source is skipped with reason `Source disabled`,
  Evidence: `npm test -- test/collection/collect.test.ts`.

- Given a missing Fetch Adapter,
  When collection runs,
  Then the Source is reported as failed without stopping the whole collection run,
  Evidence: `npm test -- test/collection/collect.test.ts`.

## Evidence Required

- Commands:
  - `npm test -- test/collection/collect.test.ts`
  - `npm run typecheck`
- Tests:
  - Fixture collection.
  - JSONL persistence.
  - Rerun deduplication.
  - Disabled Source skip.
  - Missing adapter failure.
- Files:
  - `src/adapters/fixture.ts`
  - `src/collection/collect.ts`
  - `src/storage/source-item-store.ts`
  - `test/collection/collect.test.ts`
- Logs/status:
  - Sample collection result with success, skipped, and failed states.

## Human Review Notes

- This is a foundation slice for Goal 3, not the whole collection system.
- Fixture data should make later adapter and brief tests deterministic.

## Current State Notes

- Existing:
  - Fixture adapter and collection tests appear to cover the core behavior.
- Likely gaps:
  - Dedicated storage tests may still be needed under Goal 3.
  - This issue may be ready to close once evidence is confirmed.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 3
- Out of Scope Protected:
  - Full external-content mirroring.
  - Live external network dependency.
- Dependencies:
  - #1
  - #2
