import { describe, expect, it } from "vitest";
import { runSourceGroundingAuditStage, runSourceGroundingRepairStage } from "../../src/agent/index.js";
import type { DailyBrief } from "../../src/brief/index.js";
import type { SourceItem } from "../../src/domain/index.js";
import { createAgentRunArtifact } from "../../src/storage/index.js";

describe("Source-grounding Repair Stage", () => {
  it("repairs audit findings once as a separate Agent stage before final audit", async () => {
    const artifact = createAgentRunArtifact({
      date: new Date("2026-05-28T07:00:00.000Z"),
      runId: "repair",
      modelRuntimeConfig: modelRuntimeConfig()
    });
    const inputBrief = brief();
    const sourceItems = [sourceItem("item-1", "Agent runtime"), sourceItem("item-2", "Agent skills")];

    const repaired = await runSourceGroundingRepairStage({
      brief: inputBrief,
      sourceItems,
      auditFindings: [
        {
          signalId: "signal:one",
          issue: "Narrative contains risky per-source mapping across multiple citations."
        }
      ],
      artifact,
      modelRuntimeConfig: modelRuntimeConfig()
    });

    expect(artifact.stages).toEqual([
      expect.objectContaining({ stage: "repair", status: "succeeded" })
    ]);
    expect(repaired.brief.signals[0]?.summary.whatItIs).toContain("共同表明");
    expect(repaired.brief.signals[0]?.summary.whatItIs).not.toContain("分别");
    await expect(
      runSourceGroundingAuditStage({
        brief: repaired.brief,
        sourceItems,
        artifact,
        modelRuntimeConfig: modelRuntimeConfig()
      })
    ).resolves.toMatchObject({ audit: { status: "passed" } });
  });
});

function brief(): DailyBrief {
  return {
    date: new Date("2026-05-28T07:00:00.000Z"),
    executiveSummary: "今天有 1 个 Source-grounded Signal。",
    sourceCoverage: { sourceCount: 1, sourceItemCount: 2, partialFailures: [] },
    signals: [
      {
        id: "signal:one",
        type: "architecture",
        title: "Agent runtime",
        focusAreas: ["Agent 架构"],
        directions: ["先进工具"],
        summary: {
          whatItIs: "item-1 与 item-2 分别指向 runtime 与 skills。",
          whatItIsNot: "不是成熟度背书。",
          minimalExample: "读 cited Source Item。"
        },
        whyItMatters: "它影响 Agent Architecture。",
        citations: [
          { sourceItemId: "item-1", sourceId: "source", title: "Agent runtime", url: "https://example.com" },
          { sourceItemId: "item-2", sourceId: "source", title: "Agent skills", url: "https://example.com/2" }
        ]
      }
    ]
  };
}

function sourceItem(id: string, title: string): SourceItem {
  return {
    id,
    sourceId: "source",
    platform: "blog",
    url: `https://example.com/${id}`,
    title,
    fetchedAt: "2026-05-28T07:00:00.000Z",
    analyzableText: `${title} notes.`,
    contentHash: `hash-${id}`
  };
}

function modelRuntimeConfig() {
  return { provider: "faux" as const, model: "faux-daily-brief-renderer", ready: true, issues: [] };
}
