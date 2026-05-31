import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  AgentStageValidationError,
  batchSourceItems,
  runAgentStage,
  runSourceItemUnderstandingStage
} from "../../src/agent/index.js";
import { createAgentRunArtifact, writeAgentRunArtifact } from "../../src/storage/index.js";
import type { SourceItem } from "../../src/domain/index.js";

describe("Source Item Understanding Stage", () => {
  it("produces one validated annotation per Source Item through the faux Pi provider", async () => {
    const artifact = createArtifact();
    const items = [
      sourceItem({
        id: "item-1",
        title: "Agent runtime patterns",
        analyzableText: "Agent Architecture notes about durable tool execution."
      }),
      sourceItem({
        id: "item-2",
        title: "Generic launch",
        analyzableText: "A generic product launch without coding agent details."
      })
    ];

    const result = await runSourceItemUnderstandingStage({
      sourceItems: items,
      modelRuntimeConfig: fauxModelRuntimeConfig(),
      artifact
    });

    expect(result.annotations.map((annotation) => annotation.sourceItemId)).toEqual(["item-1", "item-2"]);
    expect(result.annotations[0]).toMatchObject({
      relevance: "relevant",
      focusAreaRelevance: "strong",
      weakItemHints: []
    });
    expect(artifact.stages[0]).toMatchObject({
      stage: "understanding",
      status: "succeeded",
      inputRefs: { sourceItemIds: ["item-1", "item-2"], batch: { index: 1, total: 1 } }
    });
  });

  it("splits oversized inputs into deterministic batches and merges annotations", async () => {
    const artifact = createArtifact();
    const items = [
      sourceItem({ id: "item-1", analyzableText: "Agent Architecture ".repeat(10) }),
      sourceItem({ id: "item-2", analyzableText: "AI Coding ".repeat(10) }),
      sourceItem({ id: "item-3", analyzableText: "Tool execution ".repeat(10) })
    ];

    expect(batchSourceItems(items, 140)).toHaveLength(3);

    const result = await runSourceItemUnderstandingStage({
      sourceItems: items,
      modelRuntimeConfig: fauxModelRuntimeConfig(),
      artifact,
      maxBatchCharacters: 140
    });

    expect(result.batchCount).toBe(3);
    expect(result.annotations).toHaveLength(3);
    expect(artifact.stages.map((stage) => stage.inputRefs.batch)).toEqual([
      { index: 1, total: 3 },
      { index: 2, total: 3 },
      { index: 3, total: 3 }
    ]);
  });

  it("fails validation when an annotation references an unknown Source Item id", async () => {
    const artifact = createArtifact();

    await expect(
      runAgentStage({
        stage: "understanding",
        artifact,
        validationContext: { sourceItemIds: ["known-item"] },
        execute: async () => ({
          stage: "understanding",
          sourceItemAnnotations: [
            {
              sourceItemId: "unknown-item",
              claims: ["Claim"],
              summary: "Summary",
              focusAreaRelevance: "partial",
              evidenceBoundary: "Boundary",
              relevance: "uncertain",
              evidence: ["Evidence"],
              weakItemHints: []
            }
          ]
        })
      })
    ).rejects.toThrow(AgentStageValidationError);
  });

  it("records batch metadata and structured annotation output without raw prompt text", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-understanding-"));
    const date = new Date("2026-05-28T07:00:00.000Z");
    const artifact = createArtifact({ date, runId: "understanding-run" });

    try {
      await runSourceItemUnderstandingStage({
        sourceItems: [
          sourceItem({
            id: "item-1",
            title: "Agent runtime patterns",
            analyzableText: "Agent Architecture notes about durable tool execution."
          })
        ],
        modelRuntimeConfig: fauxModelRuntimeConfig(),
        artifact
      });
      const written = await writeAgentRunArtifact(artifact, date, directory);
      const serialized = await readFile(written.path, "utf8");

      expect(JSON.parse(serialized)).toMatchObject({
        stages: [
          {
            stage: "understanding",
            inputRefs: { sourceItemIds: ["item-1"], batch: { index: 1, total: 1 } },
            output: { sourceItemAnnotations: [{ sourceItemId: "item-1" }] }
          }
        ]
      });
      expect(serialized).not.toContain("请为每个 Source Item");
      expect(serialized).not.toContain("transcript");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function createArtifact(input: { date?: Date; runId?: string } = {}) {
  return createAgentRunArtifact({
    date: input.date ?? new Date("2026-05-28T07:00:00.000Z"),
    runId: input.runId ?? "understanding-artifact",
    modelRuntimeConfig: fauxModelRuntimeConfig()
  });
}

function fauxModelRuntimeConfig() {
  return {
    provider: "faux" as const,
    model: "faux-daily-brief-renderer",
    ready: true,
    issues: []
  };
}

function sourceItem(overrides: Partial<SourceItem> = {}): SourceItem {
  return {
    id: "item",
    sourceId: "source",
    platform: "blog",
    url: "https://example.com/item",
    title: "Source Item",
    fetchedAt: "2026-05-28T07:00:00.000Z",
    analyzableText: "Agent Architecture notes.",
    contentHash: "hash",
    ...overrides
  };
}
