import { describe, expect, it } from "vitest";
import { createOpenAiNewsFetchAdapter } from "../../src/adapters/index.js";

describe("OpenAI News Fetch Adapter", () => {
  it("turns OpenAI News category page article links into Source Items", async () => {
    const adapter = createOpenAiNewsFetchAdapter({
      fetchImpl: async () =>
        new Response(
          [
            "<main>",
            "  <a href=\"/news/product-releases/\">Product category</a>",
            "  <a href=\"/news/codex-for-every-role-tool-and-workflow/\" aria-label=\"Codex for every role, tool, and workflow Product Jun 2, 2026\">Codex for every role, tool, and workflow</a>",
            "  <a href=\"/news/openai-frontier-models-and-codex-are-now-available-on-aws/\">OpenAI frontier models and Codex are now available on AWS Product Jun 1, 2026</a>",
            "  <a href=\"/news/product-releases/?filter=product\">Filter</a>",
            "  <a href=\"/news/codex-for-every-role-tool-and-workflow/\" aria-label=\"Codex for every role, tool, and workflow Product Jun 2, 2026\">Duplicate card</a>",
            "</main>"
          ].join("\n"),
          { status: 200 }
        )
    });

    const items = await adapter.fetch(
      {
        id: "openai-news-product-releases",
        platform: "openai-news",
        adapter: "openai-news",
        target: "https://openai.com/news/product-releases/",
        enabled: true,
        notes: "Official OpenAI Product News page"
      },
      { fetchedAt: new Date("2026-06-07T06:00:00.000Z") }
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "openai-news-product-releases:ecf09753a13950db",
      sourceId: "openai-news-product-releases",
      platform: "openai-news",
      url: "https://openai.com/news/codex-for-every-role-tool-and-workflow/",
      title: "Codex for every role, tool, and workflow",
      author: "OpenAI",
      publishedAt: "2026-06-02T00:00:00.000Z",
      fetchedAt: "2026-06-07T06:00:00.000Z",
      metadata: {
        sourcePage: "https://openai.com/news/product-releases/",
        pageCategory: "Product Releases",
        articleCategory: "Product"
      }
    });
    expect(items[0]?.analyzableText).toContain("Official OpenAI News article: Codex for every role, tool, and workflow.");
    expect(items[0]?.analyzableText).toContain("Listed on the OpenAI Product Releases News page.");
    expect(items[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("records fetch failures with a clear adapter-specific status", async () => {
    const adapter = createOpenAiNewsFetchAdapter({
      fetchImpl: async () => new Response("not found", { status: 404 })
    });

    await expect(
      adapter.fetch(
        {
          id: "openai-news-safety",
          platform: "openai-news",
          adapter: "openai-news",
          target: "https://openai.com/news/safety/",
          enabled: true,
          notes: "Official OpenAI Safety News page"
        },
        { fetchedAt: new Date("2026-06-07T06:00:00.000Z") }
      )
    ).rejects.toThrow("OpenAI News target returned 404");
  });

  it("falls back to official OpenAI RSS when a News category page returns 403", async () => {
    const adapter = createOpenAiNewsFetchAdapter({
      fetchImpl: async (target) => {
        if (String(target).endsWith("/news/rss.xml")) {
          return new Response(
            [
              "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
              "<rss version=\"2.0\">",
              "  <channel>",
              "    <item>",
              "      <title><![CDATA[Building self-improving tax agents with Codex]]></title>",
              "      <description><![CDATA[Engineering notes about Codex agents.]]></description>",
              "      <link>https://openai.com/index/building-self-improving-tax-agents-with-codex</link>",
              "      <category><![CDATA[Engineering]]></category>",
              "      <pubDate>Wed, 27 May 2026 12:00:00 GMT</pubDate>",
              "    </item>",
              "    <item>",
              "      <title><![CDATA[Codex for every role, tool, and workflow]]></title>",
              "      <description><![CDATA[Product update.]]></description>",
              "      <link>https://openai.com/index/codex-for-every-role-tool-and-workflow</link>",
              "      <category><![CDATA[Product]]></category>",
              "      <pubDate>Tue, 02 Jun 2026 12:00:00 GMT</pubDate>",
              "    </item>",
              "  </channel>",
              "</rss>"
            ].join("\n"),
            { status: 200 }
          );
        }

        return new Response("forbidden", { status: 403 });
      }
    });

    const items = await adapter.fetch(
      {
        id: "openai-news-engineering",
        platform: "openai-news",
        adapter: "openai-news",
        target: "https://openai.com/news/engineering/",
        enabled: true,
        notes: "Official OpenAI Engineering News page"
      },
      { fetchedAt: new Date("2026-06-07T06:00:00.000Z") }
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Building self-improving tax agents with Codex",
      url: "https://openai.com/index/building-self-improving-tax-agents-with-codex",
      publishedAt: "2026-05-27T12:00:00.000Z",
      metadata: {
        sourcePage: "https://openai.com/news/engineering/",
        pageCategory: "Engineering",
        articleCategory: "Engineering"
      }
    });
    expect(items[0]?.analyzableText).toContain("Engineering notes about Codex agents.");
  });
});
