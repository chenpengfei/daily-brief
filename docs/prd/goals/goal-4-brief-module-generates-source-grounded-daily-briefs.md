# Goal 4: Brief Module Generates Source-Grounded Daily Briefs

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/4
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

The Brief Module turns collected Source Items into a Chinese, Source-grounded Daily Brief that uses the MVP Daily Brief Template, explains why each Signal matters, cites Source Items, merges duplicate mentions, and states low-signal days plainly.

## Scope

### Includes

- Selecting Source Items relevant to Agent Architecture and AI Coding.
- Producing Signals with `type`, `title`, `why_it_matters`/`whyItMatters`, and citations.
- Merging repeated mentions of the same URL into one multi-citation Signal.
- Rendering Markdown with `Executive Summary`, `Top Signals`, `Source Coverage`, and `Sources`.
- Rendering low-signal days without padding weak or unsupported claims.
- Showing material partial failures in Source Coverage when supplied by workflow status.
- Keeping unsupported or irrelevant claims out of the Daily Brief.

### Excludes

- Cross-Signal Research Themes.
- Separate Source Fact extraction layer.
- Separate Signal Cluster data model.
- Reader Feedback or Feedback Review.
- Brief Archive persistence.
- Discord notification rendering.

## Acceptance Criteria

- Given relevant Source Items about Agent Architecture or AI Coding,
  When the Brief Module generates a Daily Brief,
  Then it creates cited Top Signals with title, Signal Type, `whyItMatters`, and at least one Source Item citation,
  Evidence: `npm test -- test/brief/daily-brief.test.ts` covers cited Top Signal generation.

- Given multiple Source Items that point to the same underlying URL,
  When the Brief Module generates Signals,
  Then they are merged into one Signal with multiple citations rather than duplicate Top Signals,
  Evidence: `npm test -- test/brief/daily-brief.test.ts` covers multi-citation Signal merging.

- Given irrelevant or unsupported Source Items,
  When the Brief Module generates a Daily Brief,
  Then those items do not produce Signals and the Executive Summary identifies a low-signal day when no strong Signals remain,
  Evidence: `npm test -- test/brief/daily-brief.test.ts` covers unsupported claim exclusion and low-signal output.

- Given a Daily Brief with Signals and partial failure input,
  When Markdown is rendered,
  Then the output contains exactly the MVP top-level sections `Executive Summary`, `Top Signals`, `Source Coverage`, and `Sources`, and includes Source Coverage details,
  Evidence: `npm test -- test/brief/daily-brief.test.ts` covers the four-section Markdown template.

- Given Signals of different MVP Signal Types,
  When the Brief Module classifies them,
  Then it can produce `architecture`, `ai-coding`, `tool-repo`, and `risk` Signal Types without creating separate Daily Brief sections,
  Evidence: brief tests cover Signal Type classification.

- Given a rendered Daily Brief,
  When a maintainer inspects it,
  Then the primary prose is Chinese while preserving important English technical terms, repository names, project names, and source titles,
  Evidence: fixture-based Markdown assertion plus Human Review Notes.

## Evidence Required

- Commands:
  - `npm test -- test/brief/daily-brief.test.ts`
  - `npm run typecheck`
- Tests:
  - Relevant item selection.
  - Unsupported item exclusion.
  - Multi-citation Signal merging.
  - Low-signal day rendering.
  - Four-section Markdown rendering.
  - Signal Type classification.
- Files:
  - `src/brief/daily-brief.ts`
  - `templates/daily-brief.md`
  - `test/brief/daily-brief.test.ts`
- Logs/status:
  - Sample rendered Markdown for one normal day and one low-signal day.

## Human Review Notes

- The brief should feel useful to an Agent architect, not like generic AI news.
- Chinese prose should support understanding while preserving important English technical terms.

## Current State Notes

- Existing:
  - `generateDailyBrief` filters relevant Source Items and produces Signals with citations.
  - `renderDailyBriefMarkdown` renders the four MVP sections.
  - Tests cover relevant cited Signals, duplicate merging, unsupported item exclusion, low-signal summary, partial failure text, and source citations.
- Likely gaps:
  - Explicit tests for all four Signal Types may need to be added.
  - The code currently uses `whyItMatters` internally while the PRD phrase is `why_it_matters`; decide whether this is an implementation naming detail or a public output requirement.
  - Brief language quality remains a Human Review Note, not an automated Acceptance Criterion.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 5, 6, 7, 8, 9
- Out of Scope Protected:
  - Open-ended web research.
  - Cross-Signal Research Themes.
  - Separate Source Fact extraction layer.
  - Separate Signal Cluster data model.
- Dependencies:
  - Goal 3: Collection Persists Incremental Source Items Reliably, though development can use fixed Source Item fixtures.
