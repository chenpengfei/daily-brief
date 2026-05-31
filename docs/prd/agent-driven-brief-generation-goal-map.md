# Agent-Driven Brief Generation Goal Map

## PRD Outcome

Daily Brief is installed and configured as a personal CLI, then turns collected Source Items into source-grounded Chinese Daily Briefs through required Pi Agent Runtime stages, with structured validation, auditable run artifacts, configurable LLM Providers, and non-interactive workflow commands suitable for external schedulers.

## Proposed Goal Issues

Publication shape: create one parent GitHub Issue for this PRD, then publish Goals 9-21 as independent GitHub Issues. The parent PRD Issue should index the Goal Issues and track product direction and coverage; each Goal Issue should remain independently executable, have an explicit Outcome, and provide observable evidence before it can be marked complete.

Goal numbers are local planning identifiers, not GitHub issue numbers. After publication, keep both the local Goal number and the assigned GitHub issue number visible in the parent PRD Issue index.

### Goal 9: Installed CLI Uses User Home Configuration And Data

Type: AFK

Blocked by: None

The installed `daily-brief` command reads personal configuration from `~/.daily-brief/config.yaml`, `~/.daily-brief/sources.yaml`, and `~/.daily-brief/auth.json`, writes generated data under `~/.daily-brief/data/`, supports `DAILY_BRIEF_HOME` and `DAILY_BRIEF_DATA_HOME`, and no longer requires repository-local `config/sources.yaml`.

Draft: `docs/prd/goals/goal-9-installed-cli-uses-user-home-configuration-and-data.md`

### Goal 11: Model Provider Configuration Uses Pi Abstractions

Type: AFK

Blocked by: Goal 9

The CLI configures LLM Providers through Pi model/provider/API/OAuth abstractions, supports the recommended `openai-codex` / `gpt-5.5` path plus OpenAI, DeepSeek, and OpenAI-compatible providers, and stores credentials behind stable credential references in `auth.json`.

Draft: `docs/prd/goals/goal-11-model-provider-configuration-uses-pi-abstractions.md`

### Goal 12: Source Registry Is User-Managed Outside The Repository

Type: AFK

Blocked by: Goal 9

The real Source Registry lives at `~/.daily-brief/sources.yaml`, the repository only ships `config/sources.example.yaml`, and `daily-brief sources` commands can list, open or print the registry for editing, enable, disable, and validate user Sources without a separate Source Registry path override.

Draft: `docs/prd/goals/goal-12-source-registry-is-user-managed-outside-the-repository.md`

### Goal 13: Agent Stage Runner Validates Output And Writes Run Artifacts

Type: AFK

Blocked by: Goal 9, Goal 11

The codebase has a minimal shared Agent Stage runner that can execute a mocked stage through the Pi-backed stage boundary, validate Structured Agent Output, record append-only minimal Agent Run Artifacts, and keep raw prompts/transcripts out of artifacts by default.

Draft: `docs/prd/goals/goal-13-agent-stage-runner-validates-output-and-writes-run-artifacts.md`

### Goal 21: Delivery Channel Configuration Uses Credential Store

Type: AFK

Blocked by: Goal 9, Goal 11

The CLI configures optional Discord Delivery through `delivery configure/status/test`, stores webhooks in `auth.json` behind stable references, and reports readiness without leaking secrets.

Draft: `docs/prd/goals/goal-21-delivery-channel-configuration-uses-credential-store.md`

### Goal 14: Source Item Understanding Stage Annotates Collected Items

Type: AFK

Blocked by: Goal 11, Goal 13

The Source Item Understanding Stage runs through Pi over supplied Source Items, supports deterministic batching when model context limits are exceeded, and produces validated annotations without open-ended tool use or network research.

Draft: `docs/prd/goals/goal-14-source-item-understanding-stage-annotates-collected-items.md`

### Goal 10: Setup Wizard Prepares Daily Brief For First Use

Type: AFK

Blocked by: Goal 9, Goal 11, Goal 12, Goal 21

`daily-brief setup` creates user configuration, initializes Sources from the packaged example, guides model and optional delivery configuration through focused modules, performs a readiness check, and can be rerun with simple skip-or-overwrite behavior without deleting generated data or revealing secrets.

Draft: `docs/prd/goals/goal-10-setup-wizard-prepares-daily-brief-for-first-use.md`

### Goal 15: Signal Selection And Ranking Are Agent-Driven

Type: AFK

Blocked by: Goal 14

Signal Selection, merge, shortlist, and final Ranking stages replace production rule-based Signal decisions, preserve citations and exclusion reasons, support global comparison after batching, and enforce `brief.maxSignals` without filling weak Signals.

Draft: `docs/prd/goals/goal-15-signal-selection-and-ranking-are-agent-driven.md`

### Goal 16: Signal Narrative And Executive Summary Are Agent-Generated

Type: AFK

Blocked by: Goal 15

The Signal Narrative Stage generates Executive Summary plus selected Signal fields using `领域`, multi-valued `方向`, `是什么`, `不是什么`, `最小例子`, and `为什么重要`, while preserving cited source boundaries and Chinese reader-facing language.

Draft: `docs/prd/goals/goal-16-signal-narrative-and-executive-summary-are-agent-generated.md`

### Goal 17: Source-Grounding Audit Gates Brief Generation

Type: AFK

Blocked by: Goal 16

The Source-grounding Audit Stage validates Executive Summary and Signal narrative against cited Source Items and Source Coverage, permits bounded repair attempts, and turns unsupported claims, missing citations, or invalid outputs into Analysis Failure.

Draft: `docs/prd/goals/goal-17-source-grounding-audit-gates-brief-generation.md`

### Goal 18: Daily Brief Renderer Uses Agent Outputs And Chinese Labels

Type: AFK

Blocked by: Goal 16, Goal 17

The deterministic renderer consumes validated Agent outputs, renders `领域`, `方向`, `是什么`, `不是什么`, `最小例子`, `为什么重要`, and `引用`, keeps deterministic Source Coverage and Sources sections, and overwrites same-date Brief Archive entries.

Draft: `docs/prd/goals/goal-18-daily-brief-renderer-uses-agent-outputs-and-chinese-labels.md`

### Goal 19: Workflow Commands Are Non-Interactive And Failure-Honest

Type: AFK

Blocked by: Goal 10, Goal 13, Goal 17, Goal 18, Goal 21

`collect`, `generate`, optional `deliver`, `run-once`, and `status` run non-interactively, support `--date`, preserve collection partial failures, distinguish Core Workflow Failure from Analysis Failure and low-signal days, and report configuration readiness plus recent run state.

Draft: `docs/prd/goals/goal-19-workflow-commands-are-non-interactive-and-failure-honest.md`

### Goal 20: NPM-Compatible Package Installs The Daily Brief CLI

Type: AFK

Blocked by: Goal 10, Goal 19

The project packages an installable npm-compatible CLI with a `daily-brief` bin entry, packaged or embedded setup examples, and installed usage that does not depend on a repository checkout.

Draft: `docs/prd/goals/goal-20-npm-compatible-package-installs-the-daily-brief-cli.md`

## User Story Coverage

| PRD User Story / Observable Behavior | Covered By | Status |
| --- | --- | --- |
| Given collected Source Items, generation executes the required Agent Stages in order through Pi Agent Runtime. | Goals 13, 14, 15, 16, 17 | Covered |
| Given each Agent Stage completes, its output conforms to the stage schema before the next stage runs. | Goals 13, 14, 15, 16, 17 | Covered |
| Given selected Signals, reader-facing `是什么`, `不是什么`, `最小例子`, and `为什么重要` come from validated Agent Stage output. | Goals 16, 18 | Covered |
| Given invalid JSON, missing citations, missing provider/auth, or grounding violations, generation becomes an Analysis Failure and no normal Brief Archive entry is written. | Goals 11, 13, 17, 19 | Covered |
| Given a low-signal day, Agent Stages may archive a low-signal Daily Brief only after successfully deciding no strong Signals should be selected. | Goals 15, 16, 17, 18, 19 | Covered |
| Given Daily Brief is installed, `daily-brief setup` creates user config, initializes Sources, guides model and optional delivery configuration, and ends with readiness output without running the workflow. | Goals 10, 11, 12, 21 | Covered |
| Given a user manages Sources, `daily-brief sources list/edit/enable/disable/validate` operates on the user-home Source Registry and reports schema errors without reading repository-local personal Sources. | Goal 12 | Covered |
| Given `daily-brief model configure` runs interactively, it guides provider/model selection without storing secrets in the Source Registry. | Goal 11 | Covered |
| Given `daily-brief model configure` runs with flags, it updates non-secret provider configuration or reports missing required flags. | Goal 11 | Covered |
| Given `daily-brief model login` runs for an OAuth provider, it uses Pi provider OAuth helpers and writes credentials to the Model Credential Store. | Goal 11 | Covered |
| Given model credentials exist, `daily-brief model status` redacts secrets and `daily-brief model logout` removes only the selected credential reference. | Goal 11 | Covered |
| Given Discord Delivery is configured or disabled, delivery status and `delivery test` keep webhook secrets in the credential store while delivery remains optional for generation. | Goal 21 | Covered |
| Given Daily Brief is installed, `daily-brief run-once` can run outside a repository checkout using the User Configuration Directory. | Goals 9, 19, 20 | Covered |
| Given workflow configuration is incomplete, non-interactive workflow commands exit with actionable setup/configuration instructions. | Goals 10, 19 | Covered |

## Requirement Coverage

| Requirement Area | Covered By | Status |
| --- | --- | --- |
| Installed CLI runs without repository checkout | Goals 9, 20 | Covered |
| User configuration lives outside repository | Goals 9, 10, 12 | Covered |
| Generated data lives under `DAILY_BRIEF_DATA_HOME` root | Goals 9, 13, 18, 19 | Covered |
| Setup Wizard completes first-use configuration through focused configuration modules with simple skip-or-overwrite reconfiguration | Goal 10 | Covered |
| LLM Provider abstraction reuses Pi | Goal 11 | Covered |
| Multiple credentials and active credential refs | Goal 11 | Covered |
| Delivery Channel configuration uses credential refs | Goal 21 | Covered |
| Source Registry example only in repository | Goal 12 | Covered |
| Shared Agent Stage runner, schema validation, and minimal run artifact writing | Goal 13 | Covered |
| Source Item Understanding with batching | Goal 14 | Covered |
| Agent-driven selection/ranking and low-signal decision | Goal 15 | Covered |
| Signal Lens with `领域` and multi-valued `方向` | Goal 16, Goal 18 | Covered |
| Executive Summary generated by Agent | Goal 16 | Covered |
| Source-grounding audit and Analysis Failure | Goal 17, Goal 19 | Covered |
| Deterministic Source Coverage and Sources sections | Goal 18 | Covered |
| Optional minimal Discord webhook configuration and test | Goal 21 | Covered |
| Non-interactive scheduler-friendly workflow commands | Goal 19 | Covered |
| Package/distribution via npm-compatible channels | Goal 20 | Covered |
| Named profiles | N/A | Out of Scope |
| Long-running Gateway or built-in scheduler | N/A | Out of Scope |
| Open-ended Agent tool use or web research | N/A | Out of Scope |

## Out Of Scope Protection

- No repository-committed personal `config/sources.yaml`.
- No standalone Daily Brief model transport when Pi already supplies provider/API/OAuth abstractions.
- No rule-based production Signal selection, ranking, narrative, or low-signal decision.
- No open-ended research, arbitrary file reads, network fetching, or configuration mutation inside Agent Stages.
- No long-running Gateway and no built-in scheduler.
- No named profile command surface in the first version.
- No raw prompt, streamed delta, full transcript, provider event stream, or full input mirror capture in Agent Run Artifacts by default.
- No field-by-field interactive Source add/edit wizard in the first version.
- No rich Discord notification rendering or workflow failure notification in the first version.
- No complete external-content mirroring in Source Item Store by default.
- No LLM-generated Discord notification independent of the audited Daily Brief.

## Known Dependencies

- Goal 9 creates the installed path and configuration/data home foundation needed by setup, sources, artifacts, and packaging.
- Goal 10 depends on Goals 9, 11, 12, and 21 because setup writes user files into the new home layout and must integrate the focused model, source, and delivery configuration modules.
- Goal 11 depends on Goal 9 because provider credentials and config live in user home.
- Goal 12 depends on Goal 9 because Source Registry defaults move into user home.
- Goal 13 depends on Goals 9 and 11 because artifacts live in the data root and stage execution needs model configuration.
- Goal 14 depends on Goals 11 and 13 for model access and stage contracts.
- Goal 15 depends on Goal 14 for Source Item annotations.
- Goal 16 depends on Goal 15 for selected and ranked Signals.
- Goal 17 depends on Goal 16 for narrative to audit.
- Goal 18 depends on Goals 16 and 17 for validated reader-facing content.
- Goal 21 depends on Goals 9 and 11 because delivery config lives in user home and uses the shared credential store.
- Goal 19 depends on setup, artifacts, audit, renderer behavior, and optional delivery configuration to expose trustworthy non-interactive commands.
- Goal 20 should come after the installed CLI behavior is stable enough to package.

## Suggested Execution Order

1. Goal 9: Installed CLI Uses User Home Configuration And Data
2. Goal 11: Model Provider Configuration Uses Pi Abstractions
3. Goal 12: Source Registry Is User-Managed Outside The Repository
4. Goal 13: Agent Stage Runner Validates Output And Writes Run Artifacts
5. Goal 21: Delivery Channel Configuration Uses Credential Store
6. Goal 14: Source Item Understanding Stage Annotates Collected Items
7. Goal 10: Setup Wizard Prepares Daily Brief For First Use
8. Goal 15: Signal Selection And Ranking Are Agent-Driven
9. Goal 16: Signal Narrative And Executive Summary Are Agent-Generated
10. Goal 17: Source-Grounding Audit Gates Brief Generation
11. Goal 18: Daily Brief Renderer Uses Agent Outputs And Chinese Labels
12. Goal 19: Workflow Commands Are Non-Interactive And Failure-Honest
13. Goal 20: NPM-Compatible Package Installs The Daily Brief CLI

Goals 11 and 12 can proceed in parallel after Goal 9 if ownership boundaries are kept separate. Goal 13 can proceed after Goal 11 without waiting for setup or delivery, while Goal 21 should follow Goal 11 because delivery credentials use the shared credential store. Goal 14 can proceed after Goal 13. Goal 10 should follow Goals 11, 12, and 21 so setup becomes the complete guided first-use flow. Goals 15 through 18 should stay sequential enough that each Agent Stage has validated upstream contracts before the next stage depends on it.

## Publication Checklist

- Create a parent PRD GitHub Issue from `docs/prd/agent-driven-brief-generation.md`.
- Publish Goals 9-21 as independent GitHub Issues.
- Use the local Goal draft files as the GitHub issue bodies; no separate `github-issue-bodies/` copies are needed for this new PRD.
- Treat Goal numbers as local planning ids, not expected GitHub issue numbers.
- Link each Goal Issue back to the parent PRD Issue in its body after the parent issue number exists.
- Create Goal Issues with the `needs-triage` label first.
- Do not apply `ready-for-agent` until the per-issue specification check confirms scope, evidence, dependencies, and current-state notes.
- Publish blockers before blocked Goals when possible so later issues can reference concrete issue numbers.
- Keep the parent PRD Issue open as the index and coverage tracker until all Goal Issues are resolved or explicitly deferred.

## Review Notes

- Goal 9 is the recommended first implementation slice because it establishes the installed CLI path model used by setup, Source Registry loading, Agent Run Artifacts, and packaging.
