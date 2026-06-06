# Simplify Public CLI Around Setup And Manual Runs

The Daily Brief Operational CLI exposes a small public command surface: `setup`, `run-once`, `status`, `config`, `sources list/edit/validate/enable/disable`, `version`, and help/version flags. Lower-level workflow phases such as collection, generation, and delivery remain internal capabilities used by `run-once`, while model and delivery configuration are guided through the interactive Setup Wizard instead of separate public `model` and `delivery` command families.

This keeps the installed CLI oriented around user tasks rather than internal workflow stages. `setup` is the single first-use and reconfiguration entry point; it preserves existing files by default, requires interactive input, never deletes credentials or generated data, and does not accept a force-overwrite flag. Non-interactive automation remains possible by writing `config.yaml`, `sources.yaml`, `auth.json`, and path environment variables directly.

`run-once` prints human-readable progress for Source collection, Agent Stage execution, archiving, and delivery without exposing raw Pi runtime event names as the default public output contract. If future operations need machine-readable logs or runtime internals, they should add an explicit debug or JSON mode rather than overloading the default user-facing output.

`status` reports Daily Brief Run Status only: today's business-facing generation state and the next suggested action. When setup-related blockers are present, that action should point to `config` rather than embedding configuration diagnostics in status. `config` is the read-only place for paths, setup readiness, model configuration, delivery configuration, Brief settings, generated-data readiness, and path environment overrides, so configuration diagnostics do not crowd the default status view.

`config` uses plain segmented text rather than terminal color, boxes, or other ANSI styling. This keeps the installed CLI consistent with `status`, `run-once`, and `sources` output, and keeps logs, copy/paste, and command-boundary tests simple while still borrowing the sectioned information architecture from comparable tools.

`config` reports user-authored configuration values rather than runtime fallback defaults. When a required section such as model configuration is missing, the command should say it is not configured and report a short actionable issue instead of displaying default provider or model values as if the user had selected them. Optional sections should also distinguish missing configuration from explicit choices, such as treating absent delivery configuration as not configured and `delivery.enabled: false` as disabled.

When a displayed value matches a product default that setup may have written automatically, `config` marks it with `(default)` unless there is a distinct non-default value to show. This avoids presenting product defaults, such as Brief language or max Signal count, as more intentional than they are.

The `config` Paths section reports resolved paths only. Whether those paths came from default locations or environment overrides belongs in the Environment section, so each section answers one question instead of repeating default/override labels on every derived path.
