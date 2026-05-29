#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { deliverOnce, generateOnce, runOnce } from "./agent/index.js";
import { collectSources } from "./collection/index.js";
import { formatSourceRegistry, loadSourceRegistry, setSourceEnabled } from "./config/index.js";
import { getOperationalStatus } from "./workflow/index.js";

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}

export type CliEnv = Partial<Record<string, string | undefined>>;

const consoleIo: CliIo = {
  stdout(line: string) {
    console.log(line);
  },
  stderr(line: string) {
    console.error(line);
  }
};

export async function runCli(args: string[], io: CliIo = consoleIo, env: CliEnv = process.env): Promise<void> {
  const [command, subcommand, value] = args;
  const options = optionsFromEnv(env);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp(io);
    return;
  }

  if (command === "run-once") {
    const result = await runOnce(options);
    io.stdout(`Daily Brief archived: ${result.archivePath}`);
    io.stdout(`Sources read: ${result.sourceCount}`);
    io.stdout(`Source Items read: ${result.sourceItemCount}`);
    io.stdout(`Discord delivery: ${result.delivery.status}`);
    io.stdout(`Pi events: ${result.piEvents.join(", ")}`);
    return;
  }

  if (command === "collect") {
    const result = await collectSources(options);
    io.stdout(`Source Item Store: ${result.storePath || "(no items written)"}`);

    for (const source of result.sources) {
      io.stdout(
        `${source.status.padEnd(7)} ${source.sourceId} items=${source.itemCount} written=${source.writtenCount} duplicates=${source.skippedDuplicateCount}${
          source.reason ? ` reason=${source.reason}` : ""
        }`
      );
    }

    return;
  }

  if (command === "generate") {
    const result = await generateOnce(options);
    io.stdout(`Daily Brief archived: ${result.archivePath}`);
    io.stdout(`Source Items read: ${result.sourceItemCount}`);
    return;
  }

  if (command === "deliver") {
    const result = await deliverOnce(options);
    io.stdout(`Discord delivery: ${result.status}${"reason" in result ? ` (${result.reason})` : ""}`);
    return;
  }

  if (command === "status") {
    const status = await getOperationalStatus(options);
    io.stdout(`${status.health}: ${status.message}`);

    for (const failure of status.materialPartialFailures) {
      io.stdout(`- ${failure}`);
    }

    return;
  }

  if (command === "sources") {
    await handleSourcesCommand(subcommand, value, io, options.sourceRegistryPath);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function handleSourcesCommand(
  subcommand: string | undefined,
  value: string | undefined,
  io: CliIo,
  sourceRegistryPath: string | undefined
): Promise<void> {
  if (subcommand === "list") {
    io.stdout(formatSourceRegistry(await loadSourceRegistry(sourceRegistryPath)));
    return;
  }

  if (subcommand === "enable" || subcommand === "disable") {
    if (!value) {
      throw new Error(`sources ${subcommand} requires a Source id`);
    }

    const enabled = subcommand === "enable";
    await setSourceEnabled(value, enabled, sourceRegistryPath);
    io.stdout(`${enabled ? "Enabled" : "Disabled"} Source: ${value}`);
    return;
  }

  throw new Error(`Unknown sources command: ${subcommand ?? "(missing)"}`);
}

function printHelp(io: CliIo): void {
  io.stdout(
    [
      "Daily Brief Operational CLI",
      "",
      "Usage:",
      "  daily-brief run-once",
      "  daily-brief collect",
      "  daily-brief generate",
      "  daily-brief deliver",
      "  daily-brief status",
      "  daily-brief sources list",
      "  daily-brief sources enable <source-id>",
      "  daily-brief sources disable <source-id>"
    ].join("\n")
  );
}

function optionsFromEnv(env: CliEnv) {
  return {
    ...(env.DAILY_BRIEF_SOURCE_REGISTRY_PATH ? { sourceRegistryPath: env.DAILY_BRIEF_SOURCE_REGISTRY_PATH } : {}),
    ...(env.DAILY_BRIEF_SOURCE_ITEM_ROOT ? { sourceItemRoot: env.DAILY_BRIEF_SOURCE_ITEM_ROOT } : {}),
    ...(env.DAILY_BRIEF_ARCHIVE_ROOT ? { archiveRoot: env.DAILY_BRIEF_ARCHIVE_ROOT } : {}),
    ...(env.DISCORD_WEBHOOK_URL ? { discordWebhookUrl: env.DISCORD_WEBHOOK_URL } : {}),
    ...(env.DAILY_BRIEF_DISCORD_TEMPLATE_PATH ? { discordTemplatePath: env.DAILY_BRIEF_DISCORD_TEMPLATE_PATH } : {})
  };
}

export async function loadDotenvFile(path = ".env", env: CliEnv = process.env): Promise<void> {
  let contents: string;

  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const line of contents.split("\n")) {
    const entry = parseDotenvLine(line);

    if (!entry || env[entry.key] !== undefined) {
      continue;
    }

    env[entry.key] = entry.value;
  }
}

function parseDotenvLine(line: string): { key: string; value: string } | undefined {
  const trimmed = line.trim();

  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return undefined;
  }

  const equalsIndex = trimmed.indexOf("=");

  if (equalsIndex <= 0) {
    return undefined;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  const rawValue = trimmed.slice(equalsIndex + 1).trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return undefined;
  }

  return { key, value: unquoteDotenvValue(rawValue) };
}

function unquoteDotenvValue(value: string): string {
  if (value.length >= 2) {
    const quote = value[0];
    const last = value[value.length - 1];

    if ((quote === "\"" || quote === "'") && last === quote) {
      return value.slice(1, -1);
    }
  }

  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadDotenvFile()
    .then(() => runCli(process.argv.slice(2)))
    .catch((error: unknown) => {
      consoleIo.stderr(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
