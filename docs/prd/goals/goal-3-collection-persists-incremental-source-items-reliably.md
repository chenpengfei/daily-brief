# Goal 3: Collection Persists Incremental Source Items Reliably

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/3
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

The collection workflow reads enabled Sources, invokes registered Fetch Adapters, writes collected Source Items into the Source Item Store, deduplicates reruns, skips disabled Sources, and records per-Source collection results without letting one Source failure stop the whole run.

## Scope

### Includes

- Loading Sources from a Source Registry path.
- Invoking registered Fetch Adapters for enabled Sources.
- Skipping disabled Sources with an explicit skipped result.
- Writing Source Items as JSONL under `data/source-items/YYYY/MM/YYYY-MM-DD.jsonl`.
- Deduplicating by Source Item id and content hash on rerun.
- Returning per-Source `success`, `skipped`, and `failed` results with item counts and reasons.
- Reading Source Items back from the Source Item Store for later generation.

### Excludes

- Daily Brief generation.
- Discord Delivery.
- Scheduler integration.
- Materiality judgment for partial failures, which belongs to workflow status.
- Fetch Adapter implementation internals beyond invoking registered adapters.

## Acceptance Criteria

- Given a Source Registry with one enabled fixture Source and one disabled Source,
  When collection runs for a fixed date and fetched time,
  Then the enabled Source is collected, the disabled Source is skipped with reason `Source disabled`, and the collected Source Item is written to JSONL,
  Evidence: `npm test -- test/collection/collect.test.ts` covers enabled collection and disabled Source skipping.

- Given a collection run that writes Source Items to the Source Item Store,
  When the stored JSONL is read back,
  Then the Source Item retains id, source id, platform, URL, title, optional author, optional published time, fetched time, analyzable text, and content hash,
  Evidence: `npm test -- test/collection/collect.test.ts` covers persisted item fields; storage tests cover read/write behavior.

- Given the same collection run is repeated for the same Collection Window,
  When collection runs again,
  Then equivalent Source Items are not duplicated and the per-Source result reports skipped duplicates,
  Evidence: `npm test -- test/collection/collect.test.ts` covers rerun deduplication by id/content hash.

- Given a Source references an unregistered Fetch Adapter,
  When collection runs,
  Then that Source result is `failed` with a clear reason and the collection run still resolves,
  Evidence: `npm test -- test/collection/collect.test.ts` covers missing adapter failure without stopping the run.

- Given no Source Items are written for a date,
  When the Source Item Store is read for that date,
  Then it returns an empty list rather than throwing for a missing file,
  Evidence: storage test covers missing daily JSONL behavior.

- Given a malformed Source Item Store record,
  When the Source Item Store is read,
  Then the failure is visible to the caller rather than silently producing corrupted data,
  Evidence: storage test covers malformed JSONL behavior.

## Evidence Required

- Commands:
  - `npm test -- test/collection/collect.test.ts`
  - `npm test -- test/storage/source-item-store.test.ts`
  - `npm run typecheck`
- Tests:
  - Collection run tests for success, skip, failure, and deduplication.
  - Source Item Store tests for path calculation, append/read behavior, missing files, and malformed records.
- Files:
  - `src/collection/collect.ts`
  - `src/storage/source-item-store.ts`
  - `src/adapters/types.ts`
  - `test/collection/collect.test.ts`
  - `test/storage/source-item-store.test.ts`
- Logs/status:
  - Sample collection result showing `success`, `skipped`, and `failed` statuses.

## Human Review Notes

- Collection should be operationally boring: reruns should be safe, and per-Source failures should be easy to inspect without hiding usable data.
- The Source Item Store is machine-readable working data, not the long-term reading surface.

## Current State Notes

- Existing:
  - `collectSources` loads the Source Registry, invokes adapters, skips disabled Sources, records missing adapter failures, and appends Source Items.
  - `appendSourceItems` writes JSONL under date-based paths and deduplicates by id/content hash.
  - `readSourceItems` returns an empty list for missing daily files.
  - `test/collection/collect.test.ts` covers deterministic collection, skipped disabled Source, rerun deduplication, and missing adapter failure.
- Likely gaps:
  - Dedicated `test/storage/source-item-store.test.ts` may need to be added for path calculation, missing file behavior, and malformed JSONL behavior.
  - Collection command boundary evidence belongs to Goal 6 unless this Goal is expanded to include CLI behavior.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 3
- Out of Scope Protected:
  - Full external-content mirroring.
  - Daily Brief content decisions.
  - Scheduler binding to a specific host.
- Dependencies:
  - Goal 1: Source Registry Can Be Manually Managed.
  - Goal 2: MVP Fetch Adapters Can Produce Source Items.
