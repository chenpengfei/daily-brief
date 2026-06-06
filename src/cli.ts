#!/usr/bin/env node
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stringify } from "yaml";
import {
  loginModelCredential,
  readModelRuntimeConfig,
  runOnce,
  toApiKeyCredential,
  type ModelProvider
} from "./agent/index.js";
import {
  defaultModelConfig,
  dateFromDateKey,
  formatDateKey,
  formatSourceRegistry,
  loadSourceRegistry,
  putCredential,
  readDeliveryConfig,
  readDailyBriefConfig,
  getCredential,
  resolveDailyBriefPaths,
  setSourceEnabled,
  validateSourceRegistry,
  writeDeliveryConfig,
  writeCredentialStore,
  writeModelConfig,
  type DailyBriefModelConfig
} from "./config/index.js";
import { getOperationalStatus } from "./workflow/index.js";

type OperationalStatusReport = Awaited<ReturnType<typeof getOperationalStatus>>;

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
  interactive?: boolean;
  prompt?(message: string): Promise<string>;
  fetchImpl?: typeof fetch;
}

export type CliEnv = Partial<Record<string, string | undefined>>;

const consoleIo: CliIo = {
  interactive: Boolean(processStdin.isTTY && processStdout.isTTY),
  stdout(line: string) {
    console.log(line);
  },
  stderr(line: string) {
    console.error(line);
  },
  async prompt(message: string) {
    if (!processStdin.isTTY || !processStdout.isTTY) {
      throw new Error(nonInteractiveSetupMessage());
    }

    const reader = createInterface({ input: processStdin, output: processStdout, terminal: false });

    try {
      return await reader.question(`${message} `);
    } finally {
      reader.close();
    }
  }
};

export async function runCli(args: string[], io: CliIo = consoleIo, env: CliEnv = process.env): Promise<void> {
  const [command, subcommand, value] = args;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp(io);
    return;
  }

  if (command === "version" || command === "--version" || command === "-v") {
    io.stdout(await readPackageVersion());
    return;
  }

  if (command === "run-once") {
    const workflowFlags = parseFlags(args.slice(1));
    const options = {
      ...optionsFromEnv(env),
      ...readWorkflowDateOption(workflowFlags)
    };
    await assertWorkflowConfigured(options.sourceRegistryPath);
    io.stdout("Daily Brief run started");
    io.stdout(`Date: ${options.dateKey}`);
    io.stdout(`Home: ${resolveDailyBriefPaths(env).home}`);
    io.stdout("");
    const result = await runOnce({
      ...options,
      onProgress(line) {
        io.stdout(line);
      }
    });
    if (result.coreFailure) {
      throw new Error(`Core Workflow Failure: ${result.coreFailure.kind}\n${result.coreFailure.message}`);
    }
    io.stdout("");
    io.stdout(`Daily Brief archived: ${result.archivePath}`);
    io.stdout(`Sources read: ${result.sourceCount}`);
    io.stdout(`Source Items read: ${result.sourceItemCount}`);
    io.stdout(`Agent stages completed: ${countAgentStageEvents(result.piEvents)}/5`);
    io.stdout(`Discord delivery: ${formatDeliveryStatus(result.delivery)}`);
    io.stdout("5/5 Run completed");
    return;
  }

  if (command === "setup") {
    await handleSetupCommand(args.slice(1), io, env);
    return;
  }

  if (command === "status") {
    if (args.length > 1) {
      throw new Error("daily-brief status does not accept flags.");
    }

    const options = optionsFromEnv(env);
    const status = await getOperationalStatus(options);
    printOperationalStatus(status, io);
    return;
  }

  if (command === "sources") {
    const options = optionsFromEnv(env);
    await handleSourcesCommand(subcommand, value, io, options.sourceRegistryPath);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function readPackageVersion(): Promise<string> {
  let directory = dirname(fileURLToPath(import.meta.url));

  for (let index = 0; index < 8; index += 1) {
    const path = join(directory, "package.json");

    try {
      const packageJson = JSON.parse(await readFile(path, "utf8")) as unknown;
      if (isRecord(packageJson) && typeof packageJson.version === "string") {
        return `daily-brief ${packageJson.version}`;
      }
    } catch (error) {
      if (!(isNodeError(error) && error.code === "ENOENT")) {
        throw error;
      }
    }

    const parent = dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }

  return "daily-brief unknown";
}

function countAgentStageEvents(events: string[]): number {
  return events.length > 0 ? 5 : 0;
}

function formatDeliveryStatus(delivery: { status: string; reason?: string }): string {
  return `${delivery.status}${delivery.reason ? ` (${delivery.reason})` : ""}`;
}

function printOperationalStatus(status: OperationalStatusReport, io: CliIo): void {
  io.stdout("Daily Brief status");
  io.stdout(`Health: ${status.health} - ${status.message}`);
  io.stdout(`Date: ${status.dateKey}`);
  io.stdout(`System timezone: ${status.systemTimezone}`);
  io.stdout(`Home: ${status.paths.home}`);
  io.stdout(`Data: ${status.paths.dataHome}`);
  io.stdout("");
  io.stdout("Setup readiness");
  io.stdout(formatStatusCheck("Config", status.setup.config));
  io.stdout(formatSourceRegistryCheck(status.setup.sourceRegistry));
  io.stdout(formatModelCheck(status.setup.model));
  io.stdout(formatStatusCheck("Delivery", status.setup.delivery));
  io.stdout(formatStatusCheck("Data", status.setup.data));
  io.stdout("");
  io.stdout("Today run state");
  io.stdout(formatStatusCheck("Source Items", status.today.sourceItems));
  io.stdout(formatStatusCheck("Brief Archive", status.today.briefArchive));
  io.stdout(formatStatusCheck("Agent Run Artifacts", status.today.agentRunArtifacts));
  io.stdout("");
  io.stdout(`Next: ${status.nextAction}`);

  for (const failure of status.materialPartialFailures) {
    io.stdout(`- ${failure}`);
  }
}

function formatStatusCheck(label: string, check: { state: string; label: string; path?: string; detail?: string }): string {
  const detail = check.detail ? ` - ${check.detail}` : "";
  const path = check.path ? ` (${check.path})` : "";
  return `- ${label}: ${check.state} - ${check.label}${detail}${path}`;
}

function formatSourceRegistryCheck(
  check: OperationalStatusReport["setup"]["sourceRegistry"]
): string {
  const counts =
    typeof check.enabledCount === "number" && typeof check.totalCount === "number"
      ? ` - ${check.enabledCount}/${check.totalCount} enabled`
      : "";
  const detail = check.detail && !counts.includes(check.detail) ? ` - ${check.detail}` : "";
  const path = check.path ? ` (${check.path})` : "";
  return `- Source Registry: ${check.state} - ${check.label}${counts}${detail}${path}`;
}

function formatModelCheck(check: OperationalStatusReport["setup"]["model"]): string {
  const selected = check.provider && check.model ? ` - ${check.provider}/${check.model}` : "";
  const credential = check.credentialRef ? ` - credential ${check.credentialRef}` : "";
  const detail = check.detail ? ` - ${check.detail}` : "";
  const path = check.path ? ` (${check.path})` : "";
  return `- Model: ${check.state} - ${check.label}${selected}${credential}${detail}${path}`;
}

function readWorkflowDateOption(flags: Record<string, string | undefined>): { date: Date; dateKey: string } {
  if (flags.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(flags.date)) {
      throw new Error("--date must use YYYY-MM-DD");
    }

    return { date: dateFromDateKey(flags.date), dateKey: flags.date };
  }

  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return { date: now, dateKey: formatDateKey(now, timezone) };
}

async function assertWorkflowConfigured(sourceRegistryPath: string): Promise<void> {
  if (!(await exists(sourceRegistryPath))) {
    throw new Error(`Daily Brief is not configured. Run daily-brief setup first. Missing Source Registry: ${sourceRegistryPath}`);
  }
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

  if (subcommand === "edit") {
    const path = sourceRegistryPath ?? resolveDailyBriefPaths().sourceRegistryPath;
    io.stdout("Source Registry:");
    io.stdout(`  ${path}`);
    io.stdout("");
    io.stdout("Edit this YAML file to add, remove, or update Sources.");
    io.stdout("Use the id field as SOURCE ID for enable/disable commands.");
    io.stdout("");
    io.stdout("After editing:");
    io.stdout("  daily-brief sources validate");
    io.stdout("  daily-brief sources list");
    return;
  }

  if (subcommand === "validate") {
    const path = sourceRegistryPath ?? resolveDailyBriefPaths().sourceRegistryPath;

    try {
      const registry = await validateSourceRegistry(path);
      io.stdout(`Valid Source Registry: ${path}`);
      io.stdout(`Sources: ${registry.sources.length}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Source Registry invalid: ${path}\n${message}`);
    }
  }

  if (subcommand === "enable" || subcommand === "disable") {
    if (!value) {
      throw new Error(
        `sources ${subcommand} requires a SOURCE ID. Run daily-brief sources list to see available SOURCE ID values.`
      );
    }

    const enabled = subcommand === "enable";
    try {
      await setSourceEnabled(value, enabled, sourceRegistryPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === `Source not found: ${value}`) {
        throw new Error(`Source not found: ${value}. Run daily-brief sources list to see available SOURCE ID values.`);
      }

      throw error;
    }
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
      "  daily-brief setup",
      "  daily-brief run-once [--date YYYY-MM-DD]",
      "  daily-brief status",
      "  daily-brief sources list",
      "  daily-brief sources edit",
      "  daily-brief sources validate",
      "  daily-brief sources enable <source-id>",
      "  daily-brief sources disable <source-id>",
      "  daily-brief version"
    ].join("\n")
  );
}

async function handleSetupCommand(args: string[], io: CliIo, env: CliEnv): Promise<void> {
  const flags = parseFlags(args);

  if (Object.keys(flags).length > 0 || args.some((arg) => !arg.startsWith("--"))) {
    throw new Error("daily-brief setup does not accept flags. Re-run setup and choose what to preserve or update interactively.");
  }

  requireInteractiveSetup(io);
  const paths = resolveDailyBriefPaths(env);
  const existingConfig = readDailyBriefConfig(paths.configPath);

  await mkdir(paths.home, { recursive: true });
  await mkdir(paths.sourceItemRoot, { recursive: true });
  await mkdir(paths.agentRunRoot, { recursive: true });
  await mkdir(paths.briefArchiveRoot, { recursive: true });

  await writeSetupBaseConfig(paths.configPath, {
    ...existingConfig,
    brief: normalizeBriefConfig(existingConfig.brief)
  });

  if (!(await exists(paths.authPath))) {
    writeCredentialStore({ credentials: {} }, paths.authPath);
  }

  if (await exists(paths.sourceRegistryPath)) {
    io.stdout(`Source Registry: ${paths.sourceRegistryPath}`);
    try {
      io.stdout(formatSourceRegistry(await loadSourceRegistry(paths.sourceRegistryPath)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      io.stdout(`Source Registry invalid:\n${message}`);
    }
    const reinitialize = await promptYesNo(io, "Reinitialize example Sources? Existing sources.yaml will be overwritten.", false);
    if (reinitialize) {
      await writeFile(paths.sourceRegistryPath, defaultSourceRegistryExample(), "utf8");
      io.stdout("Source Registry reinitialized from the packaged example.");
    } else {
      io.stdout("Source Registry preserved.");
    }
  } else {
    await writeFile(paths.sourceRegistryPath, defaultSourceRegistryExample(), "utf8");
    io.stdout(`Source Registry initialized: ${paths.sourceRegistryPath}`);
    io.stdout(formatSourceRegistry(await loadSourceRegistry(paths.sourceRegistryPath)));
  }

  io.stdout("To edit Sources:");
  io.stdout("  daily-brief sources edit");
  io.stdout("  daily-brief sources validate");
  io.stdout("  daily-brief sources list");

  await configureModelThroughSetup(io, env);
  await configureDeliveryThroughSetup(io, env);

  const readiness = readModelRuntimeConfig(env);
  const delivery = readDeliveryConfig(paths.configPath);
  io.stdout(`Daily Brief home: ${paths.home}`);
  io.stdout(`Daily Brief data: ${paths.dataHome}`);
  io.stdout(`Source Registry: ${paths.sourceRegistryPath}`);
  io.stdout(`Model: ${readiness.provider}/${readiness.model}`);
  io.stdout(`Model credential: ${readiness.ready ? "configured" : "missing"}`);
  io.stdout(`Discord delivery: ${delivery?.enabled ? "enabled" : "disabled"}`);
  io.stdout("Ready to run:");
  io.stdout("  daily-brief run-once");
}

function requireInteractiveSetup(io: CliIo): void {
  if (!io.prompt || io.interactive === false) {
    throw new Error(nonInteractiveSetupMessage());
  }
}

function nonInteractiveSetupMessage(): string {
  return [
    "daily-brief setup requires an interactive terminal.",
    "For CI or scripted setup, create ~/.daily-brief/config.yaml, ~/.daily-brief/sources.yaml, and ~/.daily-brief/auth.json directly.",
    "Use DAILY_BRIEF_HOME to choose a configuration root and DAILY_BRIEF_DATA_HOME to choose a generated-data root.",
    "Run daily-brief sources validate after writing sources.yaml."
  ].join("\n");
}

async function writeSetupBaseConfig(path: string, config: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stringify(config), "utf8");
}

function normalizeBriefConfig(value: unknown): Record<string, unknown> {
  const current = isRecord(value) ? value : {};
  return {
    ...current,
    language: "zh",
    maxSignals: typeof current.maxSignals === "number" ? current.maxSignals : 5
  };
}

async function configureModelThroughSetup(io: CliIo, env: CliEnv): Promise<void> {
  const paths = resolveDailyBriefPaths(env);
  const current = readDailyBriefConfig(paths.configPath).model ?? defaultModelConfig();
  const provider = readProviderFlag(
    await promptWithDefault(io, "LLM Provider (openai-codex/openai/deepseek/openai-compatible)", current.provider)
  );
  const model = await promptWithDefault(io, "Model", current.provider === provider ? current.model : defaultModelForProvider(provider));
  io.stdout(
    "Credential name identifies where Daily Brief finds the model secret in auth.json. Use the default unless you manage multiple credentials."
  );
  const credentialRef = await promptWithDefault(
    io,
    "Model credential name",
    current.provider === provider ? current.credentialRef ?? defaultCredentialRef(provider) ?? "" : defaultCredentialRef(provider) ?? ""
  );
  const baseUrl =
    provider === "openai-compatible"
      ? await promptWithDefault(io, "Base URL", current.provider === provider ? current.baseUrl ?? "" : "")
      : undefined;
  const config: DailyBriefModelConfig = {
    provider,
    model,
    ...(credentialRef ? { credentialRef } : {}),
    ...(baseUrl ? { baseUrl } : {})
  };

  writeModelConfig(config, paths.configPath);
  io.stdout(`Model configured: ${provider}/${model}`);
  if (credentialRef) {
    io.stdout(`Model credential name: ${credentialRef}`);
  }

  await maybeConfigureModelCredential({ provider, credentialRef, io, env });
}

async function maybeConfigureModelCredential(input: {
  provider: ModelProvider;
  credentialRef: string;
  io: CliIo;
  env: CliEnv;
}): Promise<void> {
  if (!input.credentialRef) {
    return;
  }

  const paths = resolveDailyBriefPaths(input.env);

  if (input.provider === "openai-codex") {
    const credential = getCredential(input.credentialRef, paths.authPath);
    if (credential) {
      input.io.stdout("Model credential: configured");
      return;
    }

    if (await promptYesNo(input.io, "Login to openai-codex now?", true)) {
      await loginModelCredential({
        provider: input.provider,
        credentialRef: input.credentialRef,
        io: input.io,
        env: input.env
      });
      input.io.stdout(`Logged in credential: ${input.credentialRef}`);
    } else {
      input.io.stdout("Model credential: missing");
    }
    return;
  }

  if (getCredential(input.credentialRef, paths.authPath)) {
    input.io.stdout("Model credential: configured");
    return;
  }

  if (await promptYesNo(input.io, "Store API key in credential store? API key input may be visible in this terminal.", false)) {
    const apiKey = await promptWithDefault(input.io, "API key", "");
    if (apiKey) {
      putCredential(input.credentialRef, toApiKeyCredential(input.provider, apiKey), paths.authPath);
      input.io.stdout(`Stored credential: ${input.credentialRef}`);
    }
  } else {
    input.io.stdout("Model credential: missing");
  }
}

async function configureDeliveryThroughSetup(io: CliIo, env: CliEnv): Promise<void> {
  const paths = resolveDailyBriefPaths(env);
  const current = readDeliveryConfig(paths.configPath);
  const enabled = await promptYesNo(io, "Enable Discord delivery?", current?.enabled ?? false);

  if (!enabled) {
    writeDeliveryConfig({ enabled: false }, paths.configPath);
    io.stdout("Discord delivery: disabled");
    return;
  }

  const webhookRef = await promptWithDefault(io, "Discord webhook credential name", current?.webhookRef ?? "discord.default");
  writeDeliveryConfig({ enabled: true, webhookRef }, paths.configPath);
  const credential = getCredential(webhookRef, paths.authPath);

  if (credential) {
    io.stdout("Discord webhook: configured");
    if (!(await promptYesNo(io, "Replace Discord webhook URL?", false))) {
      return;
    }
  }

  const webhookUrl = await promptWithDefault(io, "Discord webhook URL", "");
  if (webhookUrl) {
    putCredential(webhookRef, { type: "webhook", provider: "discord", webhookUrl }, paths.authPath);
    io.stdout(`Discord webhook stored: ${webhookRef}`);
  } else {
    io.stdout("Discord webhook: missing");
  }
}

async function promptYesNo(io: CliIo, label: string, defaultValue: boolean): Promise<boolean> {
  if (!io.prompt) {
    throw new Error(nonInteractiveSetupMessage());
  }

  const suffix = defaultValue ? "[Y/n]" : "[y/N]";
  const answer = (await io.prompt(`${label} ${suffix}:`)).trim().toLowerCase();
  if (!answer) {
    return defaultValue;
  }

  if (answer === "y" || answer === "yes" || answer === "true") {
    return true;
  }

  if (answer === "n" || answer === "no" || answer === "false") {
    return false;
  }

  throw new Error(`${label} requires y/yes or n/no`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await readFile(path, "utf8");
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function defaultSourceRegistryExample(): string {
  return [
    "# Example Source Registry for Daily Brief.",
    "#",
    "# User-specific Source Registry lives outside the repository, normally at:",
    "# ~/.daily-brief/sources.yaml",
    "",
    "sources:",
    "  - id: github-trending-daily",
    "    platform: github",
    "    adapter: github-trending",
    "    target: https://github.com/trending?since=daily",
    "    enabled: true",
    "    notes: Site-wide daily GitHub Trending; Brief generation filters for Agent Architecture and AI Coding signals",
    ""
  ].join("\n");
}

function parseFlags(args: string[]): Record<string, string | undefined> {
  const flags: Record<string, string | undefined> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg?.startsWith("--")) {
      continue;
    }

    const equalsIndex = arg.indexOf("=");

    if (equalsIndex > 2) {
      flags[arg.slice(2, equalsIndex)] = arg.slice(equalsIndex + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];

    if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = "true";
    }
  }

  return flags;
}

function readProviderFlag(value: string): ModelProvider {
  const provider = value.trim().toLowerCase();

  if (provider === "codex" || provider === "hermes") {
    return "openai-codex";
  }

  if (provider === "faux") {
    throw new Error("Unsupported model provider for installed CLI: faux is test-only");
  }

  if (provider === "openai-codex" || provider === "openai" || provider === "deepseek" || provider === "openai-compatible") {
    return provider;
  }

  throw new Error(`Unsupported model provider: ${value}`);
}

function defaultModelForProvider(provider: ModelProvider): string {
  if (provider === "openai-codex") {
    return "gpt-5.5";
  }

  if (provider === "openai") {
    return "gpt-4.1-mini";
  }

  if (provider === "deepseek") {
    return "deepseek-chat";
  }

  if (provider === "openai-compatible") {
    return "openai-compatible-model";
  }

  return "faux-daily-brief-renderer";
}

function defaultCredentialRef(provider: ModelProvider): string | undefined {
  if (provider === "faux") {
    return undefined;
  }

  if (provider === "openai") {
    return "openai.default";
  }

  if (provider === "deepseek") {
    return "deepseek.default";
  }

  if (provider === "openai-compatible") {
    return "openai-compatible.default";
  }

  return defaultModelConfig().credentialRef;
}

async function promptWithDefault(io: CliIo, label: string, defaultValue: string): Promise<string> {
  if (!io.prompt) {
    throw new Error(nonInteractiveSetupMessage());
  }

  const answer = await io.prompt(`${label}${defaultValue ? ` (${defaultValue})` : ""}:`);
  return answer.trim() || defaultValue;
}

function optionsFromEnv(env: CliEnv) {
  const paths = resolveDailyBriefPaths(env);

  return {
    env,
    dataHome: paths.dataHome,
    configPath: paths.configPath,
    authPath: paths.authPath,
    sourceRegistryPath: paths.sourceRegistryPath,
    sourceItemRoot: paths.sourceItemRoot,
    agentRunRoot: paths.agentRunRoot,
    archiveRoot: paths.briefArchiveRoot,
    modelRuntimeEnv: env,
    discordEnv: env
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function isCliEntrypoint(argvPath: string | undefined, moduleUrl = import.meta.url): Promise<boolean> {
  if (!argvPath) {
    return false;
  }

  if (moduleUrl === pathToFileURL(argvPath).href) {
    return true;
  }

  try {
    const [realArgvPath, realModulePath] = await Promise.all([realpath(argvPath), realpath(fileURLToPath(moduleUrl))]);
    return realArgvPath === realModulePath;
  } catch {
    return false;
  }
}

isCliEntrypoint(process.argv[1])
  .then(async (isEntrypoint) => {
    if (!isEntrypoint) {
      return false;
    }

    await runCli(process.argv.slice(2));
    return true;
  })
  .then((didRun) => {
    if (didRun) {
      process.exit(0);
    }
  })
  .catch((error: unknown) => {
    consoleIo.stderr(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
