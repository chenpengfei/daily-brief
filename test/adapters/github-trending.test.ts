import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createGitHubTrendingFetchAdapter } from "../../src/adapters/index.js";
import { generateDailyBrief } from "../../src/brief/index.js";

describe("GitHub Trending Fetch Adapter", () => {
  it("turns GitHub search fixture repositories into trend Source Items", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-github-"));
    const fixturePath = join(directory, "github-search.json");

    try {
      await writeFile(
        fixturePath,
        JSON.stringify({
          items: [
            {
              full_name: "example/agent-runtime",
              html_url: "https://github.com/example/agent-runtime",
              description: "Agent runtime toolkit for durable tool execution",
              owner: { login: "example" },
              stargazers_count: 2400,
              forks_count: 120,
              watchers_count: 2400,
              previous_stargazers_count: 2100,
              pushed_at: "2026-05-28T04:00:00Z"
            }
          ]
        }),
        "utf8"
      );

      const items = await createGitHubTrendingFetchAdapter().fetch(
        {
          id: "github-agent-trending",
          platform: "github",
          adapter: "github-trending",
          target: fixturePath,
          enabled: true,
          notes: "Agent-related GitHub projects gaining attention"
        },
        { fetchedAt: new Date("2026-05-28T06:00:00.000Z") }
      );

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        sourceId: "github-agent-trending",
        platform: "github",
        url: "https://github.com/example/agent-runtime",
        title: "example/agent-runtime",
        author: "example",
        publishedAt: "2026-05-28T04:00:00Z",
        fetchedAt: "2026-05-28T06:00:00.000Z",
        metadata: {
          repoName: "example/agent-runtime",
          stars: 2400,
          forks: 120,
          watchers: 2400,
          previousStars: 2100
        }
      });
      expect(items[0]?.analyzableText).toContain("Metrics: 2400 stars, 120 forks, 2400 watchers.");
      expect(items[0]?.analyzableText).toContain("Momentum: +300 stars since previous collection.");
      expect(items[0]?.analyzableText).toContain("Ordinary commits are not treated as Source Items");
      expect(generateDailyBrief({ date: new Date("2026-05-28T07:00:00.000Z"), sourceItems: items }).signals[0]).toMatchObject({
        type: "tool-repo"
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("can parse mocked GitHub trending HTML without live network", async () => {
    const adapter = createGitHubTrendingFetchAdapter({
      fetchImpl: async () =>
        new Response(
          [
            "<article>",
            "  <h2><a href=\"/example/coding-agent-tool\">example / coding-agent-tool</a></h2>",
            "  <p>AI Coding tool repo for agent workflows.</p>",
            "  <a aria-label=\"1,500 stars\"></a>",
            "  <a aria-label=\"80 forks\"></a>",
            "  <span>42 stars today</span>",
            "</article>"
          ].join("\n"),
          { status: 200 }
        )
    });

    const items = await adapter.fetch(
      {
        id: "github-trending-page",
        platform: "github",
        adapter: "github-trending",
        target: "https://github.com/trending/typescript?since=daily",
        enabled: true,
        notes: "Trending page"
      },
      { fetchedAt: new Date("2026-05-28T06:00:00.000Z") }
    );

    expect(items[0]).toMatchObject({
      url: "https://github.com/example/coding-agent-tool",
      title: "example/coding-agent-tool",
      metadata: {
        stars: 1500,
        forks: 80,
        watchers: 1500,
        starsToday: 42
      }
    });
    expect(items[0]?.analyzableText).toContain("Momentum: +42 stars today.");
  });

  it("ignores sponsor links when parsing GitHub trending repository HTML", async () => {
    const adapter = createGitHubTrendingFetchAdapter({
      fetchImpl: async () =>
        new Response(
          [
            "<article>",
            "  <a href=\"/sponsors/affaan-m\">Sponsor</a>",
            "  <h2><a href=\"/affaan-m/ECC\">affaan-m / ECC</a></h2>",
            "  <p>The agent harness performance optimization system.</p>",
            "  <span>1,385 stars today</span>",
            "</article>"
          ].join("\n"),
          { status: 200 }
        )
    });

    const items = await adapter.fetch(
      {
        id: "github-trending-page",
        platform: "github",
        adapter: "github-trending",
        target: "https://github.com/trending?since=daily",
        enabled: true,
        notes: "Trending page"
      },
      { fetchedAt: new Date("2026-05-29T06:00:00.000Z") }
    );

    expect(items[0]).toMatchObject({
      url: "https://github.com/affaan-m/ECC",
      title: "affaan-m/ECC",
      author: "affaan-m",
      metadata: {
        repoName: "affaan-m/ECC",
        starsToday: 1385
      }
    });
  });

  it("identifies trending repository observations by repo and collection date", async () => {
    const adapter = createGitHubTrendingFetchAdapter({
      fetchImpl: async () =>
        new Response(
          [
            "<article>",
            "  <h2><a href=\"/example/agent-runtime\">example / agent-runtime</a></h2>",
            "  <p>Agent runtime toolkit for durable tool execution.</p>",
            "  <span>42 stars today</span>",
            "</article>"
          ].join("\n"),
          { status: 200 }
        )
    });
    const source = {
      id: "github-trending-page",
      platform: "github",
      adapter: "github-trending",
      target: "https://github.com/trending?since=daily",
      enabled: true,
      notes: "Trending page"
    };

    const firstRun = await adapter.fetch(source, {
      fetchedAt: new Date("2026-05-29T06:00:00.000Z"),
      collectionDate: new Date("2026-05-29T06:00:00.000Z")
    });
    const rerunSameDay = await adapter.fetch(source, {
      fetchedAt: new Date("2026-05-29T07:00:00.000Z"),
      collectionDate: new Date("2026-05-29T06:00:00.000Z")
    });
    const nextDay = await adapter.fetch(source, {
      fetchedAt: new Date("2026-05-30T06:00:00.000Z"),
      collectionDate: new Date("2026-05-30T06:00:00.000Z")
    });

    expect(firstRun[0]?.id).toBe(rerunSameDay[0]?.id);
    expect(firstRun[0]?.id).not.toBe(nextDay[0]?.id);
    expect(firstRun[0]?.metadata).toMatchObject({
      repoName: "example/agent-runtime",
      observedForDate: "2026-05-29",
      trendingRange: "daily"
    });
    expect(nextDay[0]?.metadata).toMatchObject({
      observedForDate: "2026-05-30"
    });
  });
});
