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
      message: "config/sources.yaml is invalid"
    });

    expect(notification).toContain("Daily Brief failed");
    expect(notification).toContain("Core Workflow Failure: unreadable-source-registry");
    expect(notification).toContain("No Daily Brief was generated");
  });

  it("distinguishes core failure, partial status, and success for Operational CLI status", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-status-"));
    const registryPath = join(directory, "sources.yaml");
    const archiveRoot = join(directory, "briefs");
    const archiveDirectory = join(archiveRoot, "2026", "05");
    const date = new Date("2026-05-28T07:00:00.000Z");

    try {
      await expect(getOperationalStatus({ date, sourceRegistryPath: registryPath, archiveRoot })).resolves.toMatchObject({
        health: "core-failure"
      });

      await writeFile(registryPath, "sources: []\n", "utf8");
      await expect(getOperationalStatus({ date, sourceRegistryPath: registryPath, archiveRoot })).resolves.toMatchObject({
        health: "partial-failure",
        message: "No Daily Brief archived for 2026-05-28 yet."
      });

      await mkdir(archiveDirectory, { recursive: true });
      await writeFile(join(archiveDirectory, "2026-05-28.md"), "# Daily Brief - 2026-05-28\n", "utf8");

      await expect(getOperationalStatus({ date, sourceRegistryPath: registryPath, archiveRoot })).resolves.toMatchObject({
        health: "success"
      });
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
