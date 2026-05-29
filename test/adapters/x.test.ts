import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createXFetchAdapter } from "../../src/adapters/index.js";
import { generateDailyBrief } from "../../src/brief/index.js";

describe("X Fetch Adapter", () => {
  it("collects relevant X posts and filters reposts or irrelevant replies", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-x-"));
    const fixturePath = join(directory, "x-posts.json");

    try {
      await writeFile(
        fixturePath,
        JSON.stringify({
          posts: [
            {
              id: "1",
              url: "https://x.com/example/status/1",
              author: "example",
              createdAt: "2026-05-28T05:00:00.000Z",
              type: "original",
              text: "Agent Architecture note: durable tool execution needs explicit state boundaries."
            },
            {
              id: "2",
              url: "https://x.com/example/status/2",
              author: "example",
              type: "repost",
              text: "Agent runtime link with no added interpretation."
            },
            {
              id: "3",
              url: "https://x.com/example/status/3",
              author: "example",
              type: "reply",
              text: "Nice launch!"
            },
            {
              id: "4",
              url: "https://x.com/example/status/4",
              author: "example",
              type: "quote",
              text: "Original post context",
              addedText: "This Coding Agent workflow changes how repo maintenance gets reviewed."
            }
          ]
        }),
        "utf8"
      );

      const items = await createXFetchAdapter().fetch(
        {
          id: "x-agent-search",
          platform: "x",
          adapter: "x",
          target: fixturePath,
          enabled: true,
          notes: "Bounded Agent search"
        },
        { fetchedAt: new Date("2026-05-28T06:00:00.000Z") }
      );

      expect(items).toHaveLength(2);
      expect(items.map((item) => item.id)).toEqual(["x-agent-search:1", "x-agent-search:4"]);
      expect(items[0]).toMatchObject({
        sourceId: "x-agent-search",
        platform: "x",
        url: "https://x.com/example/status/1",
        author: "example",
        publishedAt: "2026-05-28T05:00:00.000Z",
        fetchedAt: "2026-05-28T06:00:00.000Z",
        metadata: {
          postType: "original",
          sourceTarget: fixturePath
        }
      });
      expect(items[1]?.analyzableText).toContain("Quoted context: Original post context");
      expect(generateDailyBrief({ date: new Date("2026-05-28T07:00:00.000Z"), sourceItems: items }).signals).toHaveLength(
        2
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("supports mocked remote account/list/search targets without live X network", async () => {
    const adapter = createXFetchAdapter({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            posts: [
              {
                id: "remote-1",
                url: "https://x.com/example/status/remote-1",
                author: "example",
                type: "original",
                text: "AI Coding evals for Coding Agent generated patches are getting sharper."
              }
            ]
          }),
          { status: 200 }
        )
    });

    const items = await adapter.fetch(
      {
        id: "x-account-example",
        platform: "x",
        adapter: "x",
        target: "https://x.example/mock/account/example",
        enabled: true,
        notes: "Mocked account target"
      },
      { fetchedAt: new Date("2026-05-28T06:00:00.000Z") }
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "x-account-example:remote-1",
      url: "https://x.com/example/status/remote-1",
      author: "example"
    });
  });
});
