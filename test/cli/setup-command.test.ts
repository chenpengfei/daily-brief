import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli.js";

describe("setup command", () => {
  it("prepares a fresh user home and data home without running the workflow", async () => {
    const home = await mkdtemp(join(tmpdir(), "daily-brief-home-"));
    const data = await mkdtemp(join(tmpdir(), "daily-brief-data-"));
    const output: string[] = [];

    try {
      await runCli(["setup"], captureOutput(output), { DAILY_BRIEF_HOME: home, DAILY_BRIEF_DATA_HOME: data, TZ: "Asia/Shanghai" });

      expect(await readFile(join(home, "config.yaml"), "utf8")).toContain("timezone: Asia/Shanghai");
      expect(await readFile(join(home, "config.yaml"), "utf8")).toContain("language: zh");
      expect(await readFile(join(home, "sources.yaml"), "utf8")).toContain("github-trending-daily");
      expect(await readFile(join(home, "auth.json"), "utf8")).toContain("\"credentials\": {}");
      expect(output.join("\n")).toContain("Readiness: config files present");
      await expect(readFile(join(data, "briefs", "2026", "05", "2026-05-28.md"), "utf8")).rejects.toThrow("ENOENT");
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(data, { recursive: true, force: true });
    }
  });

  it("preserves existing files unless --force is supplied", async () => {
    const home = await mkdtemp(join(tmpdir(), "daily-brief-home-"));

    try {
      await writeFile(join(home, "config.yaml"), "timezone: UTC\ncustom: keep\n", "utf8");
      await runCli(["setup"], captureOutput([]), { DAILY_BRIEF_HOME: home, TZ: "Asia/Shanghai" });
      expect(await readFile(join(home, "config.yaml"), "utf8")).toContain("custom: keep");

      await runCli(["setup", "--force"], captureOutput([]), { DAILY_BRIEF_HOME: home, TZ: "Asia/Shanghai" });
      expect(await readFile(join(home, "config.yaml"), "utf8")).not.toContain("custom: keep");
      expect(await readFile(join(home, "config.yaml"), "utf8")).toContain("timezone: Asia/Shanghai");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

function captureOutput(output: string[]) {
  return {
    stdout(line: string) {
      output.push(line);
    },
    stderr(line: string) {
      output.push(line);
    }
  };
}
