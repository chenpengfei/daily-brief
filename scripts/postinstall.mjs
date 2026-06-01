#!/usr/bin/env node

import { join } from "node:path";

export function getPathReminder({
  npmConfigGlobal = process.env.npm_config_global,
  npmConfigPrefix = process.env.npm_config_prefix,
  pathValue = process.env.PATH ?? "",
  platform = process.platform,
  home = process.env.HOME
} = {}) {
  if (npmConfigGlobal !== "true" || !npmConfigPrefix) {
    return null;
  }

  const binDirectory = platform === "win32" ? npmConfigPrefix : join(npmConfigPrefix, "bin");
  const pathEntries = pathValue.split(platform === "win32" ? ";" : ":").filter(Boolean);
  if (pathEntries.includes(binDirectory)) {
    return null;
  }

  const displayBinDirectory = home && binDirectory.startsWith(`${home}/`)
    ? `$HOME/${binDirectory.slice(home.length + 1)}`
    : binDirectory;

  if (platform === "win32") {
    return [
      "",
      "daily-brief installed, but npm's global command directory is not in PATH:",
      `  ${binDirectory}`,
      "",
      "Run the command directly with:",
      `  ${binDirectory}\\daily-brief setup`,
      ""
    ].join("\n");
  }

  return [
    "",
    "daily-brief installed, but npm's global command directory is not in PATH:",
    `  ${binDirectory}`,
    "",
    "Run now:",
    `  export PATH=\"${displayBinDirectory}:$PATH\"`,
    "  daily-brief setup",
    "",
    "Persist for zsh:",
    `  echo 'export PATH=\"${displayBinDirectory}:$PATH\"' >> ~/.zshrc`,
    "  source ~/.zshrc",
    ""
  ].join("\n");
}

const reminder = getPathReminder();
if (reminder) {
  console.error(reminder);
}
