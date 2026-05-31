import { describe, expect, it } from "vitest";
import { enrichDailyBriefNarrativeWithAgent, validateAgentStageOutput } from "../../src/agent/index.js";
import type { DailyBrief } from "../../src/brief/index.js";
import type { SourceItem } from "../../src/domain/index.js";

describe("Signal Narrative Stage", () => {
  it("generates executive summary, lens fields, and narrative fields through the faux provider", async () => {
    const result = await enrichDailyBriefNarrativeWithAgent({
      brief: brief(),
      sourceItems: [sourceItem()],
      modelRuntimeConfig: { provider: "faux", model: "faux-daily-brief-renderer", ready: true, issues: [] }
    });

    expect(result.brief.executiveSummary).toContain("Agent-generated Signals");
    expect(result.brief.signals[0]).toMatchObject({
      focusAreas: ["Agent 架构"],
      directions: ["先进工具"],
      summary: { whatItIs: expect.stringContaining("Agent Architecture") },
      whyItMatters: expect.stringContaining("Agent runtime")
    });
  });

  it("accepts multi-valued focus areas and directions in narrative schema validation", () => {
    expect(() =>
      validateAgentStageOutput("narrative", {
        stage: "narrative",
        executiveSummary: "今天有一个 Signal。",
        signalNarratives: [
          {
            signalId: "signal:one",
            focusAreas: ["Agent 架构", "AI Coding"],
            directions: ["先进工具", "持续学习", "人与 Agent 的边界"],
            whatItIs: "是什么",
            whatItIsNot: "不是什么",
            minimalExample: "最小例子",
            whyItMatters: "为什么重要"
          }
        ]
      })
    ).not.toThrow();
  });

  it("generates a low-signal Executive Summary without unsupported filler", async () => {
    const result = await enrichDailyBriefNarrativeWithAgent({
      brief: { ...brief(), executiveSummary: "placeholder", signals: [] },
      sourceItems: [],
      modelRuntimeConfig: { provider: "faux", model: "faux-daily-brief-renderer", ready: true, issues: [] }
    });

    expect(result.brief.executiveSummary).toContain("low-signal day");
    expect(result.brief.signals).toEqual([]);
    expect(result.events).toContain("signal_narrative:agent_start");
  });

});

function brief(): DailyBrief {
  return {
    date: new Date("2026-05-28T07:00:00.000Z"),
    executiveSummary: "placeholder",
    sourceCoverage: { sourceCount: 1, sourceItemCount: 1, partialFailures: [] },
    signals: [
      {
        id: "signal:one",
        type: "architecture",
        title: "Agent runtime",
        summary: {
          whatItIs: "fallback",
          whatItIsNot: "fallback",
          minimalExample: "fallback"
        },
        whyItMatters: "fallback",
        citations: [{ sourceItemId: "item-1", sourceId: "source", title: "Agent runtime", url: "https://example.com" }]
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
    analyzableText: "Agent Architecture notes about tool execution.",
    contentHash: "hash"
  };
}
