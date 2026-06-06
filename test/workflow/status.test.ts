import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  createCoreWorkflowFailureNotification,
  evaluateWorkflowStatus,
  getOperationalStatus
} from "../../src/workflow/index.js";

describe("workflow status", () => {
  it("does not treat routine partial collection failures as material coverage gaps", () => {
    const status = evaluateWorkflowStatus({
      briefGenerated: true,
      collectionResults: [
        failedSource("youtube", "missing transcript"),
        failedSource("x-search", "rate limit"),
        failedSource("blog", "parse failure for one item")
      ]
    });

    expect(status).toMatchObject({
      health: "success",
      materialPartialFailures: []
    });
  });

  it("reports material partial failures without turning them into core failures", () => {
    const status = evaluateWorkflowStatus({
      briefGenerated: true,
      collectionResults: [failedSource("github", "authentication failed")]
    });

    expect(status).toEqual({
      health: "partial-failure",
      message: "Daily Brief generated with material Source Coverage gaps.",
      materialPartialFailures: ["github: authentication failed"]
    });
  });

  it("treats missing archiveable brief generation as a Core Workflow Failure", () => {
    const status = evaluateWorkflowStatus({
      briefGenerated: false,
      collectionResults: []
    });

    expect(status).toEqual({
      health: "core-failure",
      message: "Daily Brief generation did not produce an archiveable Brief.",
      materialPartialFailures: [],
      coreFailure: {
        kind: "brief-generation-unavailable",
        message: "Daily Brief generation did not produce an archiveable Brief."
      }
    });
  });

  it("creates a Discord-ready Core Workflow Failure notification", () => {
    const notification = createCoreWorkflowFailureNotification({
      kind: "unreadable-source-registry",
      message: "~/.daily-brief/sources.yaml is invalid"
    });

    expect(notification).toContain("Daily Brief failed");
    expect(notification).toContain("Core Workflow Failure: unreadable-source-registry");
    expect(notification).toContain("No Daily Brief was generated");
  });

  it("distinguishes core failure, partial status, and success for Operational CLI status", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-status-"));
    const registryPath = join(directory, "sources.yaml");
    const archiveRoot = join(directory, "briefs");
    const dataHome = directory;
    const archiveDirectory = join(archiveRoot, "2026", "05");
    const date = new Date("2026-05-28T07:00:00.000Z");

    try {
      await expect(getOperationalStatus({ date, sourceRegistryPath: registryPath, archiveRoot })).resolves.toMatchObject({
        health: "core-failure"
      });

      await writeFile(registryPath, "sources: []\n", "utf8");
      await writeFile(join(directory, "config.yaml"), ["model:", "  provider: faux", "  model: faux-daily-brief-renderer"].join("\n"), "utf8");
      await mkdir(dataHome, { recursive: true });
      await expect(
        getOperationalStatus({
          date,
          env: { DAILY_BRIEF_HOME: directory, DAILY_BRIEF_DATA_HOME: dataHome },
          sourceRegistryPath: registryPath,
          archiveRoot
        })
      ).resolves.toMatchObject({
        health: "partial-failure",
        message: "No Daily Brief archived for 2026-05-28 yet.",
        nextAction: "daily-brief sources list, then daily-brief sources enable <source-id>",
        today: {
          briefArchive: {
            state: "missing",
            path: join(archiveRoot, "2026", "05", "2026-05-28.md")
          }
        }
      });

      await mkdir(archiveDirectory, { recursive: true });
      await writeFile(join(archiveDirectory, "2026-05-28.md"), "# Daily Brief - 2026-05-28\n", "utf8");

      await expect(
        getOperationalStatus({
          date,
          env: { DAILY_BRIEF_HOME: directory, DAILY_BRIEF_DATA_HOME: dataHome },
          sourceRegistryPath: registryPath,
          archiveRoot
        })
      ).resolves.toMatchObject({
        health: "success",
        setup: {
          config: { state: "ok", path: join(directory, "config.yaml") },
          model: { state: "ok", provider: "faux" },
          delivery: { state: "disabled" }
        },
        today: {
          briefArchive: { state: "ok", path: join(archiveDirectory, "2026-05-28.md") }
        }
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("points setup-related blockers to the configuration summary", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-status-next-action-"));
    const registryPath = join(directory, "sources.yaml");
    const configPath = join(directory, "config.yaml");
    const dataHome = join(directory, "data");
    const date = new Date("2026-05-28T07:00:00.000Z");

    try {
      await mkdir(dataHome, { recursive: true });
      await writeEnabledRegistry(registryPath);

      await expect(
        getOperationalStatus({
          date,
          env: { DAILY_BRIEF_HOME: directory, DAILY_BRIEF_DATA_HOME: dataHome }
        })
      ).resolves.toMatchObject({ nextAction: "daily-brief config" });

      await writeFile(configPath, "brief:\n  language: zh\n", "utf8");
      await expect(
        getOperationalStatus({
          date,
          env: { DAILY_BRIEF_HOME: directory, DAILY_BRIEF_DATA_HOME: dataHome }
        })
      ).resolves.toMatchObject({ nextAction: "daily-brief config" });

      await writeFile(
        configPath,
        ["model:", "  provider: faux", "  model: faux-daily-brief-renderer", "delivery:", "  enabled: true"].join("\n"),
        "utf8"
      );
      await expect(
        getOperationalStatus({
          date,
          env: { DAILY_BRIEF_HOME: directory, DAILY_BRIEF_DATA_HOME: dataHome }
        })
      ).resolves.toMatchObject({ nextAction: "daily-brief config" });

      await writeFile(configPath, ["model:", "  provider: faux", "  model: faux-daily-brief-renderer"].join("\n"), "utf8");
      await expect(
        getOperationalStatus({
          date,
          env: { DAILY_BRIEF_HOME: directory, DAILY_BRIEF_DATA_HOME: join(directory, "missing-data") }
        })
      ).resolves.toMatchObject({ nextAction: "daily-brief config" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function failedSource(sourceId: string, reason: string) {
  return {
    sourceId,
    status: "failed" as const,
    itemCount: 0,
    writtenCount: 0,
    skippedDuplicateCount: 0,
    reason
  };
}

async function writeEnabledRegistry(path: string): Promise<void> {
  await writeFile(
    path,
    [
      "sources:",
      "  - id: fixture-blog",
      "    platform: blog",
      "    adapter: fixture",
      "    target: fixture.json",
      "    enabled: true",
      "    notes: Fixture"
    ].join("\n"),
    "utf8"
  );
}
