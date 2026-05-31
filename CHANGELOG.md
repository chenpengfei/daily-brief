# Changelog

All notable changes for Formal Releases are recorded here. GitHub Release notes should be derived from the matching version entry.

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
