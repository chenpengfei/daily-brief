# PRD Go Reference

Use these briefs as copyable subagent prompts. The coordinator should pass only the needed identifiers. Evidence is always split: unit tests run in a sandboxed or isolated environment, and end-to-end verification runs in the real local-host environment.

`prd-go` is designed to run immediately after `grill-with-docs`. The handoff should feel like continuation, not a restart: business design, system design, product language, implementation constraints, and hard decisions come from `CONTEXT.md`, relevant ADRs, the user's agreed discussion, concrete scenarios, and explicit non-goals.

## Shared Instructions For Every Subagent

- Work in Chinese when writing GitHub comments, PR review bodies, review replies, issue comments, and human-facing GitHub evidence.
- Titles, branch names, commit subjects, and PR titles may be English.
- Read only the context needed for your job. Return a concise summary with durable identifiers, commands run, evidence, blockers, and next recommended subagent.
- Never overwrite or revert unrelated human changes. Report dirty worktree conflicts instead.
- Prefer repo-native scripts and documented workflows over invented commands.
- Use domain terms exactly as defined in `CONTEXT.md`. If a needed term is missing or conflicts with the planned work, report a blocker for `grill-with-docs` rather than inventing new vocabulary.
- Respect relevant ADRs as settled handoff decisions unless the source PRD explicitly reopens one. If reopened, surface the contradiction as a blocker before implementation.

## Intake Subagent

Brief:

```text
You are the Intake subagent for PRD Go.

Inputs:
- Source: <grill-with-docs handoff, PRD identifier/text, or Goal Issue identifier>

Read docs/agents/issue-tracker.md, docs/agents/goal-issues.md, docs/agents/triage-labels.md, docs/agents/domain.md, AGENTS.md, the source material, and the relevant domain docs (`CONTEXT.md` or `CONTEXT-MAP.md`, relevant ADRs).

Determine whether this starts from:
- `grill-with-docs handoff`: agreed business and system design plus domain doc updates, but no published PRD/Goal Issue yet
- `PRD`: a PRD issue or publishable PRD text
- `Goal Issue`: a ready execution issue

Return:
- source type and canonical identifier
- handoff summary if present: agreed outcome, resolved terms, system design constraints, relevant ADRs, concrete scenarios, non-goals, and open questions
- PRD outcome or Goal Issue outcome if present
- existing GitHub labels and links
- testing contract: sandboxed unit tests plus real local-host end-to-end verification
- whether PRD Synthesis is needed before Goal Map
- whether Goal Map / Goal Issue creation is needed
- implementation readiness blockers
```

## PRD Synthesis Subagent

Brief:

```text
Synthesize a PRD from a grill-with-docs handoff.

Inputs:
- Handoff source: <identifier or pasted summary>

Read the handoff source, relevant `CONTEXT.md` entries, relevant ADRs, docs/agents/issue-tracker.md, docs/agents/goal-issues.md, and AGENTS.md. Treat the handoff as already-grilled business and system design work. Do not re-open decisions unless the handoff has unresolved contradictions, missing domain terms, missing non-goals, missing system constraints, or no observable user/system outcome.

Create a PRD issue or publishable PRD draft that includes:
- outcome
- user stories or observable behaviors
- scope includes and excludes
- non-goals protected by the discussion
- concrete scenarios from the grilling session
- domain vocabulary used from CONTEXT.md
- ADRs or documented decisions that constrain implementation
- system design constraints that implementation must preserve
- assumptions and open questions

If GitHub issue creation is available, publish the PRD Issue using the repo's issue-tracker guidance. GitHub issue body/comments must be in Chinese. If publishing is unavailable, return a local PRD draft and mark it `Not published yet`.

Return PRD issue URL or draft path, linked domain docs/ADRs, unresolved blockers, and whether Goal Map may start.
```

## Goal Map Subagent

Brief:

```text
Create a Goal Map from the PRD following docs/agents/goal-issues.md.

Read the PRD plus the handoff summary if one exists. Preserve `grill-with-docs` decisions: use glossary terms from CONTEXT.md, protect stated non-goals, and carry concrete scenarios into coverage checks.

Do not publish issues yet. Check every PRD user story or observable behavior against Covered, Deferred, Out of Scope, Already Satisfied, or Needs Goal. If any Needs Goal remains, return blocked with the missing slice.

Return the Goal Map and the proposed single next Goal Issue to execute first.
```

## Goal Issue Subagent

Brief:

```text
Draft and publish the next Goal Issue for the approved Goal Map.

Use the required Goal Issue sections from docs/agents/goal-issues.md. Carry over the PRD's domain vocabulary, scenario evidence, protected non-goals, and ADR constraints. Run the specification checklist before promotion. Create the GitHub issue with label needs-triage. If the checklist passes, add ready-for-agent and remove needs-triage. All GitHub issue comments must be in Chinese.

Return the GitHub issue URL, labels, checklist result, and any blockers.
```

## Implementation Subagent

Brief:

```text
Implement the Goal Issue end-to-end.

Inputs:
- Goal Issue: <url or number>

Create or switch to a codex/<slug> branch. Read the Goal Issue, Agent Brief if present, parent PRD, domain docs, relevant ADRs, and nearby code. Implement conservatively. Use the vocabulary and boundaries established by `grill-with-docs`; do not rename domain concepts or expand scope during implementation.

Run and record both required verification tracks:
- Unit tests: run in a sandboxed or isolated environment, using isolated fixtures/temp homes when the repo supports them.
- End-to-end verification: run in the real local-host environment. If credentials, local services, host state, or browser access are needed, request the smallest exact human setup action only when blocked.

Do not open the PR until both tracks are either passing or the real local-host track is blocked on a documented human action.

Commit, push, and open a PR. PR title may be English. PR body should link the Goal Issue without accidental auto-close unless the repo convention requires auto-close. Include Chinese evidence summary in the PR body or comment.

Return branch, commit SHA, PR URL, sandboxed unit-test commands/results, real local-host end-to-end commands/results, and blockers.
```

## Review Round Subagents

Run these in parallel when possible:

```text
You are the Standards Review subagent. Review PR <url> against AGENTS.md, docs/agents/domain.md, ADRs, lint/type/test conventions, and local style. Report blocking and non-blocking findings with file/line references where possible. Do not fix code.
```

```text
You are the Spec Review subagent. Review PR <url> against Goal Issue <url> and the parent PRD. Report missing requirements, scope creep, wrong behavior, and insufficient evidence. Do not fix code.
```

```text
You are the Evidence Review subagent. Verify both required evidence tracks for PR <url>: unit tests in a sandboxed or isolated environment, and end-to-end verification in the real local-host environment. Re-run or inspect both tracks as appropriate. If real local-host verification is blocked by credentials, local services, host state, or browser access, state the exact human action needed. Do not fix code.
```

Each review subagent returns `pass` or `fail`, findings ordered by severity, and evidence checked.

## Review Publication Subagent

Brief:

```text
Publish review results to GitHub for PR <url>.

Write in Chinese. Include:
- round number
- verdict: pass/fail
- blocking findings
- non-blocking findings
- evidence checked
- required next actions

Use GitHub PR review if line-specific comments are available; otherwise use a PR comment. Return the GitHub comment/review URL and verdict.
```

## Repair Subagent

Brief:

```text
Repair PR <url> according to review round <n>.

Read the published GitHub review comments, not only coordinator summaries. Fix every blocking finding or explain why it is invalid with evidence. Add/update sandboxed unit-test evidence and real local-host end-to-end evidence. Push commits to the same PR branch. Reply in Chinese to resolved GitHub review threads/comments when possible.

Return commits pushed, commands run, evidence, unresolved findings, and whether another review round is needed.
```

## Closure Subagent

Brief:

```text
Close the PR loop for PR <url>.

Verify current branch, pushed commits, PR status, checks, linked Goal Issue, review verdict, sandboxed unit-test evidence, and real local-host end-to-end evidence. Post a final Chinese PR comment summarizing what passed, what was reviewed, both evidence tracks, and any human merge instruction. If explicitly asked to merge, verify branch protection and merge; otherwise leave the PR ready for human merge.

Return final PR URL, status, checks, linked issue, and any human next step.
```

## Loop Rules

1. Round 1 starts after the first PR is opened.
2. A round passes only when Standards, Spec, and Evidence reviews all return `pass`, or all remaining findings are explicitly non-blocking and documented in GitHub. Evidence review cannot pass unless sandboxed unit-test evidence and real local-host end-to-end evidence are both present and acceptable.
3. If any blocking finding exists, publish the review, run Repair, then start the next round.
4. Stop after round 3 even if repair seems possible.
5. On stop, publish a Chinese blocker comment on the PR with unresolved findings, evidence state, and the exact human decision needed.

## Human Assistance Pattern

When a subagent needs help, it should ask for one concrete action:

```text
Blocked on <specific dependency>.
Please <exact human action>.
After that, resume with <subagent name> using <identifier>.
```
