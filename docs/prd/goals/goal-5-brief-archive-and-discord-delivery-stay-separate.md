# Goal 5: Brief Archive And Discord Delivery Stay Separate

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/6
- Intended Initial Label: `needs-triage`
- Ready For Agent: No

## Outcome

The full Daily Brief is stored in the Markdown Brief Archive, while Discord Delivery sends only a short notification or summary that points to the archived brief and never becomes the source of truth for full brief content.

## Scope

### Includes

- Writing full Daily Brief Markdown to `briefs/YYYY/MM/YYYY-MM-DD.md`.
- Keeping the Brief Archive as the long-term record for full Daily Brief content.
- Rendering a short Discord notification from the Daily Brief and archive path.
- Sending Discord notifications through a configured webhook.
- Skipping Discord Delivery with an explicit reason when no webhook is configured.
- Returning failed delivery status instead of throwing when Discord returns an error.
- Supporting Core Workflow Failure notifications through Discord when configured.

### Excludes

- Discord interaction controls.
- Discord as a control surface.
- Discord as the only archive of Daily Brief content.
- Reader Feedback controls.
- Scheduling.
- Brief generation logic.

## Acceptance Criteria

- Given rendered Daily Brief Markdown and a fixed date,
  When the Brief Archive writes the brief,
  Then the full Markdown is stored at `briefs/YYYY/MM/YYYY-MM-DD.md`,
  Evidence: archive/storage test or workflow test asserts the archive path and file contents.

- Given a Daily Brief with Signals and an archive path,
  When Discord notification rendering runs,
  Then the notification contains the date, short summary bullets, and archive path,
  Evidence: `npm test -- test/discord/delivery.test.ts` covers notification rendering.

- Given a Daily Brief with Signal details and citations,
  When Discord notification rendering runs,
  Then the Discord notification does not include full Signal details, raw citation ids, or `whyItMatters` prose,
  Evidence: `npm test -- test/discord/delivery.test.ts` asserts excluded full-detail fields.

- Given a configured Discord webhook transport,
  When Discord Delivery runs,
  Then one webhook request is sent and the delivery result is `{ status: "sent" }`,
  Evidence: `npm test -- test/discord/delivery.test.ts` covers mocked webhook sending.

- Given Discord Delivery has no enabled stored webhook credential,
  When delivery runs,
  Then delivery is skipped with reason `Discord delivery webhook is not configured` and the archived brief remains the full record,
  Evidence: `npm test -- test/agent/daily-workflow.test.ts` and `npm test -- test/cli/workflow-commands.test.ts` cover skipped delivery and the rejected legacy env path.

- Given Discord returns a non-success response,
  When delivery runs,
  Then delivery returns `{ status: "failed", reason: ... }` instead of throwing,
  Evidence: `npm test -- test/discord/delivery.test.ts` covers failed webhook response.

- Given a Core Workflow Failure and configured Discord webhook,
  When Core Workflow Failure delivery runs,
  Then Discord can send a failure notification that names the failure kind and does not claim a Daily Brief was generated,
  Evidence: `npm test -- test/discord/delivery.test.ts` covers Core Workflow Failure notification delivery.

## Evidence Required

- Commands:
  - `npm test -- test/discord/delivery.test.ts`
  - `npm test -- test/agent/daily-workflow.test.ts`
  - `npm run typecheck`
- Tests:
  - Brief Archive path/content test.
  - Discord notification render test.
  - Discord send, skip, and fail result tests.
  - Core Workflow Failure notification delivery test.
- Files:
  - `src/storage/brief-archive.ts`
  - `src/discord/delivery.ts`
  - `templates/discord-notification.md`
  - `test/discord/delivery.test.ts`
  - `test/agent/daily-workflow.test.ts`
- Logs/status:
  - Sample Discord notification body.
  - Sample archived brief path.

## Human Review Notes

- Discord should feel like a notification surface, not the reading experience or operational control plane.
- The notification should be short enough to scan quickly while making it obvious where the full archive entry lives.

## Current State Notes

- Existing:
  - `writeBriefArchive` writes date-based Markdown archive entries.
  - `renderDiscordNotification` uses `templates/discord-notification.md`.
  - Discord tests cover short notification rendering, webhook sending, failed webhook responses, and Core Workflow Failure notifications.
  - Workflow tests cover skipped Discord Delivery when no webhook is configured.
- Superseded by PR #36 / Goal 19:
  - Public runtime env overrides are limited to `DAILY_BRIEF_HOME` and `DAILY_BRIEF_DATA_HOME`.
  - `DISCORD_WEBHOOK_URL` is no longer a supported delivery configuration path; Discord delivery is configured through `config.yaml` and `auth.json`.
- Likely gaps:
  - A dedicated Brief Archive unit test may be useful if archive behavior should not rely only on workflow tests.
  - Completion evidence should include a sample notification body and archived brief path.

## PRD Traceability

- PRD: `docs/prd/mvp-daily-brief-agent.md`
- User Stories: 4, 12, 13
- Out of Scope Protected:
  - Discord interaction controls.
  - Discord control surface.
  - Reader Feedback.
- Dependencies:
  - Goal 4: Brief Module Generates Source-Grounded Daily Briefs.
