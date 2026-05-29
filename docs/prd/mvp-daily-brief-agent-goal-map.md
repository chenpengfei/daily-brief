# MVP Daily Brief Agent Goal Map

## PRD Outcome

The MVP Daily Brief Agent monitors manually configured Sources once per day, selects Source-grounded Signals about Agent Architecture and AI Coding, archives a Chinese Markdown Daily Brief, and sends a short Discord notification while preserving clear operational boundaries and failure behavior.

## Proposed Goal Issues

### Goal 1: Source Registry Can Be Manually Managed

The Operational CLI can load, validate, list, enable, and disable manually configured Sources from `config/sources.yaml` without autonomous Source discovery or hidden source fields.

Draft: `docs/prd/goals/goal-1-source-registry-can-be-manually-managed.md`

### Goal 2: MVP Fetch Adapters Can Produce Source Items

Configured RSS, GitHub trend/search, and X-style bounded Sources can be collected through Fetch Adapters that emit normalized Source Items with stable ids, citations, analyzable text, timestamps, and content hashes.

Draft: `docs/prd/goals/goal-2-mvp-fetch-adapters-can-produce-source-items.md`

### Goal 3: Collection Persists Incremental Source Items Reliably

The collection workflow reads enabled Sources, skips disabled Sources, persists Source Items to the Source Item Store, deduplicates reruns by id and content hash, and reports per-Source success, skip, and failure results.

Draft: `docs/prd/goals/goal-3-collection-persists-incremental-source-items-reliably.md`

### Goal 4: Brief Module Generates Source-Grounded Daily Briefs

The Brief Module turns Source Items into Signals, merges repeated mentions into multi-citation Signals, writes the MVP Daily Brief Template in Chinese, explains `why_it_matters`, preserves citations, and states low-signal days without padding.

Draft: `docs/prd/goals/goal-4-brief-module-generates-source-grounded-daily-briefs.md`

### Goal 5: Brief Archive And Discord Delivery Stay Separate

The full Daily Brief is stored in the Markdown Brief Archive, while Discord Delivery sends only a short notification or summary that points to the archived brief.

Draft: `docs/prd/goals/goal-5-brief-archive-and-discord-delivery-stay-separate.md`

### Goal 6: Operational CLI Runs The MVP Workflow

The Operational CLI exposes `collect`, `generate`, `deliver`, `status`, `run-once`, and `sources` commands, and `run-once` exercises the Pi Agent Runtime while running collection, generation, archive, and delivery in order.

Draft: `docs/prd/goals/goal-6-operational-cli-runs-the-mvp-workflow.md`

### Goal 7: Workflow Failure Behavior Is Trustworthy

Partial Source failures are visible only when they materially affect completeness or confidence, while Core Workflow Failures produce a failure notification/status instead of a false Daily Brief.

Draft: `docs/prd/goals/goal-7-workflow-failure-behavior-is-trustworthy.md`

### Goal 8: Daily Cadence Is Scheduler-Ready

The repository defines the expected 06:00 collection and 07:00 delivery cadence in deployment-neutral operational docs, and the CLI commands are safe to invoke from cron, launchd, systemd timers, GitHub Actions, or another scheduler.

Draft: `docs/prd/goals/goal-8-daily-cadence-is-scheduler-ready.md`

## User Story Coverage

| PRD User Story | Covered By | Status |
| --- | --- | --- |
| 1. Define Sources manually | Goal 1 | Covered |
| 2. Support accounts, feeds, GitHub trend/search entries, X.com targets, topics, and bounded searches | Goal 1, Goal 2 | Covered |
| 3. Collect updates once per day at 06:00 | Goal 3, Goal 8 | Covered |
| 4. Push the brief at 07:00 | Goal 5, Goal 8 | Covered |
| 5. Focus on Agent Architecture and AI Coding | Goal 2, Goal 4 | Covered |
| 6. Explain why each Signal matters | Goal 4 | Covered |
| 7. Cite Source Items for each Signal | Goal 4 | Covered |
| 8. Merge repeated mentions into one Signal with multiple citations | Goal 4 | Covered |
| 9. State low-signal days plainly | Goal 4 | Covered |
| 10. Show partial collection failures only when they affect confidence | Goal 7 | Covered |
| 11. Send failure notification instead of false brief on core workflow failures | Goal 7 | Covered |
| 12. Keep a Markdown Brief Archive | Goal 5 | Covered |
| 13. Keep Discord limited to short notification or summary | Goal 5 | Covered |
| 14. Provide an Operational CLI for MVP control | Goal 1, Goal 6 | Covered |
| 15. Build on the Pi Agent Runtime | Goal 6 | Covered |

## Out Of Scope Protection

The Goal Issues must preserve these PRD boundaries:

- No open-ended web research.
- No autonomous Source discovery, addition, or removal.
- No Reader Feedback or Feedback Review.
- No Control TUI.
- No Creator model or cross-platform Creator aggregation.
- No Cross-Signal Research Themes.
- No separate Source Fact extraction layer.
- No separate Signal Cluster data model.
- No Discord interaction controls.
- No full external-content mirroring.

## Known Dependencies

- Goal 1 must exist before collection goals can use real Source Registry inputs.
- Goal 2 depends on the Source and Source Item domain contracts from Goal 1.
- Goal 3 depends on Goal 2 for collected Source Items.
- Goal 4 depends on Source Items from Goal 3, but can be developed against fixtures.
- Goal 5 depends on Goal 4 for generated Daily Brief content.
- Goal 6 depends on Goals 1, 3, 4, and 5 for end-to-end CLI behavior.
- Goal 7 depends on collection, generation, archive, and delivery boundaries being explicit.
- Goal 8 depends on stable CLI command contracts from Goal 6.

## Suggested Execution Order

1. Goal 1: Source Registry Can Be Manually Managed
2. Goal 2: MVP Fetch Adapters Can Produce Source Items
3. Goal 3: Collection Persists Incremental Source Items Reliably
4. Goal 4: Brief Module Generates Source-Grounded Daily Briefs
5. Goal 5: Brief Archive And Discord Delivery Stay Separate
6. Goal 7: Workflow Failure Behavior Is Trustworthy
7. Goal 6: Operational CLI Runs The MVP Workflow
8. Goal 8: Daily Cadence Is Scheduler-Ready

Goal 6 appears late because the command surface should prove already-defined behavior rather than invent it. Goal 8 should remain documentation and command-contract work unless a later PRD explicitly chooses a scheduler implementation.
