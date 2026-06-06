---
name: prd-go
description: Automates the full PRD-to-Goal-Issue-to-PR closure loop with GitHub issue creation, local implementation, testing, PR creation, PR review, review-comment publication, and bounded repair cycles. Use when the user wants an agent to implement a PRD or Goal Issue end-to-end, create a GitHub PR, review it, fix review findings, and repeat until review passes.
---

# PRD Go

Drive one PRD or Goal Issue from planning through a reviewed PR without letting one long context own every decision.

## Non-negotiables

- Before any repo or GitHub action, ask the human: `PR 审查期间要使用本地主机环境做真实端到端测试，还是使用沙箱环境完成端到端测试？`
- The main agent is only the coordinator. Every repo, GitHub, implementation, test, evidence, PR, review, and repair action must run in a subagent.
- GitHub issue comments, PR comments, PR review bodies, and review responses must be written in Chinese. Titles may be English.
- The review/repair loop may run at most 10 rounds. If round 10 still fails, stop, publish a Chinese blocker summary on the PR, and ask the human for direction.
- Preserve human changes. No destructive Git commands unless the human explicitly asks.
- Do not merge unless the human explicitly asks for merge and branch protection allows it.

## Quick Start

1. Ask the required end-to-end test environment question and wait for the answer.
2. Discover subagent tooling. If the `Agent` tool is unavailable, use tool discovery for multi-agent/subagent tools. If no subagent capability exists, stop and explain that this skill cannot satisfy its isolation contract.
3. Spawn an Intake subagent to read the PRD or Goal Issue, `docs/agents/issue-tracker.md`, `docs/agents/goal-issues.md`, `docs/agents/triage-labels.md`, and domain docs.
4. If starting from a PRD, spawn Goal Map and Goal Issue subagents before implementation. Publish Goal Issues to GitHub with `needs-triage`, then promote to `ready-for-agent` only after the spec checklist passes.
5. Spawn an Implementation subagent to create/switch a `codex/` branch, implement the Goal Issue, run tests, collect evidence, commit, push, and open a PR.
6. Spawn Review subagents to review the PR along independent axes, then spawn a Publication subagent to submit the Chinese review comments to GitHub.
7. If review passes, spawn a Closure subagent to post final Chinese evidence and the current PR/check status. If review fails, spawn a Repair subagent and repeat review through at most 10 rounds.

See [REFERENCE.md](REFERENCE.md) for subagent briefs, GitHub comment templates, and loop rules.

## Coordinator Rules

- Keep only identifiers in the main context: PRD issue, Goal Issue, branch, PR URL, loop number, test environment choice, and pass/fail status.
- Do not read large diffs or code in the main context. Ask subagents for concise summaries and links to durable artifacts.
- Run independent subagents in parallel when safe: Goal Issue spec check, standards review, spec review, test-evidence audit.
- Any human assistance request must be precise: say what is blocked, what the human must do, and how the next subagent should resume.

## Done

The loop is complete when a subagent has verified that:

- the Goal Issue is linked from the PR,
- required tests and selected end-to-end evidence pass,
- review findings are either fixed or explicitly accepted as non-blocking,
- GitHub has a Chinese final evidence comment, and
- the PR is open, pushed, and ready for human merge or already merged by explicit human request.
