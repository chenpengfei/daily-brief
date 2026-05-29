import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli.js";

describe("workflow CLI commands", () => {
  it("prints help with the supported Operational CLI commands", async () => {
    const output: string[] = [];

    await runCli(["--help"], captureOutput(output), {});

    expect(output.join("\n")).toContain("daily-brief run-once");
    expect(output.join("\n")).toContain("daily-brief collect");
    expect(output.join("\n")).toContain("daily-brief generate");
    expect(output.join("\n")).toContain("daily-brief deliver");
    expect(output.join("\n")).toContain("daily-brief status");
    expect(output.join("\n")).toContain("daily-brief sources list");
  });

  it("fails clearly for unknown commands", async () => {
    await expect(runCli(["unknown-command"], captureOutput([]), {})).rejects.toThrow(
      "Unknown command: unknown-command"
    );
  });

  it("prints Operational Status from configured registry and archive roots", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-status-"));
    const registryPath = join(directory, "sources.yaml");
    const archiveRoot = join(directory, "briefs");
    const archiveDirectory = join(archiveRoot, currentYear(), currentMonth());
    const archivePath = join(archiveDirectory, `${currentDate()}.md`);
    const output: string[] = [];

    try {
      await mkdir(archiveDirectory, { recursive: true });
      await writeFile(registryPath, "sources: []\n", "utf8");
      await writeFile(archivePath, `# Daily Brief - ${currentDate()}\n`, "utf8");

      await runCli(["status"], captureOutput(output), {
        DAILY_BRIEF_SOURCE_REGISTRY_PATH: registryPath,
        DAILY_BRIEF_ARCHIVE_ROOT: archiveRoot
      });

      expect(output.join("\n")).toContain(`success: Daily Brief archive exists for ${currentDate()}.`);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("runs a low-signal daily workflow through configured roots", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-run-once-"));
    const registryPath = join(directory, "sources.yaml");
    const archiveRoot = join(directory, "briefs");
    const sourceItemRoot = join(directory, "source-items");
    const output: string[] = [];

    try {
      await writeFile(registryPath, "sources: []\n", "utf8");

      await runCli(["run-once"], captureOutput(output), {
        DAILY_BRIEF_SOURCE_REGISTRY_PATH: registryPath,
        DAILY_BRIEF_ARCHIVE_ROOT: archiveRoot,
        DAILY_BRIEF_SOURCE_ITEM_ROOT: sourceItemRoot
      });

      const archiveLine = output.find((line) => line.startsWith("Daily Brief archived: "));
      const archivePath = archiveLine?.replace("Daily Brief archived: ", "");

      expect(output.join("\n")).toContain("Sources read: 0");
      expect(output.join("\n")).toContain("Discord delivery: skipped");
      expect(output.join("\n")).toContain("Pi events:");
      expect(archivePath).toBeTruthy();
      expect(await readFile(String(archivePath), "utf8")).toContain("low-signal day");
    } finally {
      await rm(directory, { recursive: true, force: true });
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

function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentYear(): string {
  return currentDate().slice(0, 4);
}

function currentMonth(): string {
  return currentDate().slice(5, 7);
}
