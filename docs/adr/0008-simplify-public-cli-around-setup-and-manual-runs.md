# Simplify Public CLI Around Setup And Manual Runs

The Daily Brief Operational CLI exposes a small public command surface: `setup`, `run-once`, `status`, `sources list/edit/validate/enable/disable`, `version`, and help/version flags. Lower-level workflow phases such as collection, generation, and delivery remain internal capabilities used by `run-once`, while model and delivery configuration are guided through the interactive Setup Wizard instead of separate public `model` and `delivery` command families.

This keeps the installed CLI oriented around user tasks rather than internal workflow stages. `setup` is the single first-use and reconfiguration entry point; it preserves existing files by default, requires interactive input, never deletes credentials or generated data, and does not accept a force-overwrite flag. Non-interactive automation remains possible by writing `config.yaml`, `sources.yaml`, `auth.json`, and path environment variables directly.

`run-once` prints human-readable progress for Source collection, Agent Stage execution, archiving, and delivery without exposing raw Pi runtime event names as the default public output contract. If future operations need machine-readable logs or runtime internals, they should add an explicit debug or JSON mode rather than overloading the default user-facing output.
