import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSourceRegistry } from "../config/index.js";
import type { SourceCollectionResult } from "../collection/index.js";

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
  sourceRegistryPath?: string;
  archiveRoot?: string;
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

export async function getOperationalStatus(options: OperationalStatusOptions = {}): Promise<WorkflowStatus> {
  const date = options.date ?? new Date();

  try {
    await loadSourceRegistry(options.sourceRegistryPath);
  } catch (error) {
    return evaluateWorkflowStatus({
      collectionResults: [],
      briefGenerated: false,
      coreFailure: {
        kind: "unreadable-source-registry",
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }

  const archivePath = briefArchivePath(date, options.archiveRoot ?? "briefs");

  try {
    await readFile(archivePath, "utf8");
  } catch {
    return {
      health: "partial-failure",
      message: `No Daily Brief archived for ${date.toISOString().slice(0, 10)} yet.`,
      materialPartialFailures: []
    };
  }

  return {
    health: "success",
    message: `Daily Brief archive exists for ${date.toISOString().slice(0, 10)}.`,
    materialPartialFailures: []
  };
}

function isMaterialPartialFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  const nonMaterialPatterns = ["missing transcript", "transcript missing", "rate limit", "parse failure"];

  return !nonMaterialPatterns.some((pattern) => normalized.includes(pattern));
}

function briefArchivePath(date: Date, root: string): string {
  const datePart = date.toISOString().slice(0, 10);
  const [year, month] = datePart.split("-");

  if (!year || !month) {
    throw new Error(`Invalid archive date: ${datePart}`);
  }

  return join(root, year, month, `${datePart}.md`);
}
