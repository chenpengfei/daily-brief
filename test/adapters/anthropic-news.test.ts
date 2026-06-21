import { describe, expect, it } from "vitest";
import { createAnthropicNewsFetchAdapter } from "../../src/adapters/index.js";

describe("Anthropic News Fetch Adapter", () => {
  it("turns Anthropic Newsroom article links into Source Items", async () => {
    const adapter = createAnthropicNewsFetchAdapter({
      fetchImpl: async () =>
        new Response(
          [
            "<main>",
            "  <a href=\"/news/services-track-partner-hub\" class=\"listItem\">",
            "    <time>Jun 3, 2026</time>",
            "    <span class=\"subject\">Announcements</span>",
            "    <span class=\"title\">Introducing the Services Track and Partner Hub of the Claude Partner Network</span>",
            "  </a>",
            "  <a href=\"/news/claude-opus-4-8\">",
            "    <span>Product</span><time>May 28, 2026</time>",
            "    <h2>Introducing Claude Opus 4.8</h2>",
            "    <p>An upgrade to our Opus class of models.</p>",
            "  </a>",
            "</main>"
          ].join("\n"),
          { status: 200 }
        )
    });

    const items = await adapter.fetch(
      {
        id: "anthropic-news",
        platform: "anthropic",
        adapter: "anthropic-news",
        target: "https://www.anthropic.com/news",
        enabled: true,
        notes: "Official Anthropic Newsroom"
      },
      { fetchedAt: new Date("2026-06-07T06:00:00.000Z") }
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      sourceId: "anthropic-news",
      platform: "anthropic",
      url: "https://www.anthropic.com/news/services-track-partner-hub",
      title: "Introducing the Services Track and Partner Hub of the Claude Partner Network",
      author: "Anthropic",
      publishedAt: "2026-06-03T00:00:00.000Z",
      metadata: {
        sourcePage: "https://www.anthropic.com/news",
        sourceKind: "News",
        articleCategory: "Announcements"
      }
    });
    expect(items[0]?.id).toMatch(/^anthropic-news:[a-f0-9]{16}$/);
    expect(items[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(items[1]?.analyzableText).toContain("An upgrade to our Opus class of models.");
  });

  it("turns Anthropic Engineering article links into Source Items", async () => {
    const adapter = createAnthropicNewsFetchAdapter({
      fetchImpl: async () =>
        new Response(
          [
            "<section>",
            "  <article><a href=\"/engineering/april-23-postmortem\">",
            "    <h3>An update on recent Claude Code quality reports</h3>",
            "    <div class=\"date\">Apr 23, 2026</div>",
            "  </a></article>",
            "  <article><a href=\"/engineering/building-effective-agents\">",
            "    <img alt=\"Building effective agents\" />",
            "    <div>Dec 19, 2024</div>",
            "  </a></article>",
            "</section>"
          ].join("\n"),
          { status: 200 }
        )
    });

    const items = await adapter.fetch(
      {
        id: "anthropic-engineering",
        platform: "anthropic",
        adapter: "anthropic-news",
        target: "https://www.anthropic.com/engineering",
        enabled: true,
        notes: "Official Anthropic Engineering page"
      },
      { fetchedAt: new Date("2026-06-07T06:00:00.000Z") }
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      sourceId: "anthropic-engineering",
      url: "https://www.anthropic.com/engineering/april-23-postmortem",
      title: "An update on recent Claude Code quality reports",
      publishedAt: "2026-04-23T00:00:00.000Z",
      metadata: {
        sourceKind: "Engineering"
      }
    });
    expect(items[0]?.analyzableText).toContain("Official Anthropic Engineering article");
  });
});
