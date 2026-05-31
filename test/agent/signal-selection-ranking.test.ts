import { describe, expect, it } from "vitest";
import { mergeCandidateSignals, runSignalSelectionAndRankingStages } from "../../src/agent/index.js";
import { createAgentRunArtifact } from "../../src/storage/index.js";
import type { SourceItem } from "../../src/domain/index.js";
import type { UnderstandingStageOutput } from "../../src/agent/index.js";

describe("Signal Selection and Ranking stages", () => {
  it("returns candidate Signals and exclusion reasons from annotations", async () => {
    const artifact = createArtifact();
    const result = await runSignalSelectionAndRankingStages({
      sourceItems: [
        sourceItem({ id: "strong", title: "Agent runtime state" }),
        sourceItem({ id: "weak", title: "Image model launch", analyzableText: "Generic image model pricing." })
      ],
      annotations: [
        annotation({ sourceItemId: "strong", summary: "Agent runtime state matters." }),
        annotation({
          sourceItemId: "weak",
          relevance: "not_relevant",
          focusAreaRelevance: "none",
          weakItemHints: ["Outside Agent Architecture and AI Coding."]
        })
      ],
      artifact
    });

    expect(result.selection.candidateSignals).toHaveLength(1);
    expect(result.selection.excludedSourceItems).toEqual([
      { sourceItemId: "weak", reason: "Outside Agent Architecture and AI Coding." }
    ]);
    expect(result.signals[0]).toMatchObject({
      id: "signal:https://example.com/strong",
      citations: [{ sourceItemId: "strong" }]
    });
  });

  it("merges duplicate candidates while preserving citations and reasons", () => {
    expect(
      mergeCandidateSignals([
        {
          signalId: "signal:dup",
          title: "Duplicate",
          strength: "strong",
          sourceItemIds: ["item-1"],
          reason: "First reason"
        },
        {
          signalId: "signal:dup",
          title: "Duplicate again",
          strength: "weak",
          sourceItemIds: ["item-2"],
          reason: "Second reason"
        }
      ])
    ).toEqual([
      {
        signalId: "signal:dup",
        title: "Duplicate",
        strength: "strong",
        sourceItemIds: ["item-1", "item-2"],
        reason: "First reason / Second reason"
      }
    ]);
  });

  it("enforces maxSignals without padding weak candidates", async () => {
    const items = Array.from({ length: 7 }, (_, index) =>
      sourceItem({ id: `item-${index}`, url: `https://example.com/${index}` })
    );
    const annotations = items.map((item, index) =>
      annotation({
        sourceItemId: item.id,
        focusAreaRelevance: index === 6 ? "weak" : "strong",
        summary: `Signal ${index}`
      })
    );

    const result = await runSignalSelectionAndRankingStages({
      sourceItems: items,
      annotations,
      artifact: createArtifact(),
      maxSignals: 5
    });

    expect(result.ranking.rankedSignals).toHaveLength(5);
    expect(result.signals).toHaveLength(5);
    expect(result.signals.map((signal) => signal.id)).not.toContain("signal:https://example.com/6");
  });

  it("produces an Agent-driven low-signal result when no strong Signals exist", async () => {
    const result = await runSignalSelectionAndRankingStages({
      sourceItems: [sourceItem({ id: "weak", analyzableText: "Generic launch notes." })],
      annotations: [
        annotation({
          sourceItemId: "weak",
          relevance: "not_relevant",
          focusAreaRelevance: "none",
          weakItemHints: ["No strong Agent Architecture or AI Coding signal."]
        })
      ],
      artifact: createArtifact()
    });

    expect(result.selection.candidateSignals).toEqual([]);
    expect(result.ranking.rankedSignals).toEqual([]);
    expect(result.signals).toEqual([]);
  });

  it("records exclusions and ranking reasons in the artifact", async () => {
    const artifact = createArtifact();

    await runSignalSelectionAndRankingStages({
      sourceItems: [sourceItem({ id: "strong" }), sourceItem({ id: "weak", analyzableText: "Generic launch." })],
      annotations: [
        annotation({ sourceItemId: "strong", summary: "Strong Agent Architecture signal." }),
        annotation({ sourceItemId: "weak", relevance: "not_relevant", focusAreaRelevance: "none" })
      ],
      artifact
    });

    expect(artifact.stages.map((stage) => stage.stage)).toEqual(["selection", "ranking"]);
    expect(JSON.stringify(artifact)).toContain("Understanding Stage judged this Source Item too weak");
    expect(JSON.stringify(artifact)).toContain("Strong Agent Architecture signal.");
  });
});

function createArtifact() {
  return createAgentRunArtifact({
    date: new Date("2026-05-28T07:00:00.000Z"),
    runId: "selection-ranking",
    modelRuntimeConfig: {
      provider: "faux",
      model: "faux-daily-brief-renderer",
      ready: true,
      issues: []
    }
  });
}

function annotation(
  overrides: Partial<UnderstandingStageOutput["sourceItemAnnotations"][number]> = {}
): UnderstandingStageOutput["sourceItemAnnotations"][number] {
  return {
    sourceItemId: "strong",
    claims: ["Agent Architecture claim"],
    summary: "Agent Architecture signal.",
    focusAreaRelevance: "strong",
    evidenceBoundary: "Only this source item.",
    relevance: "relevant",
    evidence: ["Agent Architecture"],
    weakItemHints: [],
    ...overrides
  };
}

function sourceItem(overrides: Partial<SourceItem> = {}): SourceItem {
  return {
    id: "strong",
    sourceId: "source",
    platform: "blog",
    url: `https://example.com/${overrides.id ?? "strong"}`,
    title: "Agent runtime state",
    fetchedAt: "2026-05-28T07:00:00.000Z",
    analyzableText: "Agent Architecture notes about state and tool execution.",
    contentHash: "hash",
    ...overrides
  };
}
