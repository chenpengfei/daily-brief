# MVP Daily Brief Agent PRD

## Problem Statement

As an Agent architect, I need a dependable daily workflow that monitors the Sources I choose, identifies updates relevant to Agent Architecture and AI Coding, and pushes a concise Daily Brief at a fixed time. I do not want a generic news feed, autonomous source discovery, or an open-ended research agent; I want a Source-grounded system that helps me decide what is worth reading each morning.

## Solution

Build a Daily Brief Agent on TypeScript, Node.js, and the Pi Agent Runtime. The MVP reads a manually maintained Source Registry, collects Source Items once per day, selects high-value Signals, writes a Markdown Daily Brief, and sends a short Discord notification. The full brief is stored in the Brief Archive; Discord is only a notification channel.

## User Stories

1. As an Agent architect, I want to define Sources manually, so that the agent only monitors origins I have approved.
2. As an Agent architect, I want Sources to support accounts, feeds, GitHub trend/search entries, X.com targets, topics, and bounded searches, so that I can monitor both known experts and dynamic project lists.
3. As an Agent architect, I want the system to collect updates once per day at 06:00, so that the morning brief is based on fresh but bounded data.
4. As an Agent architect, I want the brief pushed at 07:00, so that I can read it as part of a daily routine.
5. As an Agent architect, I want the agent to focus on Agent Architecture and AI Coding, so that unrelated AI news does not dilute the brief.
6. As an Agent architect, I want each Signal to explain why it matters, so that I can quickly decide whether to read the source.
7. As an Agent architect, I want each Signal to cite Source Items, so that I can trace judgments back to original material.
8. As an Agent architect, I want repeated mentions to appear as one Signal with multiple citations, so that duplicate coverage does not waste brief space.
9. As an Agent architect, I want low-signal days to be stated plainly, so that the agent does not pad the brief with weak material.
10. As an Agent architect, I want partial collection failures to be visible only when they affect confidence, so that operational noise does not dominate the brief.
11. As an Agent architect, I want core workflow failures to send a failure notification instead of a false brief, so that I can trust the output.
12. As an Agent architect, I want a Markdown Brief Archive, so that past briefs remain searchable, versionable, and independent of Discord.
13. As an Agent architect, I want Discord to send only a short notification or summary, so that the full reading experience stays in the archive.
14. As an Agent architect, I want an Operational CLI, so that I can manually run collection, generation, delivery, status, and source management during MVP.
15. As an Agent architect, I want the system built on the Pi Agent Runtime, so that the project also exercises real Agent architecture, tool execution, state, and event-streaming patterns.

## Implementation Decisions

- The MVP uses TypeScript and Node.js.
- The MVP uses the Pi Agent Runtime intentionally, even where a simpler pipeline would suffice, because practicing Agent architecture is part of the project purpose.
- The Source Registry is a manual YAML configuration with `id`, `platform`, `adapter`, `target`, `enabled`, and `notes`.
- `platform` describes where content comes from; `adapter` names the logical Fetch Adapter; concrete tools such as APIs, RSS libraries, scrapers, browser automation, or Codex Computer Use remain inside adapter implementation.
- Sources do not have priority, kind, fallback adapters, secrets, or automatic discovery rules.
- Source Items are stored as JSONL working data and include stable identity, source id, platform, URL, title or label, author when available, published time when available, fetched time, analyzable text or summary, and content hash.
- MVP does not introduce separate Source Fact, Signal Cluster, Creator, Reader Feedback, Feedback Review, Research Theme, or Control TUI data models.
- Signals directly cite one or more Source Items and carry their own selection reason through `why_it_matters`.
- Signal Types are lightweight categories inside Top Signals: `architecture`, `ai-coding`, `tool-repo`, and `risk`.
- Daily Brief Markdown uses four sections: Executive Summary, Top Signals, Source Coverage, and Sources.
- Daily Briefs are written in Chinese while preserving important English technical terms, project names, repository names, paper titles, and source titles.
- The Brief Archive is Markdown-first and is the source of truth for full brief content.
- Discord Delivery is automatic by default and limited to notifications or short summaries.
- The Operational CLI is the MVP control surface; the richer chat-based Control TUI is deferred to V2.

## Testing Decisions

- Test module behavior through public interfaces rather than internal helper details.
- Source Registry validation should be tested with valid sources, missing fields, disabled sources, and invalid field combinations.
- Fetch Adapters should be tested with fixture inputs and recorded outputs where possible, avoiding live network dependency in unit tests.
- The GitHub Fetch Adapter should focus on trend/search style Sources and rapidly rising Agent Architecture / AI Coding repositories, not ordinary commit streams.
- The X.com Fetch Adapter should support configured accounts, lists, or bounded searches while filtering out reposts without added perspective.
- Source Item Store should be tested for JSONL append/read behavior, path calculation, deduplication support, and malformed record handling.
- Brief Module should be tested with fixed Source Item fixtures to verify Signal selection, duplicate merging through multi-citation Signals, low-signal output, Source Coverage text, and Markdown structure.
- Discord Delivery should be tested with a mocked transport to verify notification body shape and failure behavior.
- Operational CLI should be tested at the command boundary for setup, run-once, status, version, and source management flows. Lower-level collection, generation, and delivery phases are exercised through workflow APIs and `run-once`.

## Out of Scope

- Open-ended web research.
- Autonomous Source discovery or Source addition.
- Reader Feedback.
- Feedback Review.
- Control TUI.
- Creator modeling and cross-platform Creator aggregation.
- Cross-Signal Research Themes.
- Separate Source Fact extraction layer.
- Separate Signal Cluster data model.
- Discord interaction controls.
- Full external-content mirroring.

## Further Notes

The MVP should stay Source-grounded. Unsupported claims do not belong in the Daily Brief, and partial failures should be surfaced through Source Coverage only when they materially affect completeness or confidence. V2 can add feedback loops, richer chat control, Creator aggregation, and longer-horizon Research Theme synthesis after the daily pipeline is useful.
