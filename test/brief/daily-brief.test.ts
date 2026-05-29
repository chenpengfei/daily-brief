import { describe, expect, it } from "vitest";
import { generateDailyBrief, renderDailyBriefMarkdown } from "../../src/brief/index.js";
import type { SourceItem } from "../../src/domain/index.js";

describe("Daily Brief generation", () => {
  it("selects relevant Source Items as cited Top Signals", () => {
    const brief = generateDailyBrief({
      date: new Date("2026-05-28T07:00:00.000Z"),
      sourceItems: [
        sourceItem({
          id: "blog:item-1",
          title: "Agent runtime state management",
          analyzableText: "A concrete Agent Architecture note about state, tool execution, and event streaming."
        })
      ]
    });

    expect(brief.signals).toEqual([
      {
        id: "signal:https://example.com/agent-runtime",
        type: "architecture",
        title: "Agent runtime state management",
        whyItMatters: "它提供了 Agent Architecture 的具体实现或设计线索，值得进一步阅读原文。",
        citations: [
          {
            sourceItemId: "blog:item-1",
            sourceId: "blog",
            title: "Agent runtime state management",
            url: "https://example.com/agent-runtime"
          }
        ]
      }
    ]);
  });

  it("merges duplicate mentions into one multi-citation Signal", () => {
    const brief = generateDailyBrief({
      date: new Date("2026-05-28T07:00:00.000Z"),
      sourceItems: [
        sourceItem({ id: "blog:item-1", sourceId: "blog" }),
        sourceItem({ id: "x:item-1", sourceId: "x" })
      ]
    });

    expect(brief.signals).toHaveLength(1);
    expect(brief.signals[0]?.citations.map((citation) => citation.sourceItemId)).toEqual([
      "blog:item-1",
      "x:item-1"
    ]);
  });

  it("keeps unsupported or irrelevant claims out of the Brief", () => {
    const brief = generateDailyBrief({
      date: new Date("2026-05-28T07:00:00.000Z"),
      sourceItems: [
        sourceItem({
          id: "model-hype",
          title: "A new image model launches",
          analyzableText: "A generic launch announcement about image generation quality and pricing."
        })
      ]
    });

    expect(brief.signals).toHaveLength(0);
    expect(brief.executiveSummary).toContain("low-signal day");
  });

  it("keeps historical GitHub sponsor links out of the Brief", () => {
    const brief = generateDailyBrief({
      date: new Date("2026-05-28T07:00:00.000Z"),
      sourceItems: [
        sourceItem({
          id: "github-trending:sponsor",
          sourceId: "github-trending-daily",
          platform: "github",
          title: "sponsors/affaan-m",
          url: "https://github.com/sponsors/affaan-m",
          analyzableText:
            "Sponsor Star affaan-m / ECC The agent harness performance optimization system with memory and security."
        }),
        sourceItem({
          id: "github-trending:repo",
          sourceId: "github-trending-daily",
          platform: "github",
          title: "affaan-m/ECC",
          url: "https://github.com/affaan-m/ECC",
          analyzableText: "The agent harness performance optimization system with memory and security."
        })
      ]
    });

    expect(brief.signals.map((signal) => signal.title)).toEqual(["affaan-m/ECC"]);
    expect(brief.signals[0]?.citations.map((citation) => citation.url)).toEqual(["https://github.com/affaan-m/ECC"]);
  });

  it("renders the MVP four-section Markdown template", () => {
    const brief = generateDailyBrief({
      date: new Date("2026-05-28T07:00:00.000Z"),
      sourceItems: [sourceItem({ id: "blog:item-1" })],
      partialFailures: ["x-search rate limited"]
    });
    const markdown = renderDailyBriefMarkdown(brief);

    expect(markdown).toContain("# Daily Brief - 2026-05-28");
    expect(markdown).toContain("## Executive Summary");
    expect(markdown).toContain("## Top Signals");
    expect(markdown).toContain("## Source Coverage");
    expect(markdown).toContain("## Sources");
    expect(markdown).toContain("Partial failures: x-search rate limited");
    expect(markdown).toContain("- blog:item-1: [Agent runtime state management](https://example.com/agent-runtime)");
    expect(markdown).toContain("- why_it_matters: 它提供了 Agent Architecture");
  });

  it("classifies all MVP Signal Types without creating separate sections", () => {
    const brief = generateDailyBrief({
      date: new Date("2026-05-28T07:00:00.000Z"),
      sourceItems: [
        sourceItem({
          id: "architecture:item",
          title: "Agent runtime state management",
          url: "https://example.com/architecture",
          analyzableText: "Agent Architecture note about state and tool execution."
        }),
        sourceItem({
          id: "ai-coding:item",
          title: "Coding Agent review workflow",
          url: "https://example.com/ai-coding",
          analyzableText: "AI Coding workflow for repository maintenance."
        }),
        sourceItem({
          id: "tool-repo:item",
          sourceId: "github",
          platform: "github",
          title: "example/agent-runtime",
          url: "https://github.com/example/agent-runtime",
          analyzableText: "Agent runtime tool repo with durable tool execution."
        }),
        sourceItem({
          id: "risk:item",
          title: "Agent memory security risk",
          url: "https://example.com/risk",
          analyzableText: "Agent Architecture memory security risk in tool execution."
        })
      ]
    });
    const markdown = renderDailyBriefMarkdown(brief);

    expect(brief.signals.map((signal) => signal.type)).toEqual([
      "architecture",
      "ai-coding",
      "tool-repo",
      "risk"
    ]);
    expect(markdown.match(/^## .+$/gm)).toEqual([
      "## Executive Summary",
      "## Top Signals",
      "## Source Coverage",
      "## Sources"
    ]);
  });
});

function sourceItem(overrides: Partial<SourceItem> = {}): SourceItem {
  return {
    id: "blog:item-1",
    sourceId: "blog",
    platform: "blog",
    url: "https://example.com/agent-runtime",
    title: "Agent runtime state management",
    author: "Example Author",
    publishedAt: "2026-05-28T05:00:00.000Z",
    fetchedAt: "2026-05-28T06:00:00.000Z",
    analyzableText: "A concrete Agent Architecture note about state, tool execution, and event streaming.",
    contentHash: "a".repeat(64),
    ...overrides
  };
}
