# Goal 21: Delivery Channel Configuration Uses Credential Store

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/20
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

Daily Brief can configure optional Discord Delivery through the Setup Wizard using credential references in `config.yaml` and secret values in `auth.json`, without storing webhooks in project files or making delivery part of the generation core.

## Scope

### Includes

- Discord Delivery configuration through `daily-brief setup`.
- Discord webhook credential stored under a stable reference such as `discord.default`.
- `config.yaml` delivery enabled state and `webhookRef`.
- Secret-redacted delivery readiness/status output.
- Optional delivery: disabled delivery does not block generation or archive writing.

### Excludes

- Discord interaction controls.
- Gateway or long-running Discord connection.
- LLM-generated Discord notification content.
- Rich Discord notification rendering.
- Workflow failure notifications.
- Multiple Delivery Channel types beyond Discord in the first version.

## Acceptance Criteria

- Given `daily-brief setup` reaches delivery configuration,
  When the user enables Discord and provides a webhook,
  Then `auth.json` stores the webhook under a stable credential reference and `config.yaml` stores the enabled state and `webhookRef`,
  Evidence: setup delivery configuration test.

- Given Discord Delivery is disabled,
  When setup completes,
  Then readiness reports delivery as disabled and generation remains valid without a webhook credential,
  Evidence: setup delivery-disabled test.

- Given delivery readiness/status output is printed,
  When a webhook credential exists,
  Then status reports readiness without printing the webhook URL,
  Evidence: status redaction test.

## Evidence Required

- Commands:
  - `npm test -- test/cli`
  - `npm run typecheck`
- Tests:
  - Setup delivery configure test.
  - Delivery status redaction test.
  - Delivery disabled status test.
- Files:
  - Setup Wizard delivery configuration path.
  - Credential store integration.
  - Discord delivery config reader.
- Logs/status:
  - Sample setup/readiness output with secret redacted.

## Human Review Notes

- Delivery setup should feel optional and safe.
- The CLI should be clear that Discord is a notification channel, not the source of truth.
- Keep first-version delivery intentionally small: credential and readiness/status.

## Current State Notes

- Existing:
  - Discord Delivery exists and can use a webhook from environment.
  - Discord tests cover transport behavior.
- Likely gaps:
  - Delivery credential storage in `auth.json` does not exist.
  - Older documentation may still mention removed public delivery commands.

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
