# Goal 21: Delivery Channel Configuration Uses Credential Store

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/20
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

Daily Brief can configure optional Discord Delivery through focused CLI commands using credential references in `config.yaml` and secret values in `auth.json`, without storing webhooks in project files or making delivery part of the generation core.

## Scope

### Includes

- `daily-brief delivery configure`.
- `daily-brief delivery status`.
- `daily-brief delivery test`.
- Discord webhook credential stored under a stable reference such as `discord.default`.
- `config.yaml` delivery enabled state and `webhookRef`.
- Secret-redacted delivery status.
- Optional delivery: disabled delivery does not block generation or archive writing.

### Excludes

- Discord interaction controls.
- Gateway or long-running Discord connection.
- LLM-generated Discord notification content.
- Rich Discord notification rendering.
- Workflow failure notifications.
- Multiple Delivery Channel types beyond Discord in the first version.

## Acceptance Criteria

- Given `daily-brief delivery configure` runs,
  When the user enables Discord and provides a webhook,
  Then `auth.json` stores the webhook under a stable credential reference and `config.yaml` stores the enabled state and `webhookRef`,
  Evidence: CLI delivery configuration test.

- Given Discord Delivery is disabled,
  When `daily-brief delivery status` runs,
  Then status reports delivery as disabled and generation remains valid without a webhook credential,
  Evidence: delivery-disabled status test.

- Given `daily-brief delivery status` runs,
  When a webhook credential exists,
  Then status reports readiness without printing the webhook URL,
  Evidence: status redaction test.

- Given `daily-brief delivery test` runs with a configured webhook,
  When the test transport is mocked,
  Then a minimal deterministic test notification is sent through the configured credential reference,
  Evidence: mocked delivery test.

## Evidence Required

- Commands:
  - `npm test -- test/cli`
  - `npm test -- test/discord`
  - `npm run typecheck`
- Tests:
  - Delivery configure test.
  - Delivery status redaction test.
  - Delivery disabled status test.
  - Delivery test command with mocked transport.
- Files:
  - Delivery config command implementation.
  - Credential store integration.
  - Discord delivery config reader.
- Logs/status:
  - Sample delivery status output with secret redacted.

## Human Review Notes

- Delivery setup should feel optional and safe.
- The CLI should be clear that Discord is a notification channel, not the source of truth.
- Keep first-version delivery intentionally small: credential, status, and test.

## Current State Notes

- Existing:
  - Discord Delivery exists and can use a webhook from environment.
  - Discord tests cover transport behavior.
- Likely gaps:
  - Delivery credential storage in `auth.json` does not exist.
  - Delivery configuration commands do not exist.
  - Delivery status currently does not resolve credential references.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: Delivery Channel configuration, Model Credential Store, Discord Delivery setup.
- Out of Scope Protected:
  - Discord control surface.
  - Gateway.
  - LLM-generated Discord notification.
  - Rich Discord notification rendering.
  - Workflow failure notifications.
- Dependencies:
  - Goal 9: https://github.com/chenpengfei/daily-brief/issues/16
  - Goal 11: https://github.com/chenpengfei/daily-brief/issues/17
