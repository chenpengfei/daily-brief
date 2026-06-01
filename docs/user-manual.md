# Daily Brief User Manual

Daily Brief is an installed command-line tool for generating a recurring Agent architecture and AI Coding brief from Sources you explicitly configure.

## Install

Daily Brief is distributed as the npm package `@chenpengfei/daily-brief` and installs the `daily-brief` command.

```bash
npm install -g @chenpengfei/daily-brief
daily-brief --help
```

If installation succeeds but your shell reports `daily-brief: command not found`, npm installed the command into a global bin directory that is not in `PATH`. Run the installed command directly:

```bash
"$(npm prefix -g)/bin/daily-brief" setup
```

Then add npm's global bin directory to your shell `PATH`:

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

Daily Brief requires Node.js 22 or newer.

## First Setup

Run setup after installing the package:

```bash
daily-brief setup
```

Setup creates user configuration and generated-data directories, initializes the Source Registry from the packaged example, prepares credential storage, and reports readiness. Setup does not collect Sources, call an LLM, generate a Daily Brief, or send a delivery notification.

By default, configuration files live under `~/.daily-brief/`, and generated data lives under `~/.daily-brief/data/`.

## Configure Sources

Sources are manually controlled. The agent processes configured Sources, but it does not autonomously add or remove them.

```bash
daily-brief sources list
daily-brief sources edit
daily-brief sources validate
daily-brief sources enable <source-id>
daily-brief sources disable <source-id>
```

Use `sources validate` after editing the Source Registry.

## Configure Model Access

Agent Stages require an LLM Provider Configuration before real Daily Brief generation.

```bash
daily-brief model configure
daily-brief model status
daily-brief model login
daily-brief model logout
```

Credentials are stored in the Model Credential Store or environment variables. Do not put secrets in `sources.yaml` or committed project files.

## Configure Delivery

Discord Delivery is optional. Configure it when you want generated Daily Brief notifications pushed to Discord.

```bash
daily-brief delivery configure --enabled true --webhook-url <url>
daily-brief delivery status
daily-brief delivery test
```

If Discord Delivery is disabled or no webhook is configured, generation can still run and will report skipped delivery explicitly.

## Run Daily Brief

For a full manual run:

```bash
daily-brief run-once
```

For separated operational steps:

```bash
daily-brief collect
daily-brief generate
daily-brief deliver
daily-brief status
```

The expected local cadence is collection at 06:00 and generation or delivery at 07:00 local time. Daily Brief does not include a built-in scheduler; use an external scheduler to invoke the CLI.

## Inspect Status

Use status after setup, after manual runs, or when diagnosing failures:

```bash
daily-brief status
```

Status output is the operational surface for collection, analysis, archive, and delivery health.

## Paths and Environment

The installed CLI uses user-home paths by default:

- `DAILY_BRIEF_HOME`: configuration directory, default `~/.daily-brief`.
- `DAILY_BRIEF_DATA_HOME`: generated data directory, default `~/.daily-brief/data`.
- `DAILY_BRIEF_DISCORD_TEMPLATE_PATH`: optional Discord notification template override.
- `DISCORD_WEBHOOK_URL`: optional Discord webhook URL.

Repository checkouts may use a local `.env`; installed usage should normally rely on user configuration and credential commands.

## Upgrade

Upgrade the installed package through npm:

```bash
npm install -g @chenpengfei/daily-brief@latest
daily-brief status
```

Run `daily-brief setup` again when release notes or status output indicate that configuration needs to be refreshed. Setup preserves existing files unless an overwrite or force behavior is explicitly selected.

## Troubleshooting

If setup has not run, run:

```bash
daily-brief setup
```

If `daily-brief` is not found after a successful global install, run:

```bash
"$(npm prefix -g)/bin/daily-brief" setup
```

If Sources are not collected, run:

```bash
daily-brief sources validate
daily-brief sources list
```

If model access fails, run:

```bash
daily-brief model status
```

If Discord delivery fails or is skipped, run:

```bash
daily-brief delivery status
daily-brief delivery test
```

If a run cannot honestly produce a Daily Brief, the CLI reports a Core Workflow Failure rather than archiving a false normal Daily Brief.
