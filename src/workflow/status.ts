import { constants } from "node:fs";
import { access, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readModelRuntimeConfig } from "../agent/model-runtime-config.js";
import type { SourceCollectionResult } from "../collection/index.js";
import {
  formatDateKey,
  getCredential,
  loadSourceRegistry,
  readDeliveryConfig,
  resolveDailyBriefPaths
} from "../config/index.js";
import { agentRunArtifactPath, readSourceItems, sourceItemStorePath } from "../storage/index.js";

export type WorkflowHealth = "success" | "partial-failure" | "core-failure";

export type CoreWorkflowFailureKind =
  | "unreadable-source-registry"
  | "unwritable-brief-archive"
  | "no-usable-source-items"
  | "brief-generation-unavailable"
  | "delivery-unavailable";

export interface CoreWorkflowFailure {
  kind: CoreWorkflowFailureKind;
  message: string;
}

export interface WorkflowStatus {
  health: WorkflowHealth;
  message: string;
  materialPartialFailures: string[];
  coreFailure?: CoreWorkflowFailure;
}

export interface EvaluateWorkflowStatusInput {
  collectionResults: SourceCollectionResult[];
  briefGenerated: boolean;
  coreFailure?: CoreWorkflowFailure;
}

export interface OperationalStatusOptions {
  date?: Date;
  dateKey?: string;
  env?: Partial<Record<"DAILY_BRIEF_HOME" | "DAILY_BRIEF_DATA_HOME", string | undefined>>;
  dataHome?: string;
  configPath?: string;
  authPath?: string;
  sourceRegistryPath?: string;
  sourceItemRoot?: string;
  agentRunRoot?: string;
  archiveRoot?: string;
}

export type OperationalStatusState = "ok" | "missing" | "invalid" | "disabled" | "not-ready";

export interface OperationalStatusCheck {
  state: OperationalStatusState;
  label: string;
  path?: string;
  detail?: string;
}

export interface OperationalStatusReport extends WorkflowStatus {
  dateKey: string;
  systemTimezone: string;
  paths: {
    home: string;
    dataHome: string;
    configPath: string;
    sourceRegistryPath: string;
    authPath: string;
    sourceItemRoot: string;
    agentRunRoot: string;
    archiveRoot: string;
  };
  setup: {
    config: OperationalStatusCheck;
    sourceRegistry: OperationalStatusCheck & { enabledCount?: number; totalCount?: number };
    model: OperationalStatusCheck & { provider?: string; model?: string; credentialRef?: string };
    delivery: OperationalStatusCheck;
    data: OperationalStatusCheck;
  };
  today: {
    sourceItems: OperationalStatusCheck & { itemCount?: number };
    briefArchive: OperationalStatusCheck;
    agentRunArtifacts: OperationalStatusCheck & { fileCount?: number };
  };
  nextAction: string;
}

export function evaluateWorkflowStatus(input: EvaluateWorkflowStatusInput): WorkflowStatus {
  if (input.coreFailure) {
    return {
      health: "core-failure",
      message: input.coreFailure.message,
      materialPartialFailures: [],
      coreFailure: input.coreFailure
    };
  }

  if (!input.briefGenerated) {
    return {
      health: "core-failure",
      message: "Daily Brief generation did not produce an archiveable Brief.",
      materialPartialFailures: [],
      coreFailure: {
        kind: "brief-generation-unavailable",
        message: "Daily Brief generation did not produce an archiveable Brief."
      }
    };
  }

  const materialPartialFailures = input.collectionResults
    .filter((result) => result.status === "failed")
    .map((result) => `${result.sourceId}: ${result.reason ?? "Unknown failure"}`)
    .filter(isMaterialPartialFailure);

  if (materialPartialFailures.length > 0) {
    return {
      health: "partial-failure",
      message: "Daily Brief generated with material Source Coverage gaps.",
      materialPartialFailures
    };
  }

  return {
    health: "success",
    message: "Daily Brief workflow completed successfully.",
    materialPartialFailures: []
  };
}

export function createCoreWorkflowFailureNotification(failure: CoreWorkflowFailure): string {
  return [
    "Daily Brief failed",
    "",
    `Core Workflow Failure: ${failure.kind}`,
    failure.message,
    "",
    "No Daily Brief was generated, because sending a false or unsupported Brief would break trust."
  ].join("\n");
}

export async function getOperationalStatus(options: OperationalStatusOptions = {}): Promise<OperationalStatusReport> {
  const date = options.date ?? new Date();
  const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateKey = options.dateKey ?? formatDateKey(date, systemTimezone);
  const resolvedPaths = resolveDailyBriefPaths(options.env);
  const paths = {
    ...resolvedPaths,
    ...(options.dataHome ? { dataHome: options.dataHome } : {}),
    ...(options.configPath ? { configPath: options.configPath } : {}),
    ...(options.authPath ? { authPath: options.authPath } : {}),
    ...(options.sourceRegistryPath ? { sourceRegistryPath: options.sourceRegistryPath } : {}),
    ...(options.sourceItemRoot ? { sourceItemRoot: options.sourceItemRoot } : {}),
    ...(options.agentRunRoot ? { agentRunRoot: options.agentRunRoot } : {}),
    ...(options.archiveRoot ? { briefArchiveRoot: options.archiveRoot } : {})
  };
  const archivePath = briefArchivePath(date, paths.briefArchiveRoot, dateKey);
  const sourceItemPath = sourceItemStorePath(date, paths.sourceItemRoot, dateKey);
  const agentRunDirectory = dirname(agentRunArtifactPath(date, "status-probe", paths.agentRunRoot, dateKey));

  const setup = {
    config: await inspectConfig(paths.configPath),
    sourceRegistry: await inspectSourceRegistry(paths.sourceRegistryPath),
    model: inspectModel(paths.configPath, paths.authPath, options.env),
    delivery: inspectDelivery(paths.configPath, paths.authPath),
    data: await inspectDataDirectory(paths.dataHome)
  };
  const today = {
    sourceItems: await inspectSourceItems(date, paths.sourceItemRoot, dateKey, sourceItemPath),
    briefArchive: await inspectBriefArchive(archivePath),
    agentRunArtifacts: await inspectAgentRunArtifacts(agentRunDirectory)
  };
  const nextAction = chooseNextAction(setup, today);
  const workflow = summarizeOperationalStatus(dateKey, setup, today);

  return {
    ...workflow,
    dateKey,
    systemTimezone,
    paths: {
      home: paths.home,
      dataHome: paths.dataHome,
      configPath: paths.configPath,
      sourceRegistryPath: paths.sourceRegistryPath,
      authPath: paths.authPath,
      sourceItemRoot: paths.sourceItemRoot,
      agentRunRoot: paths.agentRunRoot,
      archiveRoot: paths.briefArchiveRoot
    },
    setup,
    today,
    nextAction
  };
}

function isMaterialPartialFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  const nonMaterialPatterns = ["missing transcript", "transcript missing", "rate limit", "parse failure"];

  return !nonMaterialPatterns.some((pattern) => normalized.includes(pattern));
}

function briefArchivePath(date: Date, root: string, dateKey?: string): string {
  const datePart = dateKey ?? date.toISOString().slice(0, 10);
  const [year, month] = datePart.split("-");

  if (!year || !month) {
    throw new Error(`Invalid archive date: ${datePart}`);
  }

  return join(root, year, month, `${datePart}.md`);
}

async function inspectConfig(path: string): Promise<OperationalStatusCheck> {
  return (await canRead(path))
    ? { state: "ok", label: "Config file found", path }
    : { state: "missing", label: "Config file missing", path };
}

async function inspectSourceRegistry(path: string): Promise<OperationalStatusReport["setup"]["sourceRegistry"]> {
  try {
    const registry = await loadSourceRegistry(path);
    const enabledCount = registry.sources.filter((source) => source.enabled).length;
    return {
      state: "ok",
      label: "Source Registry valid",
      path,
      enabledCount,
      totalCount: registry.sources.length,
      detail: `${enabledCount}/${registry.sources.length} enabled`
    };
  } catch (error) {
    return {
      state: (await canRead(path)) ? "invalid" : "missing",
      label: (await canRead(path)) ? "Source Registry invalid" : "Source Registry missing",
      path,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

function inspectModel(
  configPath: string,
  authPath: string,
  env: OperationalStatusOptions["env"]
): OperationalStatusReport["setup"]["model"] {
  try {
    const model = readModelRuntimeConfig(env, { configPath, authPath });
    return {
      state: model.ready ? "ok" : "not-ready",
      label: model.ready ? "Model ready" : "Model not ready",
      path: configPath,
      provider: model.provider,
      model: model.model,
      ...(model.credentialRef ? { credentialRef: model.credentialRef } : {}),
      ...(model.issues.length > 0 ? { detail: model.issues.join("; ") } : {})
    };
  } catch (error) {
    return {
      state: "invalid",
      label: "Model config invalid",
      path: configPath,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

function inspectDelivery(configPath: string, authPath: string): OperationalStatusCheck {
  try {
    const delivery = readDeliveryConfig(configPath);
    if (!delivery?.enabled) {
      return { state: "disabled", label: "Discord delivery disabled", path: configPath };
    }

    if (!delivery.webhookRef) {
      return { state: "not-ready", label: "Discord delivery missing webhook credential name", path: configPath };
    }

    const credential = getCredential(delivery.webhookRef, authPath);
    if (!credential) {
      return {
        state: "not-ready",
        label: "Discord delivery webhook credential missing",
        path: authPath,
        detail: delivery.webhookRef
      };
    }

    if (credential.type !== "webhook" || credential.provider !== "discord") {
      return {
        state: "invalid",
        label: "Discord delivery credential is not a webhook",
        path: authPath,
        detail: delivery.webhookRef
      };
    }

    return { state: "ok", label: "Discord delivery ready", path: authPath, detail: delivery.webhookRef };
  } catch (error) {
    return {
      state: "invalid",
      label: "Discord delivery config invalid",
      path: configPath,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

async function inspectDataDirectory(path: string): Promise<OperationalStatusCheck> {
  try {
    await access(path, constants.W_OK);
    return { state: "ok", label: "Data directory writable", path };
  } catch (error) {
    return {
      state: (await canRead(path)) ? "not-ready" : "missing",
      label: (await canRead(path)) ? "Data directory is not writable" : "Data directory missing",
      path,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

async function inspectSourceItems(
  date: Date,
  root: string,
  dateKey: string,
  path: string
): Promise<OperationalStatusReport["today"]["sourceItems"]> {
  try {
    const items = await readSourceItems(date, root, dateKey);
    return items.length > 0
      ? { state: "ok", label: "Source Items found", path, itemCount: items.length, detail: `${items.length} item(s)` }
      : { state: "missing", label: "No Source Items for today", path, itemCount: 0 };
  } catch (error) {
    return {
      state: "invalid",
      label: "Source Items invalid",
      path,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

async function inspectBriefArchive(path: string): Promise<OperationalStatusCheck> {
  return (await canRead(path))
    ? { state: "ok", label: "Daily Brief archive found", path }
    : { state: "missing", label: "No Daily Brief archive for today", path };
}

async function inspectAgentRunArtifacts(directory: string): Promise<OperationalStatusReport["today"]["agentRunArtifacts"]> {
  try {
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
    return files.length > 0
      ? {
          state: "ok",
          label: "Agent Run Artifacts found",
          path: join(directory, files[files.length - 1] ?? ""),
          fileCount: files.length,
          detail: `${files.length} artifact(s)`
        }
      : { state: "missing", label: "No Agent Run Artifacts for today", path: directory, fileCount: 0 };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { state: "missing", label: "No Agent Run Artifacts for today", path: directory, fileCount: 0 };
    }

    return {
      state: "invalid",
      label: "Agent Run Artifacts unreadable",
      path: directory,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

function summarizeOperationalStatus(
  dateKey: string,
  setup: OperationalStatusReport["setup"],
  today: OperationalStatusReport["today"]
): WorkflowStatus {
  if (setup.sourceRegistry.state === "missing" || setup.sourceRegistry.state === "invalid") {
    return evaluateWorkflowStatus({
      collectionResults: [],
      briefGenerated: false,
      coreFailure: {
        kind: "unreadable-source-registry",
        message: setup.sourceRegistry.detail ?? `${setup.sourceRegistry.label}: ${setup.sourceRegistry.path}`
      }
    });
  }

  const setupReady =
    setup.config.state === "ok" &&
    setup.model.state === "ok" &&
    setup.data.state === "ok" &&
    (setup.delivery.state === "ok" || setup.delivery.state === "disabled");

  if (!setupReady) {
    return {
      health: "partial-failure",
      message: "Daily Brief cannot determine today's run state until configuration is ready.",
      materialPartialFailures: []
    };
  }

  if (today.briefArchive.state !== "ok") {
    return {
      health: "partial-failure",
      message: `No Daily Brief archived for ${dateKey} yet.`,
      materialPartialFailures: []
    };
  }

  return {
    health: "success",
    message: `Daily Brief archive exists for ${dateKey}.`,
    materialPartialFailures: []
  };
}

function chooseNextAction(
  setup: OperationalStatusReport["setup"],
  today: OperationalStatusReport["today"]
): string {
  if (setup.config.state !== "ok") {
    return "daily-brief config";
  }

  if (setup.sourceRegistry.state !== "ok") {
    return "daily-brief config";
  }

  if (setup.sourceRegistry.enabledCount === 0) {
    return "daily-brief sources list, then daily-brief sources enable <source-id>";
  }

  if (setup.model.state !== "ok") {
    return "daily-brief config";
  }

  if (setup.data.state !== "ok") {
    return "daily-brief config";
  }

  if (setup.delivery.state === "not-ready" || setup.delivery.state === "invalid") {
    return "daily-brief config";
  }

  if (today.briefArchive.state !== "ok") {
    return "daily-brief run-once";
  }

  return "No action needed";
}

async function canRead(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
