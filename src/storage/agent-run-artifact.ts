import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { AgentStageName, AgentStageOutput } from "../agent/stage-contracts.js";
import type { ModelRuntimeConfig } from "../agent/model-runtime-config.js";
import { resolveDailyBriefPaths } from "../config/index.js";

export interface AgentRunArtifact {
  schemaVersion: 1;
  runId: string;
  date: string;
  startedAt: string;
  completedAt?: string;
  model: {
    provider: ModelRuntimeConfig["provider"];
    model: string;
    credentialRef?: string;
  };
  inputRefs: AgentRunInputRefs;
  stages: AgentRunStageRecord[];
  failure?: AgentRunFailure;
}

export interface AgentRunInputRefs {
  sourceItemIds?: string[];
  signalIds?: string[];
  batch?: {
    index: number;
    total: number;
  };
}

export interface AgentRunStageRecord {
  stage: AgentStageName;
  status: "succeeded" | "failed";
  startedAt: string;
  completedAt: string;
  inputRefs: AgentRunInputRefs;
  output?: AgentStageOutput;
  validation: {
    status: "passed" | "failed";
    issues: string[];
  };
  failure?: AgentRunFailure;
}

export interface AgentRunFailure {
  kind: "validation" | "execution";
  message: string;
  issues?: string[];
}

export interface WrittenAgentRunArtifact {
  path: string;
  artifact: AgentRunArtifact;
}

export function createAgentRunArtifact(input: {
  date: Date;
  modelRuntimeConfig: ModelRuntimeConfig;
  inputRefs?: AgentRunInputRefs;
  runId?: string;
  startedAt?: Date;
}): AgentRunArtifact {
  const startedAt = input.startedAt ?? new Date();

  return {
    schemaVersion: 1,
    runId: input.runId ?? createAgentRunId(startedAt),
    date: input.date.toISOString().slice(0, 10),
    startedAt: startedAt.toISOString(),
    model: {
      provider: input.modelRuntimeConfig.provider,
      model: input.modelRuntimeConfig.model,
      ...(input.modelRuntimeConfig.credentialRef ? { credentialRef: input.modelRuntimeConfig.credentialRef } : {})
    },
    inputRefs: input.inputRefs ?? {},
    stages: []
  };
}

export async function writeAgentRunArtifact(
  artifact: AgentRunArtifact,
  date: Date,
  root = resolveDailyBriefPaths().agentRunRoot
): Promise<WrittenAgentRunArtifact> {
  const completed = {
    ...artifact,
    completedAt: artifact.completedAt ?? new Date().toISOString()
  };
  const path = agentRunArtifactPath(date, completed.runId, root);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(completed, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

  return { path, artifact: completed };
}

export async function readAgentRunArtifact(path: string): Promise<AgentRunArtifact> {
  return JSON.parse(await readFile(path, "utf8")) as AgentRunArtifact;
}

export function agentRunArtifactPath(date: Date, runId: string, root = resolveDailyBriefPaths().agentRunRoot): string {
  const datePart = date.toISOString().slice(0, 10);
  const [year, month] = datePart.split("-");

  if (!year || !month) {
    throw new Error(`Invalid Agent Run Artifact date: ${datePart}`);
  }

  return join(root, year, month, datePart, `${runId}.json`);
}

function createAgentRunId(date: Date): string {
  return `${date.toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
}
