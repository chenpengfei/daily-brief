import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/cli.js";

describe("workflow CLI commands", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("fails non-interactively with setup guidance when configuration is missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-missing-config-"));

    try {
      await expect(runCli(["run-once"], captureOutput([]), { DAILY_BRIEF_HOME: directory })).rejects.toThrow(
        "Run daily-brief setup first"
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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
        DAILY_BRIEF_HOME: directory,
        DAILY_BRIEF_DATA_HOME: directory
      });

      expect(output.join("\n")).toContain(`success: Daily Brief archive exists for ${currentDate()}.`);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("runs a daily workflow through configured roots", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-run-once-"));
    const registryPath = join(directory, "sources.yaml");
    const output: string[] = [];

    try {
      await writeFixtureRegistry(directory, registryPath);

      await runCli(["run-once"], captureOutput(output), {
        DAILY_BRIEF_HOME: directory,
        DAILY_BRIEF_DATA_HOME: directory,
        ...fauxRuntimeEnv()
      });

      const archiveLine = output.find((line) => line.startsWith("Daily Brief archived: "));
      const archivePath = archiveLine?.replace("Daily Brief archived: ", "");

      expect(output.join("\n")).toContain("Sources read: 1");
      expect(output.join("\n")).toContain("Discord delivery: skipped");
      expect(output.join("\n")).toContain("Pi events:");
      expect(archivePath).toBeTruthy();
      expect(await readFile(String(archivePath), "utf8")).toContain("### Agent runtime patterns");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("uses --date for workflow artifact paths", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-date-"));
    const registryPath = join(directory, "sources.yaml");
    const output: string[] = [];

    try {
      await writeFixtureRegistry(directory, registryPath);

      await runCli(["run-once", "--date", "2026-05-28"], captureOutput(output), {
        DAILY_BRIEF_HOME: directory,
        DAILY_BRIEF_DATA_HOME: directory,
        ...fauxRuntimeEnv()
      });

      expect(output.find((line) => line.startsWith("Daily Brief archived: "))).toContain(
        join(directory, "briefs", "2026", "05", "2026-05-28.md")
      );
      await expect(readdir(join(directory, "agent-runs", "2026", "05", "2026-05-28"))).resolves.toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("uses configured timezone for default workflow date paths", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-timezone-"));
    const registryPath = join(directory, "sources.yaml");
    const output: string[] = [];

    try {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-05-30T16:30:00.000Z"));
      await writeFile(join(directory, "config.yaml"), "timezone: Asia/Shanghai\n", "utf8");
      await writeFixtureRegistry(directory, registryPath);

      await runCli(["run-once"], captureOutput(output), {
        DAILY_BRIEF_HOME: directory,
        DAILY_BRIEF_DATA_HOME: directory,
        ...fauxRuntimeEnv()
      });

      expect(output.find((line) => line.startsWith("Daily Brief archived: "))).toContain(
        join(directory, "briefs", "2026", "05", "2026-05-31.md")
      );
      await expect(readdir(join(directory, "agent-runs", "2026", "05", "2026-05-31"))).resolves.toHaveLength(1);
      await expect(readFile(join(directory, "source-items", "2026", "05", "2026-05-31.jsonl"), "utf8")).resolves.toContain(
        "fixture-blog:item-1"
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails run-once instead of printing a normal archive when all enabled Sources fail", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-source-failure-"));
    const registryPath = join(directory, "sources.yaml");

    try {
      await writeFile(
        registryPath,
        [
          "sources:",
          "  - id: missing-fixture",
          "    platform: blog",
          "    adapter: fixture",
          `    target: ${join(directory, "missing.json")}`,
          "    enabled: true",
          "    notes: Missing fixture"
        ].join("\n"),
        "utf8"
      );

      await expect(
        runCli(["run-once", "--date", "2026-05-31"], captureOutput([]), {
          DAILY_BRIEF_HOME: directory,
          DAILY_BRIEF_DATA_HOME: directory,
          ...fauxRuntimeEnv()
        })
      ).rejects.toThrow("Core Workflow Failure: no-usable-source-items");
      await expect(readFile(join(directory, "briefs", "2026", "05", "2026-05-31.md"), "utf8")).rejects.toThrow("ENOENT");
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

async function writeFixtureRegistry(directory: string, registryPath: string): Promise<void> {
  const fixturePath = join(directory, "fixture.json");
  await writeFile(
    fixturePath,
    JSON.stringify({
      items: [
        {
          id: "item-1",
          url: "https://example.com/agent-runtime",
          title: "Agent runtime patterns",
          analyzableText: "Agent Architecture notes about tool execution."
        }
      ]
    }),
    "utf8"
  );
  await writeFile(
    registryPath,
    [
      "sources:",
      "  - id: fixture-blog",
      "    platform: blog",
      "    adapter: fixture",
      `    target: ${fixturePath}`,
      "    enabled: true",
      "    notes: Fixture"
    ].join("\n"),
    "utf8"
  );
}

function fauxRuntimeEnv() {
  return {
    DAILY_BRIEF_ALLOW_FAUX_PROVIDER: "true",
    DAILY_BRIEF_MODEL_PROVIDER: "faux",
    DAILY_BRIEF_MODEL: "faux-daily-brief-renderer"
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
