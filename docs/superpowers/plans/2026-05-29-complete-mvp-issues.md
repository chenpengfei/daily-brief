# Complete MVP Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining MVP GitHub issues by converting their evidence gaps into tested behavior, then close the issues and open a PR.

**Architecture:** Keep the existing TypeScript module boundaries: CLI orchestration stays in `src/cli.ts`, workflow failure decisions stay in `src/workflow/status.ts`, model/provider configuration gets a small agent-local module, and storage/brief behavior stays behind existing public functions. Tests exercise public APIs or command boundaries, not private helpers.

**Tech Stack:** TypeScript, Node.js 22+, Vitest, tsx, GitHub CLI, Pi Agent Runtime with faux provider for tests.

---

## Spec Constraints

- Source Registry remains the only collection-scope contract and must not store model provider, API keys, Discord secrets, priority, kind, fallback adapters, or concrete scraping tool names.
- CLI commands must be verifiable through command-boundary tests.
- Production runtime configuration must be adjustable through environment variables, not Source Registry fields.
- Tests must use mocked/faux model behavior; no test may require live LLM, Discord, X, GitHub, or RSS network access.
- Core Workflow Failure must not archive a false Daily Brief.
- Completion requires metrics evidence: `npm test`, `npm run typecheck`, command-boundary sample output, issue state updates, commit, push, and PR.

## Metric Gates

- Test suite: 100% passing with no skipped failing suites.
- Typecheck: exit 0.
- Issue tracker: #2, #3, #4, #5, #10, #11 closed as completed.
- PR: pushed branch and GitHub PR URL.

## File Structure

- Create `src/agent/model-runtime-config.ts`: parse and document model/provider env contract without leaking secrets.
- Modify `src/agent/daily-brief-agent.ts`: accept runtime config and send Core Workflow Failure notification for core failures.
- Modify `src/cli.ts`: export testable command runner, support env-based paths, keep command output stable.
- Modify `src/brief/daily-brief.ts`: expose `why_it_matters` in Markdown and cover all MVP Signal Types.
- Modify `src/domain/source.ts`: keep Source Registry rejection strict for secret/model fields.
- Create `test/cli/source-commands.test.ts`: command-boundary tests for Source CLI.
- Create `test/cli/workflow-commands.test.ts`: command-boundary tests for help, unknown commands, status, and run-once.
- Create `test/storage/source-item-store.test.ts`: Source Item Store path/read/malformed tests.
- Create `test/agent/model-runtime-config.test.ts`: env contract tests for model provider/secrets.
- Modify `test/brief/daily-brief.test.ts`: add Signal Type and `why_it_matters` coverage.
- Modify `test/workflow/status.test.ts` and `test/agent/daily-workflow.test.ts`: add Core Workflow Failure branch and notification delivery coverage.
- Modify `docs/operations.md`: document env contract and command metrics.

## Tasks

### Task 1: CLI Source Command Boundary

- [ ] Write failing tests in `test/cli/source-commands.test.ts` for `sources list`, `sources enable`, `sources disable`, missing Source id, and unknown Source id using a temporary Source Registry path from env.
- [ ] Run `npm test -- test/cli/source-commands.test.ts` and confirm RED.
- [ ] Refactor `src/cli.ts` to export `runCli(args, io, env)` and only auto-run when invoked as the entrypoint.
- [ ] Add env support for `DAILY_BRIEF_SOURCE_REGISTRY_PATH`.
- [ ] Run `npm test -- test/cli/source-commands.test.ts` and confirm GREEN.

### Task 2: Workflow CLI Command Boundary

- [ ] Write failing tests in `test/cli/workflow-commands.test.ts` for help output, unknown command, status output, and low-signal `run-once` output using temp registry/archive/source-item roots.
- [ ] Run `npm test -- test/cli/workflow-commands.test.ts` and confirm RED.
- [ ] Add env support in `src/cli.ts` for `DAILY_BRIEF_SOURCE_ITEM_ROOT`, `DAILY_BRIEF_ARCHIVE_ROOT`, `DAILY_BRIEF_DISCORD_TEMPLATE_PATH`, and `DISCORD_WEBHOOK_URL`.
- [ ] Run `npm test -- test/cli/workflow-commands.test.ts` and confirm GREEN.

### Task 3: Source Item Store Evidence

- [ ] Write failing tests in `test/storage/source-item-store.test.ts` for path calculation, missing daily file returning `[]`, append/read behavior, deduplication, and malformed JSONL throwing a path-aware error.
- [ ] Run `npm test -- test/storage/source-item-store.test.ts` and confirm RED.
- [ ] Update `src/storage/source-item-store.ts` to report malformed JSONL with file path and line number while preserving existing behavior.
- [ ] Run `npm test -- test/storage/source-item-store.test.ts` and confirm GREEN.

### Task 4: Brief Evidence

- [ ] Add failing tests in `test/brief/daily-brief.test.ts` for all four MVP Signal Types and Markdown label `why_it_matters`.
- [ ] Run `npm test -- test/brief/daily-brief.test.ts` and confirm RED.
- [ ] Update `src/brief/daily-brief.ts` minimally to render `why_it_matters` and satisfy Signal Type coverage.
- [ ] Run `npm test -- test/brief/daily-brief.test.ts` and confirm GREEN.

### Task 5: Core Workflow Failure Delivery

- [ ] Add failing tests for `briefGenerated: false` in `test/workflow/status.test.ts`.
- [ ] Add failing workflow test proving invalid Source Registry sends a Core Workflow Failure notification and does not archive a Daily Brief.
- [ ] Run targeted workflow tests and confirm RED.
- [ ] Update `src/agent/daily-brief-agent.ts` to convert unreadable Source Registry errors into Core Workflow Failure delivery results.
- [ ] Run targeted workflow tests and confirm GREEN.

### Task 6: Model Provider And Secrets Contract

- [ ] Write failing tests in `test/agent/model-runtime-config.test.ts` for default faux provider, env provider/model parsing, missing provider secret reporting, and Source Registry rejecting model/secret fields.
- [ ] Run `npm test -- test/agent/model-runtime-config.test.ts test/config/source-registry.test.ts` and confirm RED.
- [ ] Create `src/agent/model-runtime-config.ts` and document the env contract in `docs/operations.md`.
- [ ] Wire runtime config into `generateOnce`/`renderBriefThroughPiRuntime` without requiring live model calls in tests.
- [ ] Run targeted tests and confirm GREEN.

### Task 7: Full Verification And Issue Closure

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run command metrics: `npm run cli -- --help`, `npm run cli -- sources list`, and `npm run cli -- status`.
- [ ] Close #2, #3, #4, #5, #10, and #11 with evidence comments.
- [ ] Commit all changes.
- [ ] Push the branch.
- [ ] Create a PR with summary, metrics, and issue closure list.
