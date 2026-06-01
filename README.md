# Daily Brief

Daily Brief is a personal intelligence workflow for generating a recurring brief about Agent architecture, AI Coding, and related ecosystem signals from manually configured Sources.

## Install

Daily Brief is distributed as the npm package `@chenpengfei/daily-brief` and installs the `daily-brief` command.

```bash
npm install -g @chenpengfei/daily-brief
daily-brief setup
```

If your shell cannot find `daily-brief` after installation, run it through npm's global bin path once:

```bash
"$(npm prefix -g)/bin/daily-brief" setup
```

Daily Brief requires Node.js 22 or newer.

## Use

```bash
daily-brief run-once
daily-brief status
daily-brief sources list
daily-brief model status
daily-brief delivery status
```

For installation, setup, configuration, upgrade, and troubleshooting, see `docs/user-manual.md`.

For maintainer release gates and publication steps, see `docs/release-workflow.md`.
