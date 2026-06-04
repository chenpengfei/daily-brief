# Daily Brief Operations

For end-user installation, setup, upgrade, and troubleshooting, see `docs/user-manual.md`. For maintainer release gates and publication steps, see `docs/release-workflow.md`.

Installed usage uses the `daily-brief` binary:

```bash
daily-brief setup
daily-brief run-once --date 2026-05-28
daily-brief status
```

Development usage from a repository checkout uses `npm run cli --`:

```bash
npm run cli -- status
npm run cli -- run-once
npm run cli -- --version
```

Expected local cadence:

- Run `daily-brief run-once` once per Daily Brief Cadence window.

Scheduler integration is intentionally deployment-neutral. A local cron, launchd job, systemd timer, GitHub Actions workflow, or another scheduler can call the commands above; the repository does not bind the MVP to a specific host.

`run-once` executes collection, brief generation/archive, and Discord delivery in order. It prints human-readable progress for Source collection, Agent Stage execution, archiving, and delivery while the run is active. Source Item writes are deduplicated by Source Item id and content hash within the daily JSONL store, and Daily Brief generation merges repeated mentions into one multi-citation Signal, so rerunning the workflow for the same Collection Window does not duplicate equivalent Signals.

## Manual run

For a one-off Manual Run against the configured Sources:

```bash
npm run cli -- sources list
npm run cli -- run-once
npm run cli -- status
```

`sources list` confirms which Sources are enabled, including the default `github-trending-daily` Source. `run-once` performs collection, brief generation, archive writing, and Discord Delivery once. `status` reports setup readiness, today's run state, active paths, and the next suggested action.

Discord Delivery uses the configured credential reference in `config.yaml` and `auth.json`. If Discord Delivery is disabled or its webhook credential is missing, delivery is skipped with an explicit reason.

## Runtime configuration

Installed operational paths can be adjusted through environment variables:

- `DAILY_BRIEF_HOME`: user config directory. Defaults to `~/.daily-brief`.
- `DAILY_BRIEF_DATA_HOME`: generated data directory. Defaults to `~/.daily-brief/data`.

Model/provider and delivery configuration should normally be managed with:

```bash
daily-brief setup
```

Secrets live in `~/.daily-brief/auth.json`, never in environment variables, `sources.yaml`, `config.yaml`, or committed project files. `daily-brief setup` requires interactive input; CI and scripted environments should create the user configuration files directly under `DAILY_BRIEF_HOME`. Faux provider coverage belongs in test configuration files, not runtime environment variables.

`run-once` does not archive a normal Daily Brief when every enabled Source fails or when no Source Items exist for the requested date. It reports a Core Workflow Failure instead, because a false low-signal brief would hide collection failure.

## GitHub Trending collection

`github-trending-daily` monitors the site-wide daily GitHub Trending page. The Fetch Adapter treats each listed repository as a Trending Repository Observation and keeps parsing intentionally narrow: repository link, short description, stars/forks when visible, and stars today when visible. It does not fetch README files or repository detail APIs.

The adapter relies on focused HTML parsing plus regression tests for observed GitHub page changes. A GitHub Trending parsing failure is handled as a Source-level collection failure; it should not silently fall back to stale trend-list data.
