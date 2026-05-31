# Agent-Driven Brief Generation

## Outcome

Daily Brief generation after collection is driven by required Agent Stages running through the Pi Agent Runtime. The system should use LLM understanding to turn Source Items into selected, ranked, source-grounded Signals with useful reader-facing narrative, while deterministic code continues to own collection, persistence, validation, rendering, archiving, delivery, and command behavior.

## Problem

The current brief can include `是什么`, `不是什么`, `最小例子`, and `why_it_matters`, but these fields can still be template-like because Signal relevance, selection, ranking, and narrative are mostly deterministic keyword and formatting logic. That produces a brief that looks structured but does not yet reflect the Daily Brief Agent understanding the cited Source Items.

## Goals

- Make Source Item collection remain deterministic and source-scoped.
- Move post-collection generation decisions into required Agent Stages.
- Require each Agent Stage to return Structured Agent Output that can be validated before rendering.
- Persist Agent Run Artifacts for replay, audit, and debugging.
- Fail honestly when required Agent Stages cannot produce valid source-grounded output.
- Configure LLM Providers through the Operational CLI while reusing Pi model/provider abstractions.
- Support an installed CLI that reads user-specific configuration from the user's home directory rather than project source files.
- Keep scheduled runs non-interactive so external schedulers can invoke the CLI safely.

## Non-Goals

- No autonomous Source discovery.
- No open-ended research beyond cited Source Items.
- No normal Daily Brief generated from keyword-only or template fallback when Agent-driven generation fails.
- No rule-based Signal selection, ranking, narrative generation, or low-signal decision in the production generation path.
- No long-running Gateway or built-in scheduler.
- No custom Daily Brief model transport when Pi already provides the provider/API abstraction.
- No secrets in the Source Registry or committed project configuration.
- No user-specific Source Registry committed to the project repository.

## Required Agent Stages

The first version of Agent Stages should not expose open-ended tool use. Stage inputs should be assembled by deterministic orchestration from Source Items, Source Coverage, partial failures, and previous stage Structured Agent Outputs. Agent Stages should not fetch the network, read arbitrary files, mutate configuration, or perform open-ended research.

### Source Item Understanding Stage

Input: collected Source Items for the run.

Output: one annotation per Source Item, including the Source Item id, concise interpretation, Focus Area relevance, source-grounded claims, evidence boundaries, and exclusion hints when the item appears weak or irrelevant.

The first version should process Source Items in batch for a run when input size fits the selected model. If Source Items exceed the selected model's context or token limits, deterministic orchestration should split them into batches, call the Understanding Stage per batch, record batch metadata in Agent Run Artifacts, and merge annotations before Signal Selection. Source Items should not be silently truncated to fit the model.

### Signal Selection Stage

Input: Source Items and understanding annotations.

Output: candidate Signals and excluded Source Items, with source-grounded selection or exclusion reasons. It must not rely only on keyword matches.

If annotations exceed the selected model's context or token limits, deterministic orchestration may split Selection into batches. Batched Selection must be followed by a global merge step that combines duplicate candidates, preserves citations, keeps exclusion reasons, and prepares a unified candidate set for Ranking.

Signals should not use a rigid Signal Type enum in the production generation path. Instead, the Agent Stage should provide a reader-facing Signal Lens using language descriptions for:

- `领域`: Agent 架构 or AI Coding
- `方向`: 先进工具、长程任务、持续学习、自我改进、人与 Agent 的边界, or a similarly concise direction that remains within the Focus Areas

The renderer should show these as descriptive fields, not as Daily Brief sections.

The Daily Brief should display Signal Lens fields for each selected Signal, such as `领域: Agent 架构` and `方向: 长程任务 / 自我改进`, instead of rendering a `Type` enum field.

Signal Lens directions may be multi-valued. Structured Agent Output should represent directions as an array, and the renderer should display multiple directions joined with ` / `. Source-grounding audit should reject directions that drift outside Agent Architecture or AI Coding relevance.

Signal Lens Focus Areas may also be multi-valued. Structured Agent Output should represent focus areas as an array, and the renderer should display multiple focus areas joined with ` / `. At least one focus area must be Agent Architecture or AI Coding; generic AI news should not pass audit.

Internal structured schema fields may use English keys such as `whatItIs`, `whatItIsNot`, `minimalExample`, and `whyItMatters`, but the Markdown Daily Brief should render reader-facing Chinese labels: `是什么`, `不是什么`, `最小例子`, and `为什么重要`.

The Executive Summary should also be Agent-generated rather than template-only. It should be one concise Chinese paragraph, normally no more than two or three sentences, grounded in selected Signals and Source Coverage, and audited for unsupported claims. Low-signal day summaries should also be produced by the Agent Stages.

Each selected Signal should render fields in this order:

```text
### Signal 标题

- 领域: Agent 架构 / AI Coding
- 方向: 先进工具 / 长程任务
- 是什么: ...
- 不是什么: ...
- 最小例子: ...
- 为什么重要: ...
- 引用: source-item-id-1, source-item-id-2
```

The Daily Brief should keep a `Sources` section that expands cited Source Item ids into titles and URLs. Signal entries should reference Source Item ids through `引用`, while the `Sources` section remains the URL-bearing lookup table for source-grounding.

Source Coverage and Sources sections should remain deterministic. Agent Stages may use Source Coverage as context, but code should render collection counts, partial failures, and cited Source Item URL lookups from validated runtime data.

### Signal Ranking Stage

Input: candidate Signals and cited Source Items.

Output: ranked Top Signal ids with concise ranking reasons. Ranking should prioritize relevance to Agent Architecture and AI Coding, actionability, credibility, novelty, and cross-source momentum over platform popularity alone.

The first version should default to at most five Top Signals, configurable through `brief.maxSignals`. Ranking may return fewer than the maximum and must not include weak Signals simply to fill the quota.

If candidate Signals exceed the selected model's context or token limits, deterministic orchestration may first produce batched shortlists, but final Top Signals must pass through a global ranking step over the merged candidate set or merged shortlists. The system should not construct the final brief by concatenating per-batch winners without global comparison.

### Signal Narrative Stage

Input: selected ranked Signals and cited Source Items.

Output: reader-facing narrative fields for each selected Signal:

- `是什么`
- `不是什么`
- `最小例子`
- `whyItMatters`

The stage should also produce a reader-facing Executive Summary for the Daily Brief from the ranked Signals and Source Coverage context.

The narrative must preserve project names, repository names, and important English technical terms.

### Source-grounding Audit Stage

Input: selected Signals, narrative fields, citations, and cited Source Items.

Output: pass/fail audit result with violations when present. The audit must reject missing citations, unsupported claims, overconfident trend interpretation, open-ended research leakage, and references to Source Items that were not provided.

## Structured Agent Output

Each Agent Stage must return JSON that conforms to a stage-specific schema. The workflow must validate JSON parseability, required fields, ids, citations, and allowed enum values before passing output to the next stage.

Detailed Agent Stage schemas should be defined during implementation in code or a focused implementation spec rather than fully embedded in this PRD. The PRD defines the required stage contracts and validation expectations; implementation may use an appropriate schema library such as Zod, TypeBox, or JSON Schema.

Invalid JSON, missing required fields, impossible references, or failed grounding audit are Analysis Failures.

Agent Stage execution may use limited automatic retries for recoverable errors. JSON parse failures and schema validation failures may be retried once with explicit validation feedback. Transient provider or network failures may be retried a small bounded number of times. A failed grounding audit may allow at most one repair attempt before becoming an Analysis Failure. The first version only needs to record final outcomes and failure details in the Agent Run Artifact; detailed retry timelines and provider event streams can wait for an explicit debug/audit expansion.

Models must not directly write the final Markdown Daily Brief. Deterministic rendering turns validated structured outputs into the Daily Brief Template.

## Agent Run Artifact

Each generation run should write a machine-readable Agent Run Artifact under a dedicated artifact store such as `data/agent-runs/YYYY/MM/YYYY-MM-DD/RUN_ID.json`.

The artifact should include:

- run id, run date, and timestamps
- selected LLM Provider and model metadata
- compact references to Agent Stage inputs
- Agent Stage structured outputs
- validation and audit results
- Analysis Failure reason when a required stage fails
- references to Source Item Store and Brief Archive paths when present

By default, Agent Run Artifacts should not store raw prompt text, raw streamed model deltas, complete model transcripts, provider event streams, or full input mirrors. A future explicit debug mode may add deeper transcript capture, input hashes, retry timelines, or Pi event summaries, but the first version should stay minimal and useful.

Agent Run Artifacts should be append-only per run, even when a Brief Archive entry for the same date is overwritten. A recommended path shape is `data/agent-runs/YYYY/MM/YYYY-MM-DD/RUN_ID.json`, where `RUN_ID` includes a timestamp or other unique run identifier.

The Agent Run Artifact is not the Brief Archive and is not the Source Item Store.

## Failure Behavior

Required Agent Stages are mandatory for generation. If any required stage cannot run, returns invalid output, fails schema validation, or fails source-grounding audit, the run is an Analysis Failure.

For an Analysis Failure:

- Do not write a normal Brief Archive entry.
- Do write an Agent Run Artifact with failure details when possible.
- `run-once` and `generate` must report a clear failure.
- The failure message should tell the operator which configuration or stage needs attention.

Low-signal days are still valid Daily Briefs only when the Agent Stages successfully determine that no strong Signals should be selected.

Low-signal classification must be Agent-driven. Deterministic keyword filters or hard-coded relevance rules should not decide production Signal selection, ranking, narrative, or whether a day is low-signal. Deterministic code should remain responsible for schema validation, source scoping, deduplication, persistence, rendering, and failure boundaries.

## LLM Provider Configuration

Daily Brief must use Pi model/provider/API/OAuth abstractions for Agent Stage model access.

The default recommended provider is `openai-codex` with `gpt-5.5`, using ChatGPT/Codex OAuth through Pi. This is a default recommendation, not the only production path.

The configuration must also support:

- standard OpenAI API providers exposed through Pi
- DeepSeek provider support exposed through Pi
- OpenAI-compatible custom endpoints where Pi can represent them as compatible models
- deterministic faux provider responses only for tests and local contract checks

Daily Brief must not hand-roll Codex request payloads, backend URLs, headers, or token refresh when Pi already supplies the transport and OAuth helpers.

## Model Configuration CLI

The Operational CLI should provide a model configuration surface:

- `daily-brief model configure`
- `daily-brief model login`
- `daily-brief model logout`
- `daily-brief model status`

`model configure` should offer an interactive provider selection wizard and non-interactive flags for automation.

The wizard should default to the recommended `openai-codex` / `gpt-5.5` path while allowing alternatives such as OpenAI API, DeepSeek, and OpenAI-compatible custom endpoints.

Provider secrets and OAuth tokens belong in the Model Credential Store or the runtime environment, not in `config/sources.yaml` and not in committed project configuration. A development `.env` may be supported as a compatibility convenience, but it is not the installed CLI's primary credential store.

For ChatGPT/Codex OAuth, the CLI should guide the user through the provider-specific login flow exposed by Pi. Daily Brief may import existing Codex CLI credentials read-only if supported, but it must not refresh or overwrite the shared Codex CLI auth file.

## Installation and User Configuration

Daily Brief should support being installed as an npm CLI package that can be invoked without running from a repository checkout. The installed command should be `daily-brief`, while `npm run cli -- ...` remains a development workflow inside the repository.

The npm-compatible CLI package may be distributed from GitHub source, GitHub Releases, GitHub Packages, or the npm registry. Regardless of distribution channel, installed usage should expose the same `daily-brief` command.

After installation, the primary first-use path should be `daily-brief setup`, an interactive Setup Wizard that completes the necessary user configuration in one guided flow. The Setup Wizard should create files, choose and authenticate an LLM Provider, initialize Sources from the packaged example, and configure delivery settings when the user wants Discord Delivery.

The Setup Wizard should detect the system timezone, ask the user to confirm or change it, and store the selected timezone in `config.yaml`. If timezone detection is unavailable, it should default to `Asia/Shanghai`.

The first version should keep Brief Language fixed as `zh` while preserving important English technical terms, project names, repository names, paper titles, and source titles. `config.yaml` may include `brief.language: zh` for future expansion, but setup should not offer multi-language generation in the first version.

Discord Delivery should be an optional Setup Wizard step. When enabled, the wizard should collect the Discord webhook as a credential, store it under a stable reference such as `discord.default` in `auth.json`, write the matching `webhookRef` and enabled state in `config.yaml`, and offer a test message. When disabled, Daily Brief generation and archiving remain valid.

Discord notification content should be deterministic and minimal in the first version: enough to confirm the configured webhook can receive Daily Brief notifications, without a separate LLM call and without rich formatting requirements. Rich Daily Brief notification rendering and workflow failure notifications are deferred.

User-specific configuration should live in a User Configuration Directory under the user's home directory. This includes the real Source Registry, LLM Provider Configuration, Model Credential Store references, and runtime paths needed by scheduled runs.

Generated artifacts should live in a User Data Directory by default, not in the project repository and not mixed with user configuration. This includes Source Item Store entries, Agent Run Artifacts, and Brief Archive entries. The data location should be configurable so users can move growing outputs to a synced, backed-up, or larger storage location.

Source Item Store entries should not be treated as complete external-content mirrors. By default they should retain stable identity, source metadata, URL, title, author/time when available, analyzable text or summary, adapter metadata, and content hashes, while avoiding full webpage bodies, full repository documents, full transcripts, or full threads unless a future adapter explicitly introduces a bounded and compliant strategy.

The default layout should separate user configuration from generated data:

```text
~/.daily-brief/
  config.yaml              # non-secret settings: provider/model, paths, delivery defaults
  sources.yaml             # user personal Source Registry
  auth.json                # OAuth tokens, API keys, webhooks, and provider credential state
  data/
    source-items/          # collected Source Items as machine-readable JSONL
    agent-runs/            # Agent Stage inputs, outputs, validations, and failures
    briefs/                # reader-facing Markdown Daily Brief archive
```

`DAILY_BRIEF_HOME` should override the directory containing `config.yaml`, `sources.yaml`, and `auth.json`. `DAILY_BRIEF_DATA_HOME` should independently override the generated data directory. If neither is set, configuration files default to `~/.daily-brief/` and generated data defaults to `~/.daily-brief/data/`.

`DAILY_BRIEF_DATA_HOME` is a unified generated-data root. When set, Source Items, Agent Run Artifacts, and Brief Archive entries should remain grouped under that root as `source-items/`, `agent-runs/`, and `briefs/` rather than requiring separate path settings for each artifact type.

`config.yaml` should contain only non-secret runtime choices and path preferences. It should not contain Sources, API keys, webhook URLs, OAuth tokens, generated artifacts, or run state. The first version should cover:

```yaml
model:
  provider: openai-codex
  model: gpt-5.5
  credentialRef: openai-codex.default

delivery:
  discord:
    enabled: true
    webhookRef: discord.default

paths:
  dataHome: null

brief:
  language: zh
  timezone: Asia/Shanghai
  maxSignals: 5
```

The real credentials referenced by `credentialRef` and `webhookRef` belong in `auth.json` or the runtime environment. The Source Registry belongs in `sources.yaml`.

`auth.json` should be treated as a CLI-managed credential store rather than a hand-edited configuration file. The Setup Wizard and focused configuration commands should write OAuth tokens, API keys, Discord webhooks, provider metadata, and environment-backed credential references into this store. Status commands may show whether a credential exists, what provider it belongs to, and whether it appears refreshable, but must not print secret values. The file should be created with restrictive permissions where the platform supports it.

Credential references in `config.yaml` should use stable names such as `provider.name`, for example `deepseek.default`, `openai-codex.default`, or `discord.default`. Environment-backed credentials should use `env:NAME`. `auth.json` should store credentials by these stable reference names, including their type and provider metadata, while status commands display the reference name and readiness rather than the secret value.

`auth.json` should support multiple credentials across model providers and Delivery Channels. `config.yaml` chooses the active references for the current run, while unused credentials may remain available for later provider switching. Focused logout/delete commands should remove only the selected credential reference unless the user explicitly asks to clear more.

The project repository should contain example configuration such as `config/sources.example.yaml`, but it must not include a real personal `config/sources.yaml`. The installed CLI's default Source Registry is `~/.daily-brief/sources.yaml`.

The npm package should expose a `bin` entry for `daily-brief`. The built CLI should not depend on a repository checkout at runtime, and setup examples should either be packaged with the npm artifact or embedded in the application so `daily-brief setup` can initialize user files after installation.

The installed CLI should organize commands around setup, workflow execution, and focused configuration:

```text
daily-brief setup

daily-brief run-once
daily-brief collect
daily-brief generate
daily-brief deliver
daily-brief status

daily-brief sources list
daily-brief sources edit
daily-brief sources enable
daily-brief sources disable
daily-brief sources validate

daily-brief model configure
daily-brief model login
daily-brief model logout
daily-brief model status

daily-brief delivery configure
daily-brief delivery status
daily-brief delivery test
```

`setup` is the full guided configuration path. `sources`, `model`, and `delivery` commands are focused configuration surfaces. Workflow commands such as `run-once`, `collect`, `generate`, `deliver`, and `status` must remain non-interactive for external schedulers.

Workflow command semantics should remain decomposable:

- `collect` reads the configured Source Registry and writes Source Items under the generated data root.
- `generate` reads Source Items, runs the required Agent Stages, writes an Agent Run Artifact, and writes a Brief Archive entry only when generation succeeds.
- `deliver` reads the Brief Archive entry and sends a minimal configured Delivery Channel notification when delivery is enabled.
- `run-once` executes `collect` and `generate` in order, then invokes `deliver` only when delivery is enabled.

Source Item collection for the same date should be deduplicating and append-only. New Source Items are appended to `data/source-items/YYYY/MM/YYYY-MM-DD.jsonl`, while already-seen ids or content hashes are skipped; collection reruns should not delete previously collected items for that date.

Collection failures should be classified before generation. An unreadable Source Registry is a Core Workflow Failure. If all enabled Sources fail and no usable Source Items exist for the date, the run should fail rather than pretending to be a low-signal day. If some Sources fail but usable Source Items exist, generation may continue, but partial collection failures must be passed into Agent Stages, Agent Run Artifacts, and Daily Brief Source Coverage so the resulting brief does not overstate completeness.

Brief Archive entries should use a stable date path and be overwritten directly when the same date is regenerated. Agent Run Artifacts carry the audit history for generation attempts; the Markdown Brief Archive represents the current reader-facing version for that date.

Workflow commands should default to the current local date, using the timezone configured in `config.yaml`, and support `--date YYYY-MM-DD` for replay, debugging, and manual reruns. `collect --date` writes Source Items for that date, `generate --date` reads that date's Source Items and writes that date's Agent Run Artifact and Brief Archive entry, and `deliver --date` sends the notification for that date's Brief Archive entry when delivery is enabled.

`status` should include both configuration readiness and recent run state. Configuration readiness should report the active home and data directories, Source Registry parse status, selected model provider and model, credential readiness without secret values, Delivery Channel enabled/disabled state, and data directory writability. Recent run state should summarize the latest known collection, generation, Brief Archive, Agent Run Artifact, and delivery result from the generated data directory when present.

The Source Registry remains a user-editable YAML file. The first CLI version should support listing, enabling, disabling, validating, and a simple `sources edit` command that opens or prints the user-home `sources.yaml` path so the user can edit YAML directly and then run validation. A field-by-field interactive Source add/edit wizard is deferred.

The Operational CLI should provide setup and configuration commands that create or update the user configuration:

- run `daily-brief setup` for first-time setup or full reconfiguration
- create user files from examples or defaults during setup
- configure LLM Provider and model choices
- initialize Sources and expose the user-home Source Registry for manual editing plus validation
- configure Delivery Channels such as Discord
- print paths and status without revealing secrets

Environment variables should remain available for supported runtime overrides, but Source Registry location should be derived from `DAILY_BRIEF_HOME` rather than a separate Source Registry path variable.

Setup must be explicit. `daily-brief setup` should create the user configuration directory, initialize `config.yaml`, initialize `sources.yaml` from the repository example or an embedded example, create an empty credential store such as `auth.json` with restrictive permissions where possible, create the generated data directory, guide LLM Provider selection and authentication, and configure delivery settings when requested. Reconfiguration should stay simple: preserve skipped existing files, directly overwrite selected config files when the user confirms replacement or passes a force option, and never delete generated data.

After setup, users should be able to rerun `daily-brief setup` for complete reconfiguration, and also configure individual areas through focused commands such as model, sources, and delivery configuration commands. Re-running setup should show current status for Sources, LLM Provider, credentials, Delivery Channels, and data paths; preserve skipped areas; hide secret values; and avoid deleting generated data. The first version does not need fine-grained merge or partial replacement semantics beyond explicit overwrite or skip.

At the end of setup, the CLI should run a readiness check equivalent to status validation: configuration files exist, `sources.yaml` parses, the selected model provider is configured, credential references resolve, enabled delivery channels have credentials, and the generated data directory is writable. Setup should not automatically run collection, call an LLM, generate a brief, or deliver a notification.

The first version should not introduce named profiles. Users who need separate personal, work, test, or CI configurations can use different `DAILY_BRIEF_HOME` and `DAILY_BRIEF_DATA_HOME` values instead of a `--profile` command surface.

Scheduled or workflow commands such as `run-once`, `collect`, and `generate` must not auto-initialize missing configuration or start the Setup Wizard. If user configuration is missing, they should fail non-interactively with an actionable message instructing the operator to run `daily-brief setup`.

## Scheduler Boundary

Daily Brief remains scheduler-neutral.

The project does not implement a long-running Gateway or built-in cron scheduler. External schedulers may invoke stable CLI commands such as `daily-brief run-once`.

Scheduled commands must be non-interactive. If provider configuration or credentials are missing, `run-once` and `generate` must fail with actionable instructions rather than starting an interactive setup wizard.

## Goal Issue Index

Goal issue planning lives in `docs/prd/agent-driven-brief-generation-goal-map.md`. The parent PRD Issue indexes the independent Goal Issues below. Local drafts record the published GitHub Issue link once each issue exists. Goal numbers are local planning identifiers, not expected GitHub issue numbers.

| Goal | Draft | Publication Status |
| --- | --- | --- |
| Goal 9: Installed CLI Uses User Home Configuration And Data | `docs/prd/goals/goal-9-installed-cli-uses-user-home-configuration-and-data.md` | [Published #16](https://github.com/chenpengfei/daily-brief/issues/16) |
| Goal 11: Model Provider Configuration Uses Pi Abstractions | `docs/prd/goals/goal-11-model-provider-configuration-uses-pi-abstractions.md` | [Published #17](https://github.com/chenpengfei/daily-brief/issues/17) |
| Goal 12: Source Registry Is User-Managed Outside The Repository | `docs/prd/goals/goal-12-source-registry-is-user-managed-outside-the-repository.md` | [Published #18](https://github.com/chenpengfei/daily-brief/issues/18) |
| Goal 13: Agent Stage Runner Validates Output And Writes Run Artifacts | `docs/prd/goals/goal-13-agent-stage-runner-validates-output-and-writes-run-artifacts.md` | [Published #19](https://github.com/chenpengfei/daily-brief/issues/19) |
| Goal 21: Delivery Channel Configuration Uses Credential Store | `docs/prd/goals/goal-21-delivery-channel-configuration-uses-credential-store.md` | [Published #20](https://github.com/chenpengfei/daily-brief/issues/20) |
| Goal 14: Source Item Understanding Stage Annotates Collected Items | `docs/prd/goals/goal-14-source-item-understanding-stage-annotates-collected-items.md` | [Published #21](https://github.com/chenpengfei/daily-brief/issues/21) |
| Goal 10: Setup Wizard Prepares Daily Brief For First Use | `docs/prd/goals/goal-10-setup-wizard-prepares-daily-brief-for-first-use.md` | [Published #22](https://github.com/chenpengfei/daily-brief/issues/22) |
| Goal 15: Signal Selection And Ranking Are Agent-Driven | `docs/prd/goals/goal-15-signal-selection-and-ranking-are-agent-driven.md` | [Published #23](https://github.com/chenpengfei/daily-brief/issues/23) |
| Goal 16: Signal Narrative And Executive Summary Are Agent-Generated | `docs/prd/goals/goal-16-signal-narrative-and-executive-summary-are-agent-generated.md` | [Published #24](https://github.com/chenpengfei/daily-brief/issues/24) |
| Goal 17: Source-Grounding Audit Gates Brief Generation | `docs/prd/goals/goal-17-source-grounding-audit-gates-brief-generation.md` | [Published #25](https://github.com/chenpengfei/daily-brief/issues/25) |
| Goal 18: Daily Brief Renderer Uses Agent Outputs And Chinese Labels | `docs/prd/goals/goal-18-daily-brief-renderer-uses-agent-outputs-and-chinese-labels.md` | [Published #26](https://github.com/chenpengfei/daily-brief/issues/26) |
| Goal 19: Workflow Commands Are Non-Interactive And Failure-Honest | `docs/prd/goals/goal-19-workflow-commands-are-non-interactive-and-failure-honest.md` | [Published #27](https://github.com/chenpengfei/daily-brief/issues/27) |
| Goal 20: NPM-Compatible Package Installs The Daily Brief CLI | `docs/prd/goals/goal-20-npm-compatible-package-installs-the-daily-brief-cli.md` | [Published #28](https://github.com/chenpengfei/daily-brief/issues/28) |

## Acceptance Criteria

- Given collected Source Items, when generation runs, then the required Agent Stages execute in order through Pi Agent Runtime.
- Given each Agent Stage completes, when its output is parsed, then it conforms to the stage schema before the next stage runs.
- Given selected Signals, when narrative is rendered, then `是什么`, `不是什么`, `最小例子`, and `为什么重要` come from validated Agent Stage output.
- Given a grounding violation, invalid JSON, missing citation, missing provider, or model auth failure, when generation runs, then the run is an Analysis Failure and no normal Brief Archive entry is written.
- Given a low-signal day, when Agent Stages successfully conclude no strong Signals should be selected, then a low-signal Daily Brief may be archived.
- Given Daily Brief is installed, when `daily-brief setup` completes in a fresh user home, then it creates user configuration files, initializes Sources, guides model and optional delivery configuration, and ends with readiness output without running the daily workflow.
- Given a user manages Sources, when `daily-brief sources list/edit/enable/disable/validate` runs, then the CLI operates on the user-home Source Registry and reports schema errors without reading repository-local personal Sources.
- Given `daily-brief model configure`, when run interactively, then it guides the user through provider and model selection without storing secrets in Source Registry.
- Given `daily-brief model configure` with flags, when run non-interactively, then it updates non-secret provider configuration or reports missing required flags.
- Given `daily-brief model login` for an OAuth provider, when credentials are needed, then it uses Pi provider OAuth helpers and writes credentials to the Model Credential Store.
- Given model credentials exist, when `daily-brief model status` or `daily-brief model logout` runs, then status redacts secret values and logout removes only the selected credential reference.
- Given Discord Delivery is configured or disabled, when delivery status or `delivery test` runs, then webhook secrets stay in the credential store and disabled delivery remains optional for generation.
- Given Daily Brief is installed, when an external scheduler invokes `daily-brief run-once` outside a repository checkout, then the command reads user configuration from the User Configuration Directory.
- Given an external scheduler invokes `daily-brief run-once`, when configuration is incomplete, then the command exits with an actionable non-interactive failure.

## Implementation Notes

- Existing deterministic brief generation can remain as a test helper or internal renderer input builder, but it should not be the production source of generation decisions after this PRD is implemented.
- Existing faux provider behavior should be retained for tests, but production success should require a configured real LLM Provider.
- Existing attempts to hand-code Codex transport or refresh Codex CLI auth should be replaced by Pi provider/OAuth abstractions.
