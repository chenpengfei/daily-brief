# Daily Brief

Daily Brief is a personal intelligence workflow for an Agent architect. It turns a manually curated set of sources into a recurring brief about Agent architecture, implementation practice, and related ecosystem signals.

## Language

**Daily Brief Agent**:
A long-running background system that collects content from a manually curated set of sources, identifies material relevant to Agent architecture, produces a daily brief, and pushes it to the reader. It may use LLM calls and tools internally, but the term refers to the whole automation system, not a single model invocation.
_Avoid_: Chatbot, one-off script, generic RSS reader

**Pi Agent Runtime**:
The intended implementation foundation for the Daily Brief Agent MVP, based on `earendil-works/pi` and especially its agent package/runtime concepts. The Pi Agent Runtime should own agent orchestration, tool execution, state management, and event streaming even when the MVP could be implemented as a simpler pipeline, because practicing Agent architecture is part of the project's purpose; natural-language control and skill routing are deferred until a V2 Control TUI exists.
_Avoid_: Custom pipeline only, TUI router, one-off orchestration script

**Agent Stage**:
A bounded LLM-backed processing step inside the Daily Brief Agent, executed through the Pi Agent Runtime from Source-grounded inputs to structured outputs and observable events. An Agent Stage is not an independent Agent, a separate source of truth, or a replacement for deterministic collection, storage, rendering, or delivery code.
_Avoid_: Separate agent, one-off model call, custom pipeline step

**Agent-Driven Brief Generation**:
The rule that Daily Brief generation decisions after Source Item collection are driven by Agent Stages rather than deterministic fallback logic. If a required Agent Stage cannot run or returns invalid output, the Daily Brief Agent should treat the run as an analysis failure instead of producing a normal Daily Brief from templates or keyword-only decisions.
_Avoid_: Template fallback, keyword-only brief generation, silent degradation

**Agent Generation Sequence**:
The ordered set of required Agent Stages that turns collected Source Items into a Daily Brief: Source Item understanding, Signal selection, Signal ranking, Signal narrative, and Source-grounding audit. The sequence is stage-oriented rather than a single monolithic prompt so each decision boundary can be validated and audited.
_Avoid_: One-shot prompt, hidden chain, markdown-first generation

**Analysis Failure**:
A failure after Source Item collection where a required Agent Stage cannot produce valid Source-grounded output for Daily Brief generation. An Analysis Failure should not create a normal Brief Archive entry; it should be reported as a workflow failure rather than hidden behind fallback content.
_Avoid_: Low-signal day, partial source failure, degraded normal brief

**LLM Provider**:
The configured model access path used by required Agent Stages during real Daily Brief generation. The Daily Brief Agent should treat ChatGPT/Codex OAuth, standard OpenAI API, and OpenAI-compatible providers as provider choices behind the Pi Agent Runtime abstraction, while deterministic faux responses remain limited to tests and local contract checks.
_Avoid_: Test model, hard-coded model backend, unauthenticated model call

**LLM Provider Configuration**:
The user-controlled operational choice of which LLM Provider and model the Daily Brief Agent uses for Agent Stages. LLM Provider Configuration belongs to the Operational CLI and runtime environment, not the Source Registry, and should keep provider secrets separate from ordinary project configuration.
_Avoid_: Source configuration, hard-coded provider, committed secret

**User Configuration Directory**:
The per-user location where an installed Daily Brief Agent stores personal runtime configuration files such as Source Registry, LLM Provider Configuration, and credential state. The project repository may include examples and defaults, but user-specific configuration belongs outside the repository and should remain separate from generated Daily Brief data.
_Avoid_: Project config, committed registry, generated artifact store

**User Data Directory**:
The per-user location where an installed Daily Brief Agent stores generated artifacts and local working data, such as Source Item Store entries, Agent Run Artifacts, and Brief Archive entries. User data is separate from configuration so growing generated outputs can be moved, backed up, pruned, or synced without changing Source and provider settings.
_Avoid_: User Configuration Directory, committed archive, cache-only scratch space

**Model Credential Store**:
The user-level storage for LLM Provider secrets, Delivery Channel secrets, OAuth tokens, API keys, webhooks, and refreshable credentials used by Agent Stages and delivery. The Model Credential Store is separate from project configuration and Source Registry so credentials are not committed or mixed with collection scope.
_Avoid_: Source Registry, committed config file, `.env` as primary storage, shared Codex CLI auth file

**Structured Agent Output**:
The machine-validated JSON output produced by an Agent Stage before any reader-facing Markdown is rendered. Structured Agent Output must reference existing Source Items and Signals explicitly; invalid JSON, missing required fields, or impossible citations make the run an Analysis Failure.
_Avoid_: Free-form Markdown from the model, best-effort parsing, implicit citations

**Source Item Understanding Stage**:
An Agent Stage that turns collected Source Items into Source-grounded interpretation for later Signal decisions. It explains what a Source Item appears to claim, how it relates to Focus Areas, and what evidence boundaries apply without performing open-ended research.
_Avoid_: Open research, raw scraping, final brief writing

**Signal Selection Stage**:
An Agent Stage that decides which understood Source Items should become candidate Signals for a Daily Brief. It includes exclusion reasons for weak, irrelevant, duplicate, or unsupported items rather than relying only on keyword matches.
_Avoid_: Keyword filter only, source collection, final ranking

**Signal Ranking Stage**:
An Agent Stage that ranks candidate Signals for inclusion in Top Signals using explainable importance judgments. It should prioritize relevance to Focus Areas and source-grounded actionability over platform popularity alone.
_Avoid_: Trending rank, engagement score, opaque ordering

**Signal Narrative Stage**:
An Agent Stage that writes the reader-facing explanation for selected Signals, including what the Signal is, what it is not, a minimal example, and why it matters. It writes from cited Source Items and must not turn unsupported inference into fact.
_Avoid_: Generic summary, marketing copy, unsupported analysis

**Source-grounding Audit Stage**:
An Agent Stage that checks whether selected Signals and reader-facing narrative remain supported by cited Source Items. It should identify missing citations, unsupported claims, overconfident trend interpretation, and open-ended research leakage before a Daily Brief is archived.
_Avoid_: Copy editing, source collection, best-effort warning only

**Agent Run Artifact**:
A machine-readable record of one Daily Brief generation run's Agent Stage inputs, structured outputs, decisions, warnings, model metadata, and degradation paths. Agent Run Artifacts support replay, audit, and debugging, but they are not the reader-facing Brief Archive or the Source Item Store.
_Avoid_: Brief Archive, Source Item Store, model transcript dump

**Source**:
A manually defined origin that the Daily Brief Agent is allowed to monitor, such as an X account, blog, GitHub repository or organization, YouTube channel, feed-like endpoint, trend list, topic, or bounded search. The system processes configured Sources; it does not autonomously add new Sources.
_Avoid_: Lead, recommendation, discovered account

**Source Platform**:
The content platform or medium a Source belongs to, such as X, blog, GitHub, or YouTube. Source Platform describes where Source Items come from and supports display, citation, deduplication, and platform policy; it is distinct from Fetch Adapter.
_Avoid_: Fetch Adapter, scraper, source target

**Source Registry**:
The manually maintained list of Sources the Daily Brief Agent is allowed to monitor, normally stored as user-specific configuration in the User Configuration Directory. The Source Registry is the source of truth for collection scope; the agent reads it, and explicit manual edits or Operational CLI commands may modify it. A Source has an id, Source Platform, Fetch Adapter, Source Target, enabled state, and notes; Sources do not carry priority, kind, fallback adapters, concrete tool names, automatic discovery rules, or secrets.
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
A content item from one or more Source Items that is worth considering for a Daily Brief because it relates to a Focus Area. Signals should contain architectural insight, engineering practice, concrete examples, tooling patterns, evaluation lessons, or ecosystem changes that affect Agent Architecture or AI Coding. A Signal carries its own reader-facing explanation, such as `为什么重要`, rather than relying on a separate Agent Analysis layer.
_Avoid_: Raw post, saved link, generic AI update

**Signal Lens**:
The reader-facing description of what a Signal is about, expressed through a Focus Area and a Direction rather than a fixed type enum. The current Focus Areas are Agent Architecture and AI Coding; current Directions include advanced tools, long-running tasks, continuous learning, self-improvement, and human-Agent boundaries.
_Avoid_: Rigid enum, brief section, source platform, priority

**Signal Score**:
An explainable importance judgment used to rank and filter Signals for the Daily Brief. Signal Score should consider relevance, novelty, actionability, credibility, and momentum across Sources, but relevance to a Focus Area comes before popularity or trend momentum. The Daily Brief should show concise selection reasons and sources rather than exposing Signal Score as a raw number.
_Avoid_: Popularity score, engagement score, opaque ranking, trending rank

**Daily Brief**:
A recurring reader-facing summary produced once per day from the available Signals. A Daily Brief should take about five to ten minutes to read and should preserve quality on low-signal days rather than filling space with weak or irrelevant content. It is narrower than the Source Item Store: collected but irrelevant Source Items should remain out of reader-facing Signals. Cross-Signal Research Themes are deferred to V2.
_Avoid_: News feed, link dump, exhaustive digest

**Daily Brief Template**:
The Markdown structure for an MVP Daily Brief: title with date, Executive Summary, Top Signals, Source Coverage, and Sources. Signal Lens fields such as `领域` and `方向` are represented inside Top Signals rather than separate sections.
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
The installed terminal entry point for manually running, inspecting, and configuring Daily Brief operations. The Operational CLI can run setup, manage Sources, configure LLM Providers, trigger Manual Runs, inspect status, and expose stable commands that external schedulers may invoke.
_Avoid_: Chat product, long-running gateway, Discord control surface

**Setup Wizard**:
The interactive Operational CLI flow, exposed as `daily-brief setup`, that prepares an installed Daily Brief Agent for first use by creating user files and guiding required configuration choices. The Setup Wizard may configure Sources, LLM Provider access, and Delivery Channels, while scheduled workflow commands remain non-interactive.
_Avoid_: Scheduled run, hidden auto-init, source discovery

**User Manual**:
The reader-facing product documentation for installing, setting up, running, upgrading, and troubleshooting the Daily Brief Agent. The User Manual lives separately from operations documentation, which may contain maintainer-oriented cadence, scheduler, and runtime details.
_Avoid_: Operations notes, PRD, release notes

**Changelog**:
The repository-maintained version history for Formal Releases, with each Release Version summarizing user-visible changes, installation or upgrade notes, and known limitations. GitHub Release notes should be derived from the Changelog entry rather than becoming the only durable release history.
_Avoid_: Commit log, PR list, GitHub-only release notes

**Release Checklist Issue**:
A GitHub Issue used to coordinate one Formal Release, collect Release Gate evidence, and record Human Release Gate approval. A Release Checklist Issue is an operational release artifact, not a PRD or a Goal Issue.
_Avoid_: Product requirement, implementation ticket, chat-only checklist

**Release Workflow Documentation**:
The maintainer-facing documentation that defines the three Release Gates, required evidence, Release Checklist Issue template, review expectations, and publication commands for Formal Releases. Release Workflow Documentation lives in the repository docs before any GitHub issue template automation is introduced.
_Avoid_: User Manual, operations notes, hidden chat procedure

**Release Pull Request**:
The pull request that prepares one Formal Release by updating the Release Version, package metadata, Changelog, User Manual, release workflow documentation, and readiness evidence before merging to `main`. A Release Pull Request normally should not include product code fixes; a narrow Release-Blocking Fix exception is allowed only when it is required to prove installability or publishability for the same release and is explicitly recorded for Agent Release Review. Publication happens only after the Human Release Gate.
_Avoid_: Feature PR, ordinary bug-fix PR, tag-only release, publish PR

**Formal Release**:
A maintainer-approved release of the Daily Brief Agent that publishes both a GitHub Release and an npm registry version so users can install the Operational CLI through normal npm tooling. A Formal Release is distinct from a development checkpoint or an unpublished release candidate.
_Avoid_: GitHub-only artifact, development checkpoint, unversioned handoff

**Release Package**:
The npm package distributed during a Formal Release, named `@chenpengfei/daily-brief`, while its installed command remains `daily-brief`. The Release Package is the normal user installation path for the Operational CLI.
_Avoid_: Unscoped package name, GitHub-only install, CLI command name as package identity

**Release Version**:
The SemVer identifier for a Formal Release. The npm package version uses `X.Y.Z`, while the corresponding GitHub tag and release title use `vX.Y.Z`.
_Avoid_: Date version, mismatched tag, untagged package version

**Release Gate**:
A human-triggered checkpoint in the Formal Release workflow. Each Release Gate has an explicit actor, expected evidence, and allowed outcome so release preparation, review, and final approval do not collapse into one implicit step.
_Avoid_: Background automation, implicit approval, chat-only decision

**Agent Release Preparation Gate**:
The first Release Gate, where a human asks an Agent to prepare the Release Pull Request, update release-facing content, run required checks, and collect evidence in the Release Checklist Issue. This gate produces release content and evidence, but it does not approve or publish the release.
_Avoid_: Human-only checklist, publish step, review approval

**Release Check Command**:
The project command that runs the repeatable automated checks required for release preparation: tests, typechecking, build, and package dry-run verification. The Release Check Command produces readiness evidence but must not tag, publish, create a GitHub Release, or perform the isolated Release Install Smoke Test.
_Avoid_: Publish script, deployment command, manual checklist only

**Release CI Workflow**:
The GitHub Actions workflow that runs dependency installation and the Release Check Command for pull requests and release preparation, giving the Agent Release Review Gate independent evidence beyond local command output. The Release CI Workflow is a verification channel, not an automated publishing channel.
_Avoid_: Auto-publish workflow, local-only evidence, hidden release gate

**Release Install Smoke Test**:
The isolated installation check that installs the Release Package into a temporary npm prefix and runs the Operational CLI with temporary User Configuration and User Data directories. The Release Install Smoke Test proves the packaged CLI can be installed and initialized without touching the maintainer's real global npm environment or Daily Brief data.
_Avoid_: Local tsx run, real global install, real user home mutation

**Release Blocker**:
A failed release check, missing evidence, product behavior defect, or documentation mismatch that prevents a release candidate from advancing to the next Release Gate. Product-code Release Blockers normally leave the Release Pull Request and are resolved through a separate issue or fix PR before release preparation restarts, unless they qualify as a narrow Release-Blocking Fix.
_Avoid_: Known limitation, release note, unrelated quick fix inside release PR

**Release-Blocking Fix**:
A minimal product-code fix kept inside a Release Pull Request because the release cannot prove installability or publishability without it. A Release-Blocking Fix must be recorded in the Release Checklist Issue and Release Pull Request with its scope reason, affected files, targeted tests, smoke evidence, and Agent Release Review focus.
_Avoid_: Ordinary product enhancement, opportunistic bug fix, hidden behavior change

**Agent Release Review Gate**:
The second Release Gate, where a human asks an Agent in an independent review context to review the Release Pull Request, release-facing content, and collected evidence against the release policy. This gate can recommend approval or request fixes, but it does not publish the release or let the preparing Agent approve its own work.
_Avoid_: Self-approval, same-thread review, code review only, publish step

**Human Release Gate**:
The third Release Gate, where the maintainer decides whether a reviewed release candidate becomes a Formal Release. After approval, the maintainer tags the reviewed `main` state, publishes the npm registry version, creates the GitHub Release, and verifies public installation.
_Avoid_: Autonomous publish, background release, CI-only approval

**Post-Release Incident**:
A release problem discovered after a tag, npm version, or GitHub Release has become public. Post-Release Incidents should preserve published history, document the issue in the Release Checklist Issue and release notes when relevant, and prefer a follow-up patch Release Version over moving tags or unpublishing packages.
_Avoid_: Silent rollback, moved tag, hidden failed release

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
