# Changelog

All notable changes for Formal Releases are recorded here. GitHub Release notes should be derived from the matching version entry.

## 0.2.0 - 2026-08-01

Minor release for explicit live-source readiness checks, broader official-source coverage, and removal of X support.

### User-visible Changes

- Adds `daily-brief adapters probe`, a dry-run command that checks enabled Sources serially, reports per-Source progress and samples, and fails when live-capable Fetch Adapters lack successful non-empty live evidence.
- Adds live-capable Fetch Adapters for OpenAI News, Anthropic News and Engineering, and Claude Platform release notes; the default Source Registry also includes Claude Code Releases through RSS and keeps GitHub Trending.
- Removes the X Fetch Adapter, X API credential provider, X-specific probe behavior, and X Sources from fresh setup defaults.
- Cleans generated build output before packaging so removed adapters cannot remain in the npm package as stale files.

### Installation and Upgrade Notes

- Upgrade with `npm install -g @chenpengfei/daily-brief@latest`.
- Before upgrading, remove Sources whose `adapter` is `x` from `~/.daily-brief/sources.yaml` and remove credentials whose `provider` is `x` from `~/.daily-brief/auth.json`; X collection is no longer supported.
- Existing `sources.yaml` files are preserved by `daily-brief setup`. To adopt the new official-source defaults, review `$(npm root -g)/@chenpengfei/daily-brief/config/sources.example.yaml` and copy only the Sources you want to monitor.
- Run `daily-brief adapters probe` after upgrading to verify current external-source readiness. Probe output can contain Source ids, targets, and item samples, so do not publish output from a personal Source Registry.

### Known Limitations

- X accounts, lists, searches, and posts are not supported Sources in v0.2.0.
- Live Adapter Probe results depend on current external platform behavior and enabled local Sources; deterministic tests do not replace this check.
- Live Adapter Probe is an explicit local command and is not run by default during `npm test` or CI.

## 0.1.4 - 2026-06-06

Patch release for command-surface separation and configuration-first inspection.

### User-visible Changes

- Adds `daily-brief config` as the read-only place to inspect paths, Source Registry readiness, model settings, delivery settings, Brief settings, generated-data readiness, and path environment overrides without exposing secrets.
- Narrows `daily-brief status` to Daily Brief Run Status only: today's run state and next action without setup-path diagnostics.
- Redirects setup/config blockers toward `daily-brief config` and keeps `status` output focused on operational run state.
- Keeps configuration redaction behavior unchanged: credential references are shown, not raw secrets.

### Installation and Upgrade Notes

- Upgrade with `npm install -g @chenpengfei/daily-brief@latest`.
- Run `daily-brief setup` after upgrading if your previous model or Discord configuration used environment-backed credential references.
- Scripted environments should write `config.yaml`, `sources.yaml`, and `auth.json` directly under `DAILY_BRIEF_HOME`; use `DAILY_BRIEF_DATA_HOME` when generated data should live elsewhere.

### Known Limitations

- `daily-brief status` remains a local inspection command: it does not collect Sources, call an LLM, refresh credentials, generate a brief, or send Discord notifications.
- Environment variables for installed usage remain limited to path overrides: `DAILY_BRIEF_HOME` and `DAILY_BRIEF_DATA_HOME`.

## 0.1.3 - 2026-06-06

Patch release for runtime configuration hardening and clearer local inspection output.

### User-visible Changes

- Adds `daily-brief config` as the read-only place to inspect paths, Source Registry readiness, model settings, delivery settings, Brief settings, generated-data readiness, and path environment overrides without exposing secrets.
- Narrows `daily-brief status` to Daily Brief Run Status only, removing configuration paths and setup readiness from the default status view.
- Keeps model and Discord secrets in `auth.json` referenced by `config.yaml`, removing runtime reliance on `env:NAME`, `.env`, and `DISCORD_WEBHOOK_URL` credential paths for installed usage.
- Reports Discord delivery as explicitly skipped when delivery is disabled or the stored webhook credential is missing.
- Keeps `daily-brief run-once --date YYYY-MM-DD` available for manual backfills while making `daily-brief status` a no-flag inspection command.

### Installation and Upgrade Notes

- Upgrade with `npm install -g @chenpengfei/daily-brief@latest`.
- Run `daily-brief setup` after upgrading if your previous model or Discord configuration used environment-backed credential references.
- Scripted environments should write `config.yaml`, `sources.yaml`, and `auth.json` directly under `DAILY_BRIEF_HOME`; use `DAILY_BRIEF_DATA_HOME` when generated data should live elsewhere.

### Known Limitations

- `daily-brief status` is read-only and local: it does not collect Sources, call an LLM, refresh credentials, generate a brief, or send Discord notifications.
- Environment variables remain limited to path overrides for installed usage: `DAILY_BRIEF_HOME` and `DAILY_BRIEF_DATA_HOME`.

## 0.1.2 - 2026-06-04

Patch release for the simplified public CLI setup workflow.

### User-visible Changes

- Simplifies the public CLI around `setup`, `run-once`, `status`, `sources`, `version`, and help.
- Reworks `daily-brief setup` into an interactive wizard that preserves existing files by default and guides model credential and optional Discord delivery configuration.
- Adds human-readable `run-once` progress output and clearer Source listing/edit guidance.
- Makes `delivery.enabled: false` take precedence over `DISCORD_WEBHOOK_URL`, preventing accidental Discord sends when delivery is disabled in config.

### Installation and Upgrade Notes

- Upgrade with `npm install -g @chenpengfei/daily-brief@latest`.
- Run `daily-brief setup` again after upgrading to review the simplified setup flow.
- Non-interactive setup now fails before writing configuration files; scripted environments should write `config.yaml`, `sources.yaml`, and `auth.json` directly.

### Known Limitations

- The simplified public CLI removes direct public `collect`, `generate`, `deliver`, `model`, and `delivery` command entry points. Use `setup`, `run-once`, `status`, and `sources` for normal installed usage.

## 0.1.1 - 2026-06-01

Patch release for first-install command discovery.

### User-visible Changes

- Updates installation documentation to use `$(npm prefix -g)/bin/daily-brief` for first setup, so users can run the installed CLI even when npm's global bin directory is not yet in their shell `PATH`.
- Clarifies that the shorter `daily-brief` command works after npm's global bin directory is added to `PATH`.

### Installation and Upgrade Notes

- Upgrade with `npm install -g @chenpengfei/daily-brief@latest`.
- If `daily-brief` is not found after installation, run `$(npm prefix -g)/bin/daily-brief setup`.

### Known Limitations

- npm may hide successful lifecycle script output during install, so this release uses visible documentation and release notes rather than a `postinstall` reminder.

## 0.1.0 - 2026-05-31

Initial Formal Release candidate for the Daily Brief Agent.

### User-visible Changes

- Ships the `daily-brief` Operational CLI as the npm package `@chenpengfei/daily-brief`.
- Supports first-use setup through `daily-brief setup`.
- Supports source management, model configuration, delivery configuration, status inspection, and manual workflow runs from the installed CLI.
- Generates Chinese Daily Brief output from configured Sources through the Agent-driven brief generation workflow.

### Installation and Upgrade Notes

- Install with `npm install -g @chenpengfei/daily-brief`.
- Run `daily-brief setup` after installation to initialize user configuration and generated-data directories.
- Generated data and user configuration live under the user Daily Brief home by default, not in the repository checkout.

### Known Limitations

- The first release does not include a built-in scheduler; use cron, launchd, systemd, GitHub Actions, or another external scheduler.
- Discord is the initial Delivery Channel.
- Source discovery remains manual through the Source Registry; the agent does not add Sources autonomously.
