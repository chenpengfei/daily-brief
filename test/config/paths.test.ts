import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDailyBriefPaths } from "../../src/config/index.js";

describe("Daily Brief installed paths", () => {
  it("resolves default config files under the user Daily Brief home and data under that home", () => {
    const paths = resolveDailyBriefPaths({});

    expect(paths.home).toMatch(/\.daily-brief$/);
    expect(paths.dataHome).toBe(join(paths.home, "data"));
    expect(paths.configPath).toBe(join(paths.home, "config.yaml"));
    expect(paths.sourceRegistryPath).toBe(join(paths.home, "sources.yaml"));
    expect(paths.authPath).toBe(join(paths.home, "auth.json"));
    expect(paths.sourceItemRoot).toBe(join(paths.home, "data", "source-items"));
    expect(paths.agentRunRoot).toBe(join(paths.home, "data", "agent-runs"));
    expect(paths.briefArchiveRoot).toBe(join(paths.home, "data", "briefs"));
  });

  it("uses DAILY_BRIEF_HOME for config files and default data", () => {
    const paths = resolveDailyBriefPaths({ DAILY_BRIEF_HOME: "/tmp/daily-brief-home" });

    expect(paths.configPath).toBe("/tmp/daily-brief-home/config.yaml");
    expect(paths.sourceRegistryPath).toBe("/tmp/daily-brief-home/sources.yaml");
    expect(paths.authPath).toBe("/tmp/daily-brief-home/auth.json");
    expect(paths.sourceItemRoot).toBe("/tmp/daily-brief-home/data/source-items");
    expect(paths.agentRunRoot).toBe("/tmp/daily-brief-home/data/agent-runs");
    expect(paths.briefArchiveRoot).toBe("/tmp/daily-brief-home/data/briefs");
  });

  it("uses DAILY_BRIEF_DATA_HOME for generated artifacts only", () => {
    const paths = resolveDailyBriefPaths({
      DAILY_BRIEF_HOME: "/tmp/daily-brief-home",
      DAILY_BRIEF_DATA_HOME: "/tmp/daily-brief-data"
    });

    expect(paths.configPath).toBe("/tmp/daily-brief-home/config.yaml");
    expect(paths.sourceRegistryPath).toBe("/tmp/daily-brief-home/sources.yaml");
    expect(paths.authPath).toBe("/tmp/daily-brief-home/auth.json");
    expect(paths.sourceItemRoot).toBe("/tmp/daily-brief-data/source-items");
    expect(paths.agentRunRoot).toBe("/tmp/daily-brief-data/agent-runs");
    expect(paths.briefArchiveRoot).toBe("/tmp/daily-brief-data/briefs");
  });
});
