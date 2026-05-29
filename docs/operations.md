# Daily Brief Operations

The MVP Operational CLI exposes the daily workflow as independent commands:

```bash
npm run cli -- collect
npm run cli -- generate
npm run cli -- deliver
npm run cli -- status
npm run cli -- run-once
```

Expected local cadence:

- 06:00 local time: run `collect`.
- 07:00 local time: run `run-once` or `generate` followed by `deliver`.

Scheduler integration is intentionally deployment-neutral. A local cron, launchd job, systemd timer, GitHub Actions workflow, or another scheduler can call the commands above; the repository does not bind the MVP to a specific host.

`run-once` executes collection, brief generation/archive, and Discord delivery in order. Source Item writes are deduplicated by Source Item id and content hash within the daily JSONL store, and Daily Brief generation merges repeated mentions into one multi-citation Signal, so rerunning the workflow for the same Collection Window does not duplicate equivalent Signals.

## Manual run

For a one-off Manual Run against the configured Sources:

```bash
npm run cli -- sources list
npm run cli -- run-once
npm run cli -- status
```

`sources list` confirms which Sources are enabled, including the default `github-trending-daily` Source. `run-once` performs collection, brief generation, archive writing, and Discord Delivery once. `status` reports operational health after the run.

Discord Delivery uses `DISCORD_WEBHOOK_URL` from the shell environment or local `.env`; `.env` is loaded automatically by the Operational CLI and does not need to be sourced manually.

## Runtime configuration

When the Operational CLI starts, it loads local `.env` values from the repository root if the file exists. Existing shell environment variables take precedence over `.env` values. The `.env` file is ignored by Git; use `.env.example` as the non-secret template.

Operational paths can be adjusted through environment variables:

- `DAILY_BRIEF_SOURCE_REGISTRY_PATH`: Source Registry path. Defaults to `config/sources.yaml`.
- `DAILY_BRIEF_SOURCE_ITEM_ROOT`: Source Item Store root. Defaults to `data/source-items`.
- `DAILY_BRIEF_ARCHIVE_ROOT`: Brief Archive root. Defaults to `briefs`.
- `DAILY_BRIEF_DISCORD_TEMPLATE_PATH`: Discord notification template path. Defaults to `templates/discord-notification.md`.
- `DISCORD_WEBHOOK_URL`: Discord webhook URL. If unset, Discord Delivery is skipped with an explicit reason.

Model/provider configuration is also environment-based and must not be stored in the Source Registry:

- `DAILY_BRIEF_MODEL_PROVIDER`: `faux` by default, or `openai` for the production OpenAI contract.
- `DAILY_BRIEF_MODEL`: model name. Defaults to `faux-daily-brief-renderer` for `faux` and `gpt-4.1-mini` for `openai`.
- `OPENAI_API_KEY`: required when `DAILY_BRIEF_MODEL_PROVIDER=openai`.

Tests use the faux provider and mocked transports. Secrets should be supplied through the runtime environment, never committed and never placed in `config/sources.yaml`.

## GitHub Trending collection

`github-trending-daily` monitors the site-wide daily GitHub Trending page. The Fetch Adapter treats each listed repository as a Trending Repository Observation and keeps parsing intentionally narrow: repository link, short description, stars/forks when visible, and stars today when visible. It does not fetch README files or repository detail APIs.

The adapter relies on focused HTML parsing plus regression tests for observed GitHub page changes. A GitHub Trending parsing failure is handled as a Source-level collection failure; it should not silently fall back to stale trend-list data.
