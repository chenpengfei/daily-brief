# Daily Brief

Daily Brief is a personal intelligence workflow for an Agent architect. It turns a manually curated set of sources into a recurring brief about Agent architecture, implementation practice, and related ecosystem signals.

## Language

**Daily Brief Agent**:
A long-running background system that collects content from a manually curated set of sources, identifies material relevant to Agent architecture, produces a daily brief, and pushes it to the reader. It may use LLM calls and tools internally, but the term refers to the whole automation system, not a single model invocation.
_Avoid_: Chatbot, one-off script, generic RSS reader

**Pi Agent Runtime**:
The intended implementation foundation for the Daily Brief Agent MVP, based on `earendil-works/pi` and especially its agent package/runtime concepts. The Pi Agent Runtime should own agent orchestration, tool execution, state management, and event streaming even when the MVP could be implemented as a simpler pipeline, because practicing Agent architecture is part of the project's purpose; natural-language control and skill routing are deferred until a V2 Control TUI exists.
_Avoid_: Custom pipeline only, TUI router, one-off orchestration script

**Source**:
A manually defined origin that the Daily Brief Agent is allowed to monitor, such as an X account, blog, GitHub repository or organization, YouTube channel, feed-like endpoint, trend list, topic, or bounded search. The system processes configured Sources; it does not autonomously add new Sources.
_Avoid_: Lead, recommendation, discovered account

**Source Platform**:
The content platform or medium a Source belongs to, such as X, blog, GitHub, or YouTube. Source Platform describes where Source Items come from and supports display, citation, deduplication, and platform policy; it is distinct from Fetch Adapter.
_Avoid_: Fetch Adapter, scraper, source target

**Source Registry**:
The manually maintained list of Sources the Daily Brief Agent is allowed to monitor, stored at `config/sources.yaml`. The Source Registry is the source of truth for collection scope; the agent reads it, and explicit manual edits or Operational CLI commands may modify it. A Source has an id, Source Platform, Fetch Adapter, Source Target, enabled state, and notes; Sources do not carry priority, kind, fallback adapters, concrete tool names, automatic discovery rules, or secrets.
_Avoid_: Discovered source list, recommendation list, implicit subscriptions

**Source Target**:
The adapter-specific locator or query that tells a Fetch Adapter what to collect for a Source. A Source Target may be an X handle, RSS URL, GitHub repository, GitHub search query, trending page, YouTube channel, playlist, or other adapter input.
_Avoid_: Universal URL, Creator, Source ID

**Fetch Adapter**:
The collection implementation named by a Source that knows how to fetch Source Items for that Source Target. A Fetch Adapter may internally use official APIs, RSS, open-source scraping tools, browser automation, Codex Computer Use, or manual exports, but those implementation tools are not part of the Source Registry's domain meaning.
_Avoid_: Source kind, concrete scraper, platform

**Focus Area**:
A top-level subject the Daily Brief Agent prioritizes when judging whether content matters. The current Focus Areas are Agent Architecture, meaning how to construct reliable Agent systems, and AI Coding, meaning how engineers use Coding Agents to build and maintain software.
_Avoid_: Generic AI news, general productivity, model hype

**Signal**:
A content item from one or more Source Items that is worth considering for a Daily Brief because it relates to a Focus Area. Signals should contain architectural insight, engineering practice, concrete examples, tooling patterns, evaluation lessons, or ecosystem changes that affect Agent Architecture or AI Coding. A Signal carries its own selection reason, such as `why_it_matters`, rather than relying on a separate Agent Analysis layer.
_Avoid_: Raw post, saved link, generic AI update

**Signal Type**:
The lightweight category used to explain why a Signal belongs in Top Signals. MVP Signal Types include `architecture`, `ai-coding`, `tool-repo`, and `risk`; these types do not create separate Daily Brief sections.
_Avoid_: Brief section, source platform, priority

**Signal Score**:
An explainable importance judgment used to rank and filter Signals for the Daily Brief. Signal Score should consider relevance, novelty, actionability, credibility, and momentum across Sources, but relevance to a Focus Area comes before popularity or trend momentum. The Daily Brief should show concise selection reasons and sources rather than exposing Signal Score as a raw number.
_Avoid_: Popularity score, engagement score, opaque ranking, trending rank

**Daily Brief**:
A recurring reader-facing summary produced once per day from the available Signals. A Daily Brief should take about five to ten minutes to read and should preserve quality on low-signal days rather than filling space with weak or irrelevant content. It is narrower than the Source Item Store: collected but irrelevant Source Items should remain out of reader-facing Signals. Cross-Signal Research Themes are deferred to V2.
_Avoid_: News feed, link dump, exhaustive digest

**Daily Brief Template**:
The Markdown structure for an MVP Daily Brief: title with date, Executive Summary, Top Signals, Source Coverage, and Sources. Tool, repository, architecture, AI Coding, and risk content are represented as Signal Types inside Top Signals rather than separate sections.
_Avoid_: Link dump, opaque summary, unsupported research section

**Daily Brief Cadence**:
The recurring schedule for collection and delivery. The Daily Brief Agent collects Source updates once per day starting at 06:00 and pushes the Daily Brief through Discord Delivery at 07:00. On partial collection or analysis failure, delivery remains on time and the Daily Brief notes any material incompleteness; core workflow failure results in a failure notification rather than a false brief.
_Avoid_: Continuous polling, real-time alerts, ad hoc delivery

**Manual Run**:
A human-triggered execution of the Daily Brief Agent outside the recurring Daily Brief Cadence. A Manual Run uses the configured Source Registry, performs collection, brief generation, archive writing, and Discord Delivery once, and follows the same source-grounding and Autonomy Boundary rules as scheduled runs.
_Avoid_: One-off script, source discovery, scheduler

**Collection Window**:
The time range a collection run covers for each Source. Each Source is collected incrementally from its last successful fetch, while a Daily Brief summarizes new Signals since the previous Daily Brief.
_Avoid_: Full recrawl, fixed calendar day, duplicate window

**Trending Range**:
The time range a trend-list Source Platform uses to calculate a ranking, such as GitHub Trending's daily, weekly, or monthly view. A Trending Range describes the external platform's ranking window; it is not the Daily Brief Agent's Collection Window and does not replace Source Item identity, deduplication, or cross-run state.
_Avoid_: Collection Window, cursor, checkpoint

**Brief Language**:
The Daily Brief is written primarily in Chinese while preserving important English technical terms, project names, repository names, paper titles, and source titles. Translation should support understanding rather than obscure the original terminology.
_Avoid_: Full machine translation, English-only brief, newswire style

**Autonomy Boundary**:
The line between what the Daily Brief Agent may do on its own and what remains manually controlled. The agent may autonomously collect, deduplicate, filter, summarize, score, and push Daily Briefs from configured Sources; it must not autonomously add or remove Sources, perform open-ended research, infer cross-Signal Research Themes in MVP, or present unsupported inference as fact.
_Avoid_: Full autonomy, source discovery, unattended editorial authority, research hypothesis generation

**Source Item**:
A collected content unit from a Source, such as an X post, blog post, GitHub release or repository event, or YouTube video. A Source Item should retain a stable id, source id, Source Platform, URL, title or label, author when available, published time when available, fetched time, analyzable text or summary, and content hash, but it should not treat complete external-content mirroring as the default archive strategy. MVP does not model Creators separately; Signals should cite Source Items directly.
_Avoid_: Full mirror, brief, signal

**Source Item Store**:
The machine-readable working store for collected Source Items, organized as JSONL files under `data/source-items/YYYY/MM/YYYY-MM-DD.jsonl`. The Source Item Store supports deduplication, analysis, debugging, later indexing, replay, and audit of collected-but-not-selected items; it is distinct from the human-readable Brief Archive.
_Avoid_: Brief Archive, raw web cache, long-term reading surface

**X Source Item**:
An original X post or thread from a configured Source. Reposts without added interpretation are not normally Source Items; quote posts and replies may be Source Items when they add relevant perspective.
_Avoid_: Retweet, engagement event

**Blog Source Item**:
A single article from a configured blog Source. A blog homepage or feed is a Source; an article is the Source Item.
_Avoid_: Blog, feed

**GitHub Source Item**:
A meaningful repository or organization event from a configured GitHub Source, such as a release, important pull request or issue, burst of development around a capability, or substantial documentation change. Ordinary commits are not automatically Signals.
_Avoid_: Every commit, repository mirror

**Trending Repository Observation**:
A GitHub Source Item produced by a trend-list Source when a repository appears in a specific Trending Range during a Collection Window. It records that the repository gained platform-visible attention at that time; its stable identity is the observing Source, repository URL, and Daily Brief date. It does not make the repository itself a Source, and repeated observations across Daily Brief dates may show momentum without automatically becoming repeated Signals.
_Avoid_: Repository Source, subscription, duplicate repository

**Trend-List Collection Boundary**:
The rule that a trend-list Fetch Adapter collects only information visible in the trend list itself, such as repository name, URL, short description, and lightweight ranking or momentum metrics. It should not fetch repository README files, issues, pull requests, releases, or API detail pages unless that repository is manually configured as its own Source, and it should not use stale trend-list data as a silent fallback for a failed current collection.
_Avoid_: Repository deep dive, automatic repo subscription, README summarization, stale trend fallback

**Repeat Signal Selection**:
The rule that a new Source Item occurrence for previously cited content does not automatically become a new Signal in a later Daily Brief. A repeated observation may support momentum, but it should re-enter Top Signals only when there is a new selection reason, such as materially changed context, unusual continued momentum, corroboration from another Source, or a new architecture, AI Coding, tool, or risk implication.
_Avoid_: Repeat mention, automatic re-alert, duplicate Signal

**YouTube Source Item**:
A single video from a configured YouTube channel or playlist Source. The video is the Source Item; transcript segments may support Signal analysis when available.
_Avoid_: Channel, transcript fragment

**Delivery Channel**:
A configured destination where the Daily Brief Agent pushes the Daily Brief or a notification about it. The initial Delivery Channel is Discord.
_Avoid_: Archive, source, inbox

**Discord Delivery**:
The initial Delivery Channel for Daily Brief notifications and summaries. Discord Delivery is automatic by default and only pushes notifications or brief summaries; control and configuration remain outside Discord.
_Avoid_: Brief Archive, source of truth, control surface, feedback channel

**Discord Notification Template**:
The short Discord Delivery format for a generated Daily Brief: date, a few headline bullets, and a link or pointer to the full Brief Archive entry. It should not include full Signal details, Reader Feedback controls, or Source management.
_Avoid_: Full daily brief, feedback UI, control command

**Operational CLI**:
The MVP control surface for running and inspecting Daily Brief operations from the terminal. The Operational CLI can collect Source updates, generate or regenerate a Daily Brief, deliver the Discord notification, run the full daily workflow once, inspect status, and manage Sources explicitly.
_Avoid_: Chat product, Discord control, V2 Control TUI

**Domain Module**:
The TypeScript module that expresses the shared project language as types and pure domain rules. The Domain Module mirrors MVP concepts from this glossary, such as Source, Source Item, Signal, and Daily Brief, but it does not perform I/O, fetching, delivery, CLI rendering, or agent orchestration.
_Avoid_: Storage layer, adapter implementation, prompt code

**Storage Module**:
The TypeScript module that owns local file persistence for Source Item Store and Brief Archive. The Storage Module knows paths and formats; it does not decide content importance or generate briefs. Feedback persistence is deferred to V2.
_Avoid_: Brief generation, Source fetching, Signal scoring

**Brief Module**:
The TypeScript module that turns Source Items and Source Coverage into Signals, Daily Brief Markdown, and Discord notification summaries. A Signal may cite multiple Source Items when repeated mentions point to the same content or idea. The Brief Module generates content but delegates file persistence to the Storage Module.
_Avoid_: File path management, Fetch Adapter, Discord transport

**Status Output**:
The Operational CLI output for inspecting collection, analysis, archive, and delivery health. Routine failures belong in status output and logs; the Daily Brief should mention failures only when they materially affect brief completeness or confidence.
_Avoid_: Daily brief content, alert feed, source ranking

**Core Workflow Failure**:
A failure that prevents the Daily Brief Agent from honestly producing or delivering a Daily Brief, such as unreadable Source Registry, unwritable Brief Archive, no successful collection with no usable prior data, unavailable brief generation, or inability to send any Discord notification. Partial Source failures, trend-list parsing failures for one Source, missing transcripts, rate limits, and individual parse failures are not Core Workflow Failures.
_Avoid_: Partial failure, low-signal day, incomplete source coverage

**Brief Archive**:
The Markdown-first long-term record of generated Daily Briefs, stored under `briefs/YYYY/MM/YYYY-MM-DD.md`. The Brief Archive exists so past Signals and selection reasons can be searched, reviewed, versioned, and reused in later synthesis.
_Avoid_: Discord history, transient notification

## Example Dialogue

**Architect**: Add Simon's blog as a Source.

**Developer**: Should the Daily Brief Agent discover similar blogs automatically?

**Architect**: No. Sources are manually defined; the agent should only process the configured list.

**Developer**: Can GitHub trending projects about Agents be monitored?

**Architect**: Yes. The trending page or query can be a Source, and its results are Source Items.

**Developer**: A project from GitHub trending is high quality. Can the agent add it as a Source?

**Architect**: No. If I want to follow it directly, I add it as a Source myself.

**Developer**: Simon also has an X account and a YouTube channel. Is that one Source?

**Architect**: No. Each platform entry is a separate Source; MVP does not model Simon as a separate Creator.

**Developer**: This post announces a new image model. Is it a Signal?

**Architect**: Not unless it changes how we build Agents or use Coding Agents in engineering work.

**Developer**: Five Sources shared the same Agent repo today. Is that five Signals?

**Architect**: No. It is one Signal that cites multiple Source Items; the repeated mentions may increase momentum.

**Developer**: How do I run the whole MVP workflow manually?

**Architect**: Use the Operational CLI to collect, generate, archive, and deliver the Daily Brief once.

**Developer**: What if there are not enough strong Signals today?

**Architect**: Still produce the Daily Brief, but say it is a low-signal day instead of padding it with weak content.

**Developer**: Can the agent add a new YouTube channel it finds through a recommendation?

**Architect**: No. Source changes are outside the Autonomy Boundary and remain manually controlled.

**Developer**: The agent thinks repository-level memory is becoming important. Can the brief state that as fact?

**Architect**: Only if it is grounded in cited Source Items. Otherwise it should not be included as a claim in the Daily Brief.

**Developer**: This repo had twenty commits today. Are those twenty Signals?

**Architect**: No. They may form GitHub Source Items or metadata, but only meaningful changes relevant to a Focus Area become Signals.

**Developer**: Where should the Daily Brief be pushed first?

**Architect**: Discord is the initial Delivery Channel.

**Developer**: Can Discord be the only place we keep briefs?

**Architect**: No. Discord Delivery is for summaries and notifications; the Brief Archive is the long-term record.
