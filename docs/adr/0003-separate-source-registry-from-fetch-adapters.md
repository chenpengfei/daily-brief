# Separate Source Registry from Fetch Adapters

The Source Registry describes what the Daily Brief Agent may collect with fields such as `id`, `platform`, `adapter`, `target`, `enabled`, and `notes`, while Fetch Adapters decide how collection is performed. `platform` names the content platform, `adapter` names a logical collection adapter rather than a concrete tool, and implementation details such as official APIs, RSS, open-source scrapers, browser automation, or Codex Computer Use remain inside adapter configuration rather than the Source Registry.
