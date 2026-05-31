import { homedir } from "node:os";
import { join } from "node:path";

export type DailyBriefPathEnv = Partial<Record<"DAILY_BRIEF_HOME" | "DAILY_BRIEF_DATA_HOME", string | undefined>>;

export interface DailyBriefPaths {
  home: string;
  dataHome: string;
  configPath: string;
  sourceRegistryPath: string;
  authPath: string;
  sourceItemRoot: string;
  agentRunRoot: string;
  briefArchiveRoot: string;
}

export function resolveDailyBriefPaths(env: DailyBriefPathEnv = process.env): DailyBriefPaths {
  const home = nonEmpty(env.DAILY_BRIEF_HOME) ?? join(homedir(), ".daily-brief");
  const dataHome = nonEmpty(env.DAILY_BRIEF_DATA_HOME) ?? join(home, "data");

  return {
    home,
    dataHome,
    configPath: join(home, "config.yaml"),
    sourceRegistryPath: join(home, "sources.yaml"),
    authPath: join(home, "auth.json"),
    sourceItemRoot: join(dataHome, "source-items"),
    agentRunRoot: join(dataHome, "agent-runs"),
    briefArchiveRoot: join(dataHome, "briefs")
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
