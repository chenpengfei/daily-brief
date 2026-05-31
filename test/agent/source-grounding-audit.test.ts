import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AnalysisFailureError, runSourceGroundingAuditStage } from "../../src/agent/index.js";
import { createAgentRunArtifact, writeAgentRunArtifact } from "../../src/storage/index.js";
import type { DailyBrief } from "../../src/brief/index.js";
import type { SourceItem } from "../../src/domain/index.js";

describe("Source-grounding Audit Stage", () => {
  it("passes valid narrative and records an audit result", async () => {
    const artifact = createArtifact();
    const result = await runSourceGroundingAuditStage({ brief: brief(), sourceItems: [sourceItem()], artifact });

    expect(result.audit.status).toBe("passed");
    expect(artifact.stages[0]).toMatchObject({ stage: "audit", output: { status: "passed" } });
  });

  it("fails as Analysis Failure when a citation references an unknown Source Item", async () => {
    const artifact = createArtifact();

    await expect(
      runSourceGroundingAuditStage({
        brief: brief({ citationSourceItemId: "missing" }),
        sourceItems: [sourceItem()],
        artifact,
        allowRepair: false
      })
    ).rejects.toThrow(AnalysisFailureError);
  });

  it("fails without deterministic repair and records violations", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-audit-"));
    const artifact = createArtifact();

    try {
      await expect(
        runSourceGroundingAuditStage({
          brief: brief({ missingLens: true, overconfident: true }),
          sourceItems: [sourceItem()],
          artifact,
          allowRepair: true
        })
      ).rejects.toThrow("Source-grounding audit failed");

      const written = await writeAgentRunArtifact(artifact, new Date("2026-05-28T07:00:00.000Z"), directory);
      const serialized = await readFile(written.path, "utf8");
      expect(JSON.parse(serialized).stages.filter((stage: { stage: string }) => stage.stage === "audit")).toHaveLength(1);
      expect(serialized).toContain("unsupported overconfident claim");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects Executive Summary overstatement when Source Coverage has partial failures", async () => {
    await expect(
      runSourceGroundingAuditStage({
        brief: brief({ executiveSummary: "全部 Sources 完整覆盖，今天有 1 个 Signal。", partialFailures: ["x failed"] }),
        sourceItems: [sourceItem()],
        artifact: createArtifact(),
        allowRepair: false
      })
    ).rejects.toThrow(AnalysisFailureError);
  });
});

function createArtifact() {
  return createAgentRunArtifact({
    date: new Date("2026-05-28T07:00:00.000Z"),
    runId: "audit",
    modelRuntimeConfig: { provider: "faux", model: "faux-daily-brief-renderer", ready: true, issues: [] }
  });
}

function brief(
  overrides: { citationSourceItemId?: string; missingLens?: boolean; overconfident?: boolean; executiveSummary?: string; partialFailures?: string[] } = {}
): DailyBrief {
  return {
    date: new Date("2026-05-28T07:00:00.000Z"),
    executiveSummary: overrides.executiveSummary ?? "今天有 1 个 Source-grounded Signal。",
    sourceCoverage: { sourceCount: 1, sourceItemCount: 1, partialFailures: overrides.partialFailures ?? [] },
    signals: [
      {
        id: "signal:one",
        type: "architecture",
        title: "Agent runtime",
        ...(overrides.missingLens ? {} : { focusAreas: ["Agent 架构"], directions: ["先进工具"] }),
        summary: {
          whatItIs: overrides.overconfident ? "This is guaranteed best in class." : "当前 Source Item 表明 Agent runtime pattern。",
          whatItIsNot: "不是成熟度背书。",
          minimalExample: "读 cited Source Item。"
        },
        whyItMatters: "它影响 Agent Architecture。",
        citations: [
          { sourceItemId: overrides.citationSourceItemId ?? "item-1", sourceId: "source", title: "Agent runtime", url: "https://example.com" }
        ]
      }
    ]
  };
}

function sourceItem(): SourceItem {
  return {
    id: "item-1",
    sourceId: "source",
    platform: "blog",
    url: "https://example.com",
    title: "Agent runtime",
    fetchedAt: "2026-05-28T07:00:00.000Z",
    analyzableText: "Agent Architecture notes.",
    contentHash: "hash"
  };
}
