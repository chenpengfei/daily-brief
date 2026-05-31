import { describe, expect, it } from "vitest";
import { AgentStageValidationError, parseAgentStageOutput, validateAgentStageOutput } from "../../src/agent/index.js";

describe("Agent stage contracts", () => {
  it("accepts valid structured stage output", () => {
    expect(
      validateAgentStageOutput(
        "understanding",
        {
          stage: "understanding",
          sourceItemAnnotations: [
            {
              sourceItemId: "item-1",
              claims: ["Agent runtime patterns"],
              summary: "A useful Agent Architecture note.",
              focusAreaRelevance: "strong",
              evidenceBoundary: "Only this source item is available.",
              relevance: "relevant",
              evidence: ["Agent runtime"],
              weakItemHints: []
            }
          ]
        },
        { sourceItemIds: ["item-1"] }
      )
    ).toMatchObject({ stage: "understanding" });
  });

  it("rejects invalid JSON with a structured validation error", () => {
    expect(() => parseAgentStageOutput("selection", "{nope")).toThrow(AgentStageValidationError);
    expect(() => parseAgentStageOutput("selection", "{nope")).toThrow("output must be valid JSON");
  });

  it("rejects missing fields and impossible references", () => {
    expect(() =>
      validateAgentStageOutput(
        "narrative",
        {
          stage: "narrative",
          signalNarratives: [
            {
              signalId: "signal:missing",
              whatItIs: "是什么",
              whatItIsNot: "不是什么",
              minimalExample: "最小例子",
              whyItMatters: "为什么重要"
            }
          ]
        },
        { signalIds: ["signal:known"] }
      )
    ).toThrow("signalId references unknown id: signal:missing");

    expect(() =>
      validateAgentStageOutput("ranking", {
        stage: "ranking",
        rankedSignals: [{ signalId: "signal:known", rank: 0 }]
      })
    ).toThrow("rankedSignals[0].rank must be a positive integer");
  });
});
