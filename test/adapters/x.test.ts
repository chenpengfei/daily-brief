import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createXFetchAdapter, parseXProfileTarget } from "../../src/adapters/index.js";
import { generateDailyBrief } from "../../src/brief/index.js";
import { putCredential } from "../../src/config/index.js";

describe("X Fetch Adapter", () => {
  it("collects fixture X posts and filters reposts", async () => {
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

      expect(items).toHaveLength(3);
      expect(items.map((item) => item.id)).toEqual(["x-agent-search:1", "x-agent-search:3", "x-agent-search:4"]);
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
      expect(items[2]?.analyzableText).toContain("Referenced X context: Original post context");
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

  it("parses supported profile targets and rejects unsupported X targets clearly", () => {
    expect(parseXProfileTarget("https://x.com/karpathy")).toBe("karpathy");
    expect(parseXProfileTarget("https://twitter.com/karpathy")).toBe("karpathy");
    expect(parseXProfileTarget("@karpathy")).toBe("karpathy");
    expect(parseXProfileTarget("karpathy")).toBe("karpathy");

    expect(() => parseXProfileTarget("https://x.com/search?q=agents")).toThrow("search targets are not supported");
    expect(() => parseXProfileTarget("https://x.com/i/lists/123")).toThrow("list targets are not supported");
    expect(() => parseXProfileTarget("https://x.com/karpathy/status/123")).toThrow("status targets are not supported");
    expect(() => parseXProfileTarget("bad handle!")).toThrow("Unsupported X target");
  });

  it("uses x.default Bearer Token to fetch profile posts through X API v2", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-x-api-"));
    const authPath = join(directory, "auth.json");
    const requests: Array<{ url: URL; authorization: string | undefined }> = [];

    try {
      putCredential("x.default", { type: "api-key", provider: "x", apiKey: "secret-x-token" }, authPath);
      const adapter = createXFetchAdapter({
        authPath,
        fetchImpl: async (input, init) => {
          const url = new URL(String(input));
          const headers = new Headers(init?.headers);
          requests.push({ url, authorization: headers.get("authorization") ?? undefined });

          if (url.pathname === "/2/users/by/username/karpathy") {
            return jsonResponse({
              data: {
                id: "user-1",
                username: "karpathy",
                name: "Andrej Karpathy"
              }
            });
          }

          if (url.pathname === "/2/users/user-1/tweets") {
            return jsonResponse({
              data: [
                {
                  id: "100",
                  text: "Agent Architecture note from the author.",
                  author_id: "user-1",
                  created_at: "2026-06-12T05:00:00.000Z",
                  public_metrics: { retweet_count: 2 }
                },
                {
                  id: "101",
                  text: "My take: coding agents need better review loops.",
                  author_id: "user-1",
                  created_at: "2026-06-12T05:10:00.000Z",
                  referenced_tweets: [{ type: "quoted", id: "900" }]
                },
                {
                  id: "102",
                  text: "I think this points to eval boundaries.",
                  author_id: "user-1",
                  created_at: "2026-06-12T05:20:00.000Z",
                  referenced_tweets: [{ type: "replied_to", id: "901" }]
                },
                {
                  id: "103",
                  text: "RT @someone: repost without added interpretation",
                  author_id: "user-1",
                  referenced_tweets: [{ type: "retweeted", id: "902" }]
                }
              ],
              includes: {
                tweets: [
                  { id: "900", text: "Original quoted context", author_id: "user-2" },
                  { id: "901", text: "Original reply context", author_id: "user-3" },
                  { id: "902", text: "Reposted context", author_id: "user-4" }
                ],
                users: [
                  { id: "user-2", username: "quoted_author" },
                  { id: "user-3", username: "reply_author" },
                  { id: "user-4", username: "repost_author" }
                ]
              }
            });
          }

          throw new Error(`Unexpected request: ${url.toString()}`);
        }
      });

      const items = await adapter.fetch(
        {
          id: "x-karpathy",
          platform: "x",
          adapter: "x",
          target: "https://x.com/karpathy",
          enabled: true,
          notes: "X profile"
        },
        { fetchedAt: new Date("2026-06-12T06:00:00.000Z") }
      );

      expect(requests).toHaveLength(2);
      expect(requests.map((request) => request.authorization)).toEqual(["Bearer secret-x-token", "Bearer secret-x-token"]);
      expect(requests[0]?.url.pathname).toBe("/2/users/by/username/karpathy");
      expect(requests[0]?.url.searchParams.get("user.fields")).toContain("username");
      expect(requests[1]?.url.pathname).toBe("/2/users/user-1/tweets");
      expect(requests[1]?.url.searchParams.get("exclude")).toBe("retweets");
      expect(requests[1]?.url.searchParams.get("expansions")).toContain("referenced_tweets.id");

      expect(items.map((item) => item.id)).toEqual(["x-karpathy:100", "x-karpathy:101", "x-karpathy:102"]);
      expect(items[0]).toMatchObject({
        sourceId: "x-karpathy",
        platform: "x",
        url: "https://x.com/karpathy/status/100",
        author: "@karpathy",
        publishedAt: "2026-06-12T05:00:00.000Z",
        fetchedAt: "2026-06-12T06:00:00.000Z",
        metadata: {
          postType: "original",
          xPostId: "100",
          xUserId: "user-1",
          username: "karpathy",
          profileUrl: "https://x.com/karpathy",
          publicMetrics: { retweet_count: 2 }
        }
      });
      expect(items[1]?.metadata).toMatchObject({
        postType: "quote",
        referencedTweets: [
          {
            id: "900",
            type: "quoted",
            text: "Original quoted context",
            url: "https://x.com/quoted_author/status/900",
            author: "@quoted_author"
          }
        ]
      });
      expect(items[1]?.analyzableText).toContain("My take: coding agents need better review loops.");
      expect(items[1]?.analyzableText).toContain("quoted: Original quoted context");
      expect(items[2]?.metadata).toMatchObject({ postType: "reply" });
      expect(JSON.stringify(items)).not.toContain("secret-x-token");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails clearly when x.default is missing or not an X API key credential", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-x-credential-"));
    const authPath = join(directory, "auth.json");
    const source = {
      id: "x-karpathy",
      platform: "x",
      adapter: "x",
      target: "@karpathy",
      enabled: true,
      notes: "X profile"
    };
    const context = { fetchedAt: new Date("2026-06-12T06:00:00.000Z") };

    try {
      await expect(createXFetchAdapter({ authPath }).fetch(source, context)).rejects.toThrow(
        'X API credential x.default is missing from auth.json; store an api-key credential with provider "x".'
      );

      putCredential("x.default", { type: "api-key", provider: "openai", apiKey: "secret-openai-token" }, authPath);

      await expect(createXFetchAdapter({ authPath }).fetch(source, context)).rejects.toThrow(
        'X API credential x.default must be an api-key credential with provider "x".'
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
