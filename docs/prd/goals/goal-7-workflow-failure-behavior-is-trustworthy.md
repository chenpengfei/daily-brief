# Goal 7: Workflow Failure Behavior Is Trustworthy

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/5
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

The Daily Brief Agent distinguishes routine partial failures from material partial failures and Core Workflow Failures, preserving trust by surfacing meaningful incompleteness and sending failure notifications instead of false Daily Briefs when the core workflow cannot honestly complete.

## Scope

### Includes

- Classifying workflow health as `success`, `partial-failure`, or `core-failure`.
- Treating non-material issues such as missing transcripts, rate limits, or individual parse failures as routine when a usable brief can still be generated.
- Reporting material Source Coverage gaps without converting them into Core Workflow Failures.
- Producing Core Workflow Failure notifications that name the failure kind and state no Daily Brief was generated.
- Operational Status behavior for unreadable Source Registry, missing archive entry, and existing archive entry.
- Discord-ready Core Workflow Failure delivery when configured.

### Excludes

- Retry policy design.
- Alert escalation beyond Discord notification/status.
- Hiding failures from logs or status.
- Generating unsupported Daily Brief claims to compensate for missing data.

## Acceptance Criteria

- Given partial collection failures caused by missing transcript, rate limit, or one-item parse failure,
  When workflow status is evaluated after a brief is generated,
  Then health is `success` and material partial failures are empty,
  Evidence: `npm test -- test/workflow/status.test.ts` covers routine partial failure handling.

- Given a material Source failure such as authentication failure,
  When workflow status is evaluated after a brief is generated,
  Then health is `partial-failure` and the failure appears in `materialPartialFailures`,
  Evidence: `npm test -- test/workflow/status.test.ts` covers material partial failure reporting.

- Given Daily Brief generation does not produce archiveable content,
  When workflow status is evaluated,
  Then health is `core-failure` with kind `brief-generation-unavailable`,
  Evidence: workflow status test covers missing brief generation output.

- Given an unreadable or invalid Source Registry,
  When Operational Status runs,
  Then health is `core-failure` with kind `unreadable-source-registry`,
  Evidence: `npm test -- test/workflow/status.test.ts` covers unreadable Source Registry status.

- Given no Daily Brief archive exists yet for the date but the Source Registry is readable,
  When Operational Status runs,
  Then health is `partial-failure` with a message that no archive exists yet,
  Evidence: `npm test -- test/workflow/status.test.ts` covers missing archive status.

- Given a Core Workflow Failure,
  When failure notification text is created,
  Then it includes the failure kind, message, and a statement that no Daily Brief was generated because a false brief would break trust,
  Evidence: `npm test -- test/workflow/status.test.ts` covers Core Workflow Failure notification text.

- Given a Core Workflow Failure and configured Discord webhook,
  When failure delivery runs,
  Then Discord receives a failure notification rather than a Daily Brief notification,
  Evidence: `npm test -- test/discord/delivery.test.ts` covers Core Workflow Failure delivery.

## Evidence Required

- Commands:
  - `npm test -- test/workflow/status.test.ts`
  - `npm test -- test/discord/delivery.test.ts`
  - `npm run typecheck`
- Tests:
  - Routine partial failure classification.
  - Material partial failure classification.
  - Core Workflow Failure status.
  - Operational Status for registry/archive cases.
  - Core Workflow Failure notification text and delivery.
- Files:
  - `src/workflow/status.ts`
  - `src/discord/delivery.ts`
  - `test/workflow/status.test.ts`
  - `test/discord/delivery.test.ts`
- Logs/status:
  - Sample `status` output for success, partial failure, and core failure.
  - Sample Core Workflow Failure notification.

## Human Review Notes

- The failure model should protect reader trust more than it protects a green status.
- Partial failure wording should be calm and actionable, not noisy.

## Current State Notes

- Existing:
  - `evaluateWorkflowStatus` distinguishes success, material partial failure, and core failure.
  - `getOperationalStatus` checks Source Registry readability and archive existence.
  - `createCoreWorkflowFailureNotification` creates failure text.
  - Tests cover routine vs material partial failures, failure notification text, and Operational Status cases.
  - Discord tests cover Core Workflow Failure notification delivery.
- Likely gaps:
  - The `briefGenerated: false` branch may need explicit test coverage if not already covered.
  - End-to-end `runOnce` may need to call Core Workflow Failure delivery for core failures instead of relying only on status helpers.
  - CLI boundary evidence for `status` output belongs to Goal 6 unless this Goal is expanded.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 10, 11
- Out of Scope Protected:
  - Unsupported claims in Daily Brief.
  - Alert escalation beyond MVP Discord/status behavior.
- Dependencies:
  - Goal 3: Collection Persists Incremental Source Items Reliably.
  - Goal 4: Brief Module Generates Source-Grounded Daily Briefs.
  - Goal 5: Brief Archive And Discord Delivery Stay Separate.
