import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createAgentRunArtifact } from "../../src/storage/index.js";
import { runAgentStage } from "../../src/agent/index.js";

describe("Agent stage runner", () => {
  it("validates mocked stage output and records it in an Agent Run Artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-stage-runner-"));
    const date = new Date("2026-05-28T07:00:00.000Z");
    const artifact = createAgentRunArtifact({
      date,
      runId: "run-smoke",
      startedAt: date,
      modelRuntimeConfig: {
        provider: "faux",
        model: "faux-daily-brief-renderer",
        ready: true,
        issues: []
      },
      inputRefs: { signalIds: ["signal:one"] }
    });

    try {
      const result = await runAgentStage({
        stage: "narrative",
        artifact,
        date,
        artifactRoot: directory,
        inputRefs: { signalIds: ["signal:one"] },
        validationContext: { signalIds: ["signal:one"] },
        execute: async () => ({
          stage: "narrative",
          signalNarratives: [
            {
              signalId: "signal:one",
              focusAreas: ["Agent 架构", "AI Coding"],
              directions: ["先进工具", "长程任务"],
              whatItIs: "是什么",
              whatItIsNot: "不是什么",
              minimalExample: "最小例子",
              whyItMatters: "为什么重要"
            }
          ]
        })
      });

      expect(result.record.status).toBe("succeeded");
      expect(result.artifactPath).toBe(join(directory, "2026", "05", "2026-05-28", "run-smoke.json"));
      expect(await readFile(String(result.artifactPath), "utf8")).toContain("\"stage\": \"narrative\"");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("records structured validation failures before rethrowing", async () => {
    const artifact = createAgentRunArtifact({
      date: new Date("2026-05-28T07:00:00.000Z"),
      runId: "run-failure",
      modelRuntimeConfig: {
        provider: "faux",
        model: "faux-daily-brief-renderer",
        ready: true,
        issues: []
      }
    });

    await expect(
      runAgentStage({
        stage: "ranking",
        artifact,
        execute: async () => ({
          stage: "ranking",
          rankedSignals: [{ signalId: "signal:one", rank: 0, reason: "bad rank" }]
        })
      })
    ).rejects.toThrow("rankedSignals[0].rank must be a positive integer");

    expect(artifact.stages[0]).toMatchObject({
      stage: "ranking",
      status: "failed",
      validation: { status: "failed" }
    });
    expect(artifact.failure).toMatchObject({ kind: "validation" });
  });
});
