# Goal 11: Model Provider Configuration Uses Pi Abstractions

## Publication Status

- GitHub Issue: https://github.com/chenpengfei/daily-brief/issues/17
- Current Label: `ready-for-agent`
- Ready For Agent: Yes

## Parent PRD Issue

https://github.com/chenpengfei/daily-brief/issues/15

## Outcome

Daily Brief configures and uses LLM Providers through Pi model/provider/API/OAuth abstractions, with credentials stored behind stable references and no hand-rolled Codex transport in Daily Brief.

## Scope

### Includes

- LLM Provider configuration through `daily-brief setup`.
- Optional OAuth login and API key storage from the Setup Wizard.
- Default recommended provider/model: `openai-codex` / `gpt-5.5`.
- Support for Pi-backed OpenAI, DeepSeek, and OpenAI-compatible model choices.
- `auth.json` credential store with multiple credentials.
- `credentialRef` support using `provider.name` and `env:NAME`.
- Secret-redacted model readiness/status output.

### Excludes

- Implementing Daily Brief's own Codex payload, backend URL, header, or token refresh transport when Pi provides it.
- Storing provider secrets in `config.yaml` or `sources.yaml`.
- Publishing or validating real external credentials in tests.

## Acceptance Criteria

- Given `daily-brief setup` reaches model configuration,
  When a user selects a provider and model,
  Then `config.yaml` stores non-secret provider/model fields and a credential reference,
  Evidence: setup/config integration test.

- Given `daily-brief setup` runs without interactive input,
  When the command starts,
  Then it exits with file/environment-variable configuration guidance instead of accepting non-interactive model flags,
  Evidence: setup non-interactive command test.

- Given an API-key provider is configured,
  When the user supplies a credential,
  Then `auth.json` stores it under a stable credential reference and readiness/status output redacts the secret,
  Evidence: credential store test and redaction fixture.

- Given `openai-codex` is selected,
  When setup login is invoked,
  Then Daily Brief uses Pi OAuth/provider helpers rather than custom Codex transport code,
  Evidence: test with mocked Pi OAuth helper and code review notes.

- Given multiple credentials exist,
  When `config.yaml` switches the active `credentialRef`,
  Then model resolution uses the selected reference without deleting unused credentials,
  Evidence: unit test for credential resolution.

- Given setup is rerun,
  When the user keeps existing model credential choices,
  Then credentials are preserved and unused credentials remain available,
  Evidence: setup reentrancy and credential store tests.

## Evidence Required

- Commands:
  - `npm test -- test/agent`
  - `npm test -- test/cli`
  - `npm run typecheck`
- Tests:
  - Provider config tests.
  - Setup non-interactive failure tests.
  - Credential ref resolution tests.
  - Setup reentrancy credential preservation tests.
  - Secret redaction tests.
  - Mocked Pi OAuth tests.
- Files:
  - Model config module.
  - Credential store module.
  - Setup Wizard model configuration path.
- Logs/status:
  - Sample setup/status output with redaction.

## Human Review Notes

- The design should make provider switching feel routine.
- Daily Brief should lean on Pi abstractions rather than becoming a parallel model SDK.

## Current State Notes

- Existing:
  - A preliminary model runtime config module exists.
  - Current attempted Codex code may hand-roll auth/transport behavior.
- Likely gaps:
  - Provider model is too narrow.
  - `auth.json` credential store does not yet match the PRD.
  - Older documentation may still mention removed public model commands.

## PRD Traceability

- PRD: `docs/prd/agent-driven-brief-generation.md`
- ADR: `docs/adr/0006-use-pi-model-provider-abstraction-for-agent-stages.md`
- User Stories / Observable Behaviors: See `docs/prd/agent-driven-brief-generation-goal-map.md` User Story Coverage.
- Requirement Areas: LLM Provider Configuration, Model Credential Store.
- Out of Scope Protected:
  - Daily Brief-owned Codex transport.
  - Secrets in committed config.
- Dependencies:
  - Goal 9: https://github.com/chenpengfei/daily-brief/issues/16
