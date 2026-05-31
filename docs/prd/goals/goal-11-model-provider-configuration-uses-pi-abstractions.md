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

- `daily-brief model configure`.
- `daily-brief model login`.
- `daily-brief model logout`.
- `daily-brief model status`.
- Default recommended provider/model: `openai-codex` / `gpt-5.5`.
- Support for Pi-backed OpenAI, DeepSeek, and OpenAI-compatible model choices.
- `auth.json` credential store with multiple credentials.
- `credentialRef` support using `provider.name` and `env:NAME`.
- Secret-redacted model status.

### Excludes

- Implementing Daily Brief's own Codex payload, backend URL, header, or token refresh transport when Pi provides it.
- Storing provider secrets in `config.yaml` or `sources.yaml`.
- Publishing or validating real external credentials in tests.

## Acceptance Criteria

- Given `daily-brief model configure` runs,
  When a user selects a provider and model,
  Then `config.yaml` stores non-secret provider/model fields and a credential reference,
  Evidence: CLI/config integration test.

- Given `daily-brief model configure` runs with non-interactive flags,
  When required provider, model, and credential reference values are supplied,
  Then `config.yaml` is updated without prompting; otherwise the command exits with a clear missing-flag error,
  Evidence: CLI non-interactive configure test.

- Given an API-key provider is configured,
  When the user supplies a credential,
  Then `auth.json` stores it under a stable credential reference and `model status` redacts the secret,
  Evidence: credential store test and status output fixture.

- Given `openai-codex` is selected,
  When model login is invoked,
  Then Daily Brief uses Pi OAuth/provider helpers rather than custom Codex transport code,
  Evidence: test with mocked Pi OAuth helper and code review notes.

- Given multiple credentials exist,
  When `config.yaml` switches the active `credentialRef`,
  Then model resolution uses the selected reference without deleting unused credentials,
  Evidence: unit test for credential resolution.

- Given `daily-brief model logout` runs for a selected credential reference,
  When the credential exists,
  Then only that credential reference is removed or marked inactive and other credentials remain available,
  Evidence: credential logout test.

## Evidence Required

- Commands:
  - `npm test -- test/agent`
  - `npm test -- test/cli`
  - `npm run typecheck`
- Tests:
  - Provider config tests.
  - Non-interactive configure tests.
  - Credential ref resolution tests.
  - Credential logout tests.
  - Secret redaction tests.
  - Mocked Pi OAuth tests.
- Files:
  - Model config module.
  - Credential store module.
  - CLI model commands.
- Logs/status:
  - Sample `daily-brief model status` output with redaction.

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
  - CLI model commands do not exist.

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
