import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runOnce } from "../../src/agent/index.js";

describe("run-once", () => {
  it("does not archive a false low-signal Daily Brief when no Sources are configured", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-run-"));
    const configDirectory = join(directory, "config");
    const archiveRoot = join(directory, "briefs");
    const sourceRegistryPath = join(configDirectory, "sources.yaml");

    try {
      await mkdir(configDirectory, { recursive: true });
      await writeFile(sourceRegistryPath, "sources: []\n", "utf8");

      const result = await runOnce({
        date: new Date("2026-05-28T06:00:00.000Z"),
        sourceRegistryPath,
        archiveRoot,
        discordEnv: { DAILY_BRIEF_HOME: directory }
      });

      expect(result.coreFailure).toMatchObject({ kind: "no-usable-source-items" });
      expect(result.archivePath).toBe("");
      expect(result.sourceCount).toBe(0);
      await expect(readFile(join(archiveRoot, "2026", "05", "2026-05-28.md"), "utf8")).rejects.toThrow("ENOENT");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
