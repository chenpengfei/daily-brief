#!/usr/bin/env node
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  deliverOnce,
  generateOnce,
  loginModelCredential,
  logoutModelCredential,
  readModelRuntimeConfig,
  runOnce,
  statusModelCredentials,
  toApiKeyCredential,
  type ModelProvider
} from "./agent/index.js";
import { collectSources } from "./collection/index.js";
import { resolveConfiguredWebhookUrl } from "./discord/index.js";
import {
  defaultModelConfig,
  formatSourceRegistry,
  loadSourceRegistry,
  putCredential,
  readDeliveryConfig,
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

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
  prompt?(message: string): Promise<string>;
  fetchImpl?: typeof fetch;
}

export type CliEnv = Partial<Record<string, string | undefined>>;

const consoleIo: CliIo = {
  stdout(line: string) {
    console.log(line);
  },
  stderr(line: string) {
    console.error(line);
  },
  async prompt(message: string) {
    const reader = createInterface({ input: processStdin, output: processStdout });

    try {
      return await reader.question(`${message} `);
    } finally {
      reader.close();
    }
  }
};

export async function runCli(args: string[], io: CliIo = consoleIo, env: CliEnv = process.env): Promise<void> {
  const [command, subcommand, value] = args;
  const workflowFlags = parseFlags(args.slice(1));
  const options = {
    ...optionsFromEnv(env),
    ...readDateOption(workflowFlags)
  };

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp(io);
    return;
  }

  if (command === "run-once") {
    await assertWorkflowConfigured(options.sourceRegistryPath);
    const result = await runOnce(options);
    if (result.coreFailure) {
      throw new Error(`Core Workflow Failure: ${result.coreFailure.kind}\n${result.coreFailure.message}`);
    }
    io.stdout(`Daily Brief archived: ${result.archivePath}`);
    io.stdout(`Sources read: ${result.sourceCount}`);
    io.stdout(`Source Items read: ${result.sourceItemCount}`);
    io.stdout(`Discord delivery: ${result.delivery.status}`);
    io.stdout(`Pi events: ${result.piEvents.join(", ")}`);
    return;
  }

  if (command === "setup") {
    await handleSetupCommand(args.slice(1), io, env);
    return;
  }

  if (command === "collect") {
    await assertWorkflowConfigured(options.sourceRegistryPath);
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

  if (command === "model") {
    await handleModelCommand(args.slice(1), io, env);
    return;
  }

  if (command === "delivery") {
    await handleDeliveryCommand(args.slice(1), io, env);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function readDateOption(flags: Record<string, string | undefined>): { date?: Date } {
  if (!flags.date) {
    return {};
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(flags.date)) {
    throw new Error("--date must use YYYY-MM-DD");
  }

  return { date: new Date(`${flags.date}T00:00:00.000Z`) };
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
    io.stdout(`Source Registry: ${path}`);
    io.stdout("Edit this YAML file, then run: daily-brief sources validate");
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
      "  daily-brief setup [--force]",
      "  daily-brief run-once",
      "  daily-brief collect",
      "  daily-brief generate",
      "  daily-brief deliver",
      "  daily-brief status",
      "  daily-brief model configure [--provider <provider> --model <model> --credential-ref <ref>]",
      "  daily-brief model login [--provider openai-codex --credential-ref <ref>]",
      "  daily-brief model logout [--credential-ref <ref>]",
      "  daily-brief model status",
      "  daily-brief delivery configure --enabled true|false [--webhook-ref <ref> --webhook-url <url>]",
      "  daily-brief delivery status",
      "  daily-brief delivery test",
      "  daily-brief sources list",
      "  daily-brief sources edit",
      "  daily-brief sources validate",
      "  daily-brief sources enable <source-id>",
      "  daily-brief sources disable <source-id>"
    ].join("\n")
  );
}

async function handleSetupCommand(args: string[], io: CliIo, env: CliEnv): Promise<void> {
  const flags = parseFlags(args);
  const force = flags.force === "true";
  const paths = resolveDailyBriefPaths(env);
  const timezone = env.TZ?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  await mkdir(paths.home, { recursive: true });
  await mkdir(paths.sourceItemRoot, { recursive: true });
  await mkdir(paths.agentRunRoot, { recursive: true });
  await mkdir(paths.briefArchiveRoot, { recursive: true });
  await writeIfNeeded(
    paths.configPath,
    [
      `timezone: ${timezone}`,
      "brief:",
      "  language: zh",
      "  maxSignals: 5",
      "model:",
      "  provider: openai-codex",
      "  model: gpt-5.5",
      "  credentialRef: openai-codex.default",
      "delivery:",
      "  enabled: false",
      ""
    ].join("\n"),
    force
  );
  await writeIfNeeded(paths.sourceRegistryPath, defaultSourceRegistryExample(), force);

  if (force || !(await exists(paths.authPath))) {
    writeCredentialStore({ credentials: {} }, paths.authPath);
  }

  io.stdout(`Daily Brief home: ${paths.home}`);
  io.stdout(`Daily Brief data: ${paths.dataHome}`);
  io.stdout(`Timezone: ${timezone}`);
  io.stdout(`Source Registry: ${paths.sourceRegistryPath}`);
  io.stdout("Next: daily-brief sources validate");
  io.stdout("Next: daily-brief model configure");
  io.stdout("Optional: daily-brief delivery configure --enabled true --webhook-url <url>");
  io.stdout("Readiness: config files present, Source Registry initialized, data directories writable, delivery disabled");
}

async function handleDeliveryCommand(args: string[], io: CliIo, env: CliEnv): Promise<void> {
  const [subcommand, ...rest] = args;
  const flags = parseFlags(rest);
  const paths = resolveDailyBriefPaths(env);

  if (subcommand === "configure") {
    const enabled = flags.enabled === "true" || flags.enabled === "yes";
    const webhookRef = flags["webhook-ref"] ?? "discord.default";
    writeDeliveryConfig({ enabled, ...(enabled ? { webhookRef } : {}) }, paths.configPath);

    if (enabled && flags["webhook-url"]) {
      putCredential(webhookRef, { type: "webhook", provider: "discord", webhookUrl: flags["webhook-url"] }, paths.authPath);
    }

    io.stdout(`Discord delivery: ${enabled ? "enabled" : "disabled"}`);
    if (enabled) io.stdout(`Webhook Ref: ${webhookRef}`);
    return;
  }

  if (subcommand === "status") {
    const config = readDeliveryConfig(paths.configPath);

    if (!config?.enabled) {
      io.stdout("Discord delivery: disabled");
      return;
    }

    const credential = config.webhookRef ? getDeliveryWebhookCredential(config.webhookRef, paths.authPath) : undefined;
    io.stdout("Discord delivery: enabled");
    io.stdout(`Webhook Ref: ${config.webhookRef ?? "(missing)"}`);
    io.stdout(`Webhook: ${credential ? "<redacted>" : "(missing)"}`);
    return;
  }

  if (subcommand === "test") {
    const config = readDeliveryConfig(paths.configPath);
    const credential = config?.webhookRef ? getDeliveryWebhookCredential(config.webhookRef, paths.authPath) : undefined;

    if (!config?.enabled || !credential) {
      throw new Error("delivery test requires enabled Discord delivery with a webhook credential");
    }

    const response = await (io.fetchImpl ?? fetch)(credential.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Daily Brief delivery test" })
    });

    if (!response.ok) {
      throw new Error(`Discord delivery test failed with status ${response.status}`);
    }

    io.stdout("Discord delivery test: sent");
    return;
  }

  throw new Error(`Unknown delivery command: ${subcommand ?? "(missing)"}`);
}

function getDeliveryWebhookCredential(ref: string, authPath: string): { webhookUrl: string } | undefined {
  const credential = getCredential(ref, authPath);
  return credential?.type === "webhook" && credential.provider === "discord" ? credential : undefined;
}

async function writeIfNeeded(path: string, contents: string, force: boolean): Promise<void> {
  if (!force && (await exists(path))) {
    return;
  }

  await writeFile(path, contents, "utf8");
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

async function handleModelCommand(args: string[], io: CliIo, env: CliEnv): Promise<void> {
  const [subcommand, ...rest] = args;
  const flags = parseFlags(rest);

  if (subcommand === "configure") {
    await configureModel(flags, io, env);
    return;
  }

  if (subcommand === "status") {
    const config = readModelRuntimeConfig(env);
    io.stdout(`Provider: ${config.provider}`);
    io.stdout(`Model: ${config.model}`);
    io.stdout(`Credential Ref: ${config.credentialRef ?? "(none)"}`);
    io.stdout(`Ready: ${config.ready ? "yes" : "no"}`);

    for (const issue of config.issues) {
      io.stdout(`- ${issue}`);
    }

    for (const credential of statusModelCredentials(env)) {
      io.stdout(`Credential: ${credential.ref} provider=${credential.provider} type=${credential.type} secret=${credential.secret}`);
    }

    return;
  }

  if (subcommand === "login") {
    const config = readModelRuntimeConfig(env);
    const provider = readProviderFlag(flags.provider ?? config.provider ?? defaultModelConfig().provider);
    const credentialRef = flags["credential-ref"] ?? config.credentialRef ?? defaultCredentialRef(provider);

    if (!credentialRef) {
      throw new Error("model login requires --credential-ref");
    }

    await loginModelCredential({ provider, credentialRef, io, env });
    io.stdout(`Logged in credential: ${credentialRef}`);
    return;
  }

  if (subcommand === "logout") {
    const config = readModelRuntimeConfig(env);
    const credentialRef = flags["credential-ref"] ?? rest[0] ?? config.credentialRef;

    if (!credentialRef) {
      throw new Error("model logout requires --credential-ref");
    }

    logoutModelCredential(credentialRef, env);
    io.stdout(`Logged out credential: ${credentialRef}`);
    return;
  }

  throw new Error(`Unknown model command: ${subcommand ?? "(missing)"}`);
}

async function configureModel(flags: Record<string, string | undefined>, io: CliIo, env: CliEnv): Promise<void> {
  const interactive = Object.keys(flags).length === 0;
  const provider = readProviderFlag(
    flags.provider ??
      (interactive ? await promptWithDefault(io, "Provider", defaultModelConfig().provider) : missingFlag("provider"))
  );
  const model = flags.model ?? (interactive ? await promptWithDefault(io, "Model", defaultModelForProvider(provider)) : missingFlag("model"));
  const credentialRef =
    flags["credential-ref"] ??
    (interactive ? await promptWithDefault(io, "Credential ref", defaultCredentialRef(provider) ?? "") : missingFlag("credential-ref"));
  const baseUrl = flags["base-url"] ?? (provider === "openai-compatible" && interactive ? await promptWithDefault(io, "Base URL", "") : undefined);

  const config: DailyBriefModelConfig = {
    provider,
    model,
    credentialRef,
    ...(baseUrl ? { baseUrl } : {})
  };

  writeModelConfig(config, resolveDailyBriefPaths(env).configPath);

  if (flags["api-key"]) {
    putCredential(credentialRef, toApiKeyCredential(provider, flags["api-key"]), resolveDailyBriefPaths(env).authPath);
  }

  io.stdout(`Model configured: ${provider}/${model}`);
  io.stdout(`Credential Ref: ${credentialRef}`);
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
    return "env:OPENAI_API_KEY";
  }

  if (provider === "deepseek") {
    return "env:DEEPSEEK_API_KEY";
  }

  if (provider === "openai-compatible") {
    return "env:OPENAI_API_KEY";
  }

  return defaultModelConfig().credentialRef;
}

async function promptWithDefault(io: CliIo, label: string, defaultValue: string): Promise<string> {
  if (!io.prompt) {
    throw new Error(`model configure requires --${label.toLowerCase().replaceAll(" ", "-")}`);
  }

  const answer = await io.prompt(`${label}${defaultValue ? ` (${defaultValue})` : ""}:`);
  return answer.trim() || defaultValue;
}

function missingFlag(name: string): never {
  throw new Error(`model configure requires --${name}`);
}

function optionsFromEnv(env: CliEnv) {
  const paths = resolveDailyBriefPaths(env);
  const discordWebhookUrl = resolveConfiguredWebhookUrl(env);

  return {
    sourceRegistryPath: paths.sourceRegistryPath,
    sourceItemRoot: paths.sourceItemRoot,
    agentRunRoot: paths.agentRunRoot,
    archiveRoot: paths.briefArchiveRoot,
    modelRuntimeEnv: env,
    ...(discordWebhookUrl ? { discordWebhookUrl } : {}),
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

    await loadDotenvFile();
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
