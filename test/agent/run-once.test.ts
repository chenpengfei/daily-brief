import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runOnce } from "../../src/agent/index.js";

describe("run-once", () => {
  it("archives a low-signal Daily Brief through the Pi runtime when no Sources are configured", async () => {
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
        archiveRoot
      });

      const archived = await readFile(result.archivePath, "utf8");

      expect(result.archivePath).toBe(join(archiveRoot, "2026", "05", "2026-05-28.md"));
      expect(result.sourceCount).toBe(0);
      expect(result.piEvents).toContain("agent_start");
      expect(archived).toContain("# Daily Brief - 2026-05-28");
      expect(archived).toContain("## Executive Summary");
      expect(archived).toContain("## Top Signals");
      expect(archived).toContain("## Source Coverage");
      expect(archived).toContain("## Sources");
      expect(archived).toContain("low-signal day");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
