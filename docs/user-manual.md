# Daily Brief User Manual

Daily Brief is an installed command-line tool for generating a recurring Agent architecture and AI Coding brief from Sources you explicitly configure.

## Install

Daily Brief is distributed as the npm package `@chenpengfei/daily-brief` and installs the `daily-brief` command.

```bash
npm install -g @chenpengfei/daily-brief
"$(npm prefix -g)/bin/daily-brief" --help
```

The explicit `$(npm prefix -g)/bin/daily-brief` path works even when npm's global bin directory is not in your shell `PATH`.

To use the shorter `daily-brief` command, add npm's global bin directory to your shell `PATH`:

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
```

Daily Brief requires Node.js 22 or newer.

## First Setup

Run setup after installing the package:

```bash
"$(npm prefix -g)/bin/daily-brief" setup
```

If npm's global bin directory is in `PATH`, `daily-brief setup` is equivalent.

Setup is an interactive wizard. It creates user configuration and generated-data directories, initializes the Source Registry from the packaged example, prepares credential storage, guides LLM Provider setup, offers optional Discord Delivery setup, and reports readiness. Setup does not collect Sources, call an LLM, generate a Daily Brief, or send a delivery notification.

Yes/no prompts show the default in brackets: `[y/N]` means pressing Enter chooses no, and `[Y/n]` means pressing Enter chooses yes. You can type `y`, `yes`, `n`, or `no`.

By default, configuration files live under `~/.daily-brief/`, and generated data lives under `~/.daily-brief/data/`.

`daily-brief setup` requires interactive input. For CI or scripted setup, write `config.yaml`, `sources.yaml`, and `auth.json` directly under `DAILY_BRIEF_HOME`, and use `DAILY_BRIEF_DATA_HOME` when generated data should live elsewhere.

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
daily-brief setup
```

Use the setup wizard to choose the provider, model, credential name, and optional login/API key storage path. The credential name is a stable label, such as `openai.default`, that lets `config.yaml` find the secret in `auth.json`. Do not put secrets in `sources.yaml`, `config.yaml`, or committed project files.

## Configure Delivery

Discord Delivery is optional. Configure it when you want generated Daily Brief notifications pushed to Discord.

```bash
daily-brief setup
```

Setup asks whether to enable Discord Delivery. If Discord Delivery is disabled or no webhook is configured, generation can still run and will report skipped delivery explicitly.

## Run Daily Brief

For a full manual run:

```bash
daily-brief run-once
```

`run-once` performs collection, Agent Stage generation, archive writing, and delivery once. It prints human-readable progress while the run is active so you can see whether it is collecting Sources, waiting on Agent Stages, archiving, or delivering.

The expected local cadence is a single daily run around the intended delivery time. Daily Brief does not include a built-in scheduler; use an external scheduler to invoke `daily-brief run-once`.

## Version

To report the installed CLI version:

```bash
daily-brief version
daily-brief --version
```

## Inspect Status

Use status after setup, after manual runs, or when diagnosing failures:

```bash
daily-brief status
```

Status output reports today's Daily Brief Run Status and the next suggested action. It does not show configuration paths or setup readiness. It is a local inspection command: it does not refresh OAuth, call an LLM, collect Sources, or send Discord notifications.

## Inspect Configuration

Use config when you need paths, Source Registry readiness, model settings, delivery settings, Brief settings, generated-data readiness, or path environment overrides:

```bash
daily-brief config
```

Config output is read-only and redacts secrets. It shows credential names and whether credentials are configured, but it does not print stored API keys, OAuth tokens, or webhook URLs.

## Paths and Environment

The installed CLI uses user-home paths by default:

- `DAILY_BRIEF_HOME`: configuration directory, default `~/.daily-brief`.
- `DAILY_BRIEF_DATA_HOME`: generated data directory, default `~/.daily-brief/data`.

Model access, Discord delivery, Source choices, and secrets are configured through `config.yaml`, `sources.yaml`, and `auth.json`, not environment variables.

## Upgrade

Upgrade the installed package through npm:

```bash
npm install -g @chenpengfei/daily-brief@latest
"$(npm prefix -g)/bin/daily-brief" status
```

Run `daily-brief setup` again when release notes or config output indicate that configuration needs to be refreshed. Setup preserves existing files by default and asks before replacing non-secret configuration. It does not accept a force-overwrite flag and never deletes generated data.

## Troubleshooting

If setup has not run, run:

```bash
"$(npm prefix -g)/bin/daily-brief" setup
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
daily-brief config
daily-brief setup
```

If Discord delivery fails or is skipped, run:

```bash
daily-brief config
daily-brief setup
```

If a run cannot honestly produce a Daily Brief, the CLI reports a Core Workflow Failure rather than archiving a false normal Daily Brief.
