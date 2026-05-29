# Goal Issues

Goal Issues are the execution unit for Coding Agents. A PRD Issue describes human direction, product boundaries, and non-goals; it should index the Goal Issues rather than serve as the direct implementation task.

## Goal map

Do not create Goal Issues directly from a PRD. First produce a Goal Map that checks coverage and sequencing:

- **PRD Outcome**: the final product outcome in one sentence.
- **Goal Issues**: the proposed end-to-end product slices.
- **User Story Coverage**: a table mapping every PRD User Story to a goal or explicit status.
- **Coverage Check**: which out-of-scope items are protected, known dependencies, and suggested execution order.

The Goal Map should be reviewed before Goal Issues are created or labeled `ready-for-agent`.

User Story Coverage statuses are:

- `Covered`
- `Deferred`
- `Out of Scope`
- `Already Satisfied`
- `Needs Goal`

Any `Needs Goal` status blocks creation of a `ready-for-agent` execution queue.

## PRD to Goal Issues workflow

Use this workflow for each PRD:

1. Read the PRD and existing domain docs.
2. Produce a Goal Map before drafting issues.
3. Check User Story Coverage and out-of-scope protection.
4. Draft one Goal Issue at a time.
5. Run a specification check against the Goal Issue.
6. Publish the Goal Issue to GitHub with `needs-triage`.
7. Promote the Goal Issue to `ready-for-agent` only after the specification checklist passes.

## Issue lifecycle

Create new Goal Issues with `needs-triage` first. Move a Goal Issue to `ready-for-agent` only after a specification check confirms:

- Scope is unambiguous.
- Every Acceptance Criterion has Evidence.
- The Goal Map has no blocking `Needs Goal` status.
- Current State Notes are accurate and non-blocking.
- Dependencies are clear.

Local Markdown drafts are not official Goal Issues. If GitHub issue creation is unavailable, keep the local file as an issue body draft and do not treat it as part of the execution queue until it is published to GitHub with the appropriate label.

## Required sections

Each Goal Issue must include:

- **Outcome**: the user-visible or system-visible capability that exists when the goal is complete.
- **Scope**: what this goal includes and intentionally excludes.
- **Acceptance Criteria**: observable facts that can be judged true or false.
- **Evidence**: the commands, generated files, output, tests, logs, or state changes the Coding Agent must provide when claiming completion.
- **Human Review Notes**: subjective quality expectations that require maintainer judgment.

Use this Markdown template for every `ready-for-agent` Goal Issue:

```md
## Outcome

<The user-visible or system-visible capability that exists when the goal is complete.>

## Scope

### Includes

- ...

### Excludes

- ...

## Acceptance Criteria

- Given ...
  When ...
  Then ...
  Evidence: ...

## Evidence Required

- Commands:
- Tests:
- Files:
- Logs/status:

## Human Review Notes

- ...

## Current State Notes

- Existing:
- Likely gaps:

## PRD Traceability

- PRD:
- User Stories:
- Out of Scope Protected:
- Dependencies:
```

## Sizing

A Goal Issue should be an end-to-end product slice. It may cross modules, but it should not be only an internal helper, type, file, or refactor. It should also not combine multiple independent product capabilities.

Good Goal Issues can usually be completed in one continuous Coding Agent work session and produce concrete evidence such as a passing command, generated artifact, status output, or tested failure behavior.

## Acceptance criteria

Every Acceptance Criterion must bind to at least one observable evidence type:

- **Command evidence**: a command runs with a defined exit code or output.
- **File evidence**: a file is created or updated at a defined path and format.
- **Test evidence**: a behavior is covered by a named test or test command.
- **State or failure evidence**: an exceptional scenario has a defined visible result.
- **Boundary evidence**: a non-goal is protected by an observable absence of behavior.

Subjective quality expectations should live in Human Review Notes, not Acceptance Criteria. An issue should only receive `ready-for-agent` when every Acceptance Criterion has observable evidence.

Prefer writing Acceptance Criteria in this shape:

```md
- Given <initial state or fixture>,
  When <user action, command, or system event>,
  Then <observable result>,
  Evidence: <test, command output, generated file, log, or state proof>.
```

`Given` names the precondition. `When` names the action. `Then` names the expected result. `Evidence` names how the Coding Agent must prove the result.

Quantify observable system behavior, especially command names, exit codes, file paths, required sections, field names, supported coverage, cadence, rerun behavior, and failure outcomes. Do not force subjective quality expectations into numeric Acceptance Criteria; keep them in Human Review Notes.
