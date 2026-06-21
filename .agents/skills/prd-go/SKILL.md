---
name: prd-go
description: Automates the post-design PRD-to-Goal-Issue-to-PR closure loop, including smooth handoff from grill-with-docs business/system design discussions, GitHub issue creation, implementation, testing, PR creation, review publication, and bounded repair cycles. Use when the user has finished business and system design grilling, has a PRD or Goal Issue, or wants an agent to carry the agreed plan through reviewed PR readiness.
---

# PRD Go

Drive one PRD or Goal Issue from planning through a reviewed PR without letting one long context own every decision.

## Non-negotiables

- Treat `grill-with-docs` outputs as the normal upstream source for both business design and system design: resolved terms in `CONTEXT.md`, relevant ADRs, concrete scenarios, non-goals, implementation constraints, and any remaining open questions must flow into the PRD/Goal Issue without being re-litigated.
- Do not restart business or system design grilling. Ask the human only for unresolved decisions that block PRD synthesis, Goal Issue specification, implementation, or real local-host verification.
- Do not ask the human to choose a test environment at startup. Unit tests must run in a sandboxed or isolated environment, and end-to-end verification must run in the real local-host environment.
- Every PR must include both unit-test evidence and real local-host end-to-end evidence. If real local-host verification needs human setup, ask for the smallest exact action only when that blocker is reached.
- The main agent is only the coordinator. Every repo, GitHub, implementation, test, evidence, PR, review, and repair action must run in a subagent.
- Before any PR is pushed or opened, exactly three local code-review subagents must independently review the local branch/diff. The PR may be submitted only after all P1 and P2 findings, and any more severe findings, are fixed or reclassified with evidence by a follow-up local review.
- GitHub issue comments, PR comments, PR review bodies, and review responses must be written in Chinese. Titles may be English.
- The local pre-PR review gate and the post-PR review/repair loop may each run at most 3 rounds. If the local gate still has P1/P2-or-worse findings after round 3, do not submit a PR; ask the human for direction. If post-PR round 3 still fails, stop, publish a Chinese blocker summary on the PR, and ask the human for direction.
- Preserve human changes. No destructive Git commands unless the human explicitly asks.
- Do not merge unless the human explicitly asks for merge and branch protection allows it.

## Quick Start

1. Discover subagent tooling. If the `Agent` tool is unavailable, use tool discovery for multi-agent/subagent tools. If no subagent capability exists, stop and explain that this skill cannot satisfy its isolation contract.
2. Spawn an Intake subagent to classify the source as `grill-with-docs handoff`, PRD, or Goal Issue. It must read `docs/agents/issue-tracker.md`, `docs/agents/goal-issues.md`, `docs/agents/triage-labels.md`, `docs/agents/domain.md`, `AGENTS.md`, and relevant domain docs.
3. If starting from a `grill-with-docs` handoff, spawn a PRD Synthesis subagent to turn the agreed discussion and domain docs into a PRD Issue or publishable PRD draft before Goal Mapping.
4. If starting from a PRD, spawn Goal Map and Goal Issue subagents before implementation. Publish Goal Issues to GitHub with `needs-triage`, then promote to `ready-for-agent` only after the spec checklist passes.
5. Spawn an Implementation subagent to create/switch a `codex/` branch, implement the Goal Issue, run sandboxed unit tests, run real local-host end-to-end verification, collect evidence, and prepare local commits without pushing or opening a PR.
6. Spawn exactly three local Pre-PR Code Review subagents to review the local branch/diff along independent axes. If any P1/P2-or-worse findings exist, spawn a local Repair subagent, then repeat local review through at most 3 rounds. Do not push or open a PR until this gate passes.
7. Spawn a PR Submission subagent to push the reviewed branch and open the PR with Chinese evidence summary.
8. Spawn Review subagents to review the PR along independent axes, then spawn a Publication subagent to submit the Chinese review comments to GitHub.
9. If review passes, spawn a Closure subagent to post final Chinese evidence and the current PR/check status. If review fails, spawn a Repair subagent and repeat review through at most 3 rounds.

See [REFERENCE.md](REFERENCE.md) for subagent briefs, GitHub comment templates, and loop rules.

## Coordinator Rules

- Keep only identifiers in the main context: handoff source, PRD issue, Goal Issue, branch, PR URL, loop number, unit-test status, end-to-end status, and pass/fail status.
- Do not read large diffs or code in the main context. Ask subagents for concise summaries and links to durable artifacts.
- Run independent subagents in parallel when safe: Goal Issue spec check, local pre-PR code reviewers, standards review, spec review, test-evidence audit.
- Any human assistance request must be precise: say what is blocked, what the human must do, and how the next subagent should resume.

## Done

The loop is complete when a subagent has verified that:

- the Goal Issue is linked from the PR,
- sandboxed unit-test evidence and real local-host end-to-end evidence pass,
- the local pre-PR code-review gate passed with no unresolved P1/P2-or-worse findings,
- review findings are either fixed or explicitly accepted as non-blocking,
- GitHub has a Chinese final evidence comment, and
- the PR is open, pushed, and ready for human merge or already merged by explicit human request.
