import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createRssFetchAdapter } from "../../src/adapters/index.js";
import { generateDailyBrief } from "../../src/brief/index.js";

describe("RSS Fetch Adapter", () => {
  it("turns RSS feed entries into Source Items", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-rss-"));
    const feedPath = join(directory, "feed.xml");

    try {
      await writeFile(
        feedPath,
        [
          "<?xml version=\"1.0\"?>",
          "<rss version=\"2.0\">",
          "  <channel>",
          "    <title>Example Blog</title>",
          "    <item>",
          "      <title>Agent runtime patterns</title>",
          "      <link>https://example.com/agent-runtime-patterns</link>",
          "      <author>author@example.com</author>",
          "      <pubDate>Thu, 28 May 2026 05:00:00 GMT</pubDate>",
          "      <description><![CDATA[<p>Agent Architecture notes about tool execution and state.</p>]]></description>",
          "    </item>",
          "  </channel>",
          "</rss>"
        ].join("\n"),
        "utf8"
      );

      const items = await createRssFetchAdapter().fetch(
        {
          id: "example-blog",
          platform: "blog",
          adapter: "rss",
          target: feedPath,
          enabled: true,
          notes: "Example feed"
        },
        { fetchedAt: new Date("2026-05-28T06:00:00.000Z") }
      );

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        sourceId: "example-blog",
        platform: "blog",
        url: "https://example.com/agent-runtime-patterns",
        title: "Agent runtime patterns",
        author: "author@example.com",
        publishedAt: "2026-05-28T05:00:00.000Z",
        fetchedAt: "2026-05-28T06:00:00.000Z",
        analyzableText: "Agent Architecture notes about tool execution and state."
      });
      expect(items[0]?.id).toMatch(/^example-blog:[a-f0-9]{16}$/);
      expect(items[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(generateDailyBrief({ date: new Date("2026-05-28T07:00:00.000Z"), sourceItems: items }).signals).toHaveLength(
        1
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("turns Atom entries into Source Items", async () => {
    const adapter = createRssFetchAdapter({
      fetchImpl: async () =>
        new Response(
          [
            "<?xml version=\"1.0\"?>",
            "<feed xmlns=\"http://www.w3.org/2005/Atom\">",
            "  <entry>",
            "    <title>Coding Agent workflow lessons</title>",
            "    <link href=\"https://example.com/coding-agent-workflow\" rel=\"alternate\" />",
            "    <author><name>Example Author</name></author>",
            "    <updated>2026-05-28T05:30:00Z</updated>",
            "    <summary>AI Coding practices for repository maintenance.</summary>",
            "  </entry>",
            "</feed>"
          ].join("\n"),
          { status: 200 }
        )
    });

    const items = await adapter.fetch(
      {
        id: "atom-blog",
        platform: "blog",
        adapter: "rss",
        target: "https://example.com/feed.xml",
        enabled: true,
        notes: "Atom feed"
      },
      { fetchedAt: new Date("2026-05-28T06:00:00.000Z") }
    );

    expect(items[0]).toMatchObject({
      sourceId: "atom-blog",
      url: "https://example.com/coding-agent-workflow",
      title: "Coding Agent workflow lessons",
      author: "Example Author",
      publishedAt: "2026-05-28T05:30:00.000Z",
      analyzableText: "AI Coding practices for repository maintenance."
    });
  });
});
