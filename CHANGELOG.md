# Changelog

All notable changes for Formal Releases are recorded here. GitHub Release notes should be derived from the matching version entry.

## 0.1.2 - 2026-06-04

Patch release for the simplified public CLI setup workflow.

### User-visible Changes

- Simplifies the public CLI around `setup`, `run-once`, `status`, `sources`, `version`, and help.
- Reworks `daily-brief setup` into an interactive wizard that preserves existing files by default and guides model credential and optional Discord delivery configuration.
- Adds human-readable `run-once` progress output and clearer Source listing/edit guidance.
- Keeps Discord delivery configuration in `config.yaml` and `auth.json`, and reports an explicit skipped status when no stored webhook is configured.

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
