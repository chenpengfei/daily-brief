import { describe, expect, it } from "vitest";
import { createClaudePlatformReleaseNotesFetchAdapter } from "../../src/adapters/index.js";

describe("Claude Platform Release Notes Fetch Adapter", () => {
  it("turns dated Claude Platform release note sections into Source Items", async () => {
    const adapter = createClaudePlatformReleaseNotesFetchAdapter({
      fetchImpl: async () =>
        new Response(
          [
            "<main>",
            "  <h3><div id=\"june-5-2026\"></div><div>June 5, 2026</div></h3>",
            "  <ul><li>We announced the deprecation of the Claude Opus 4.1 model (<code>claude-opus-4-1-20250805</code>).</li></ul>",
            "  <h3><div id=\"june-2-2026\"></div><div>June 2, 2026</div></h3>",
            "  <ul>",
            "    <li>The advisor tool now supports a <code>max_tokens</code> parameter.</li>",
            "    <li>On the Claude API, refusal responses are no longer billed when no output is generated.</li>",
            "  </ul>",
            "</main>"
          ].join("\n"),
          { status: 200 }
        )
    });

    const items = await adapter.fetch(
      {
        id: "claude-platform-release-notes",
        platform: "claude-platform",
        adapter: "claude-platform-release-notes",
        target: "https://platform.claude.com/docs/en/release-notes/overview",
        enabled: true,
        notes: "Official Claude Platform release notes"
      },
      { fetchedAt: new Date("2026-06-07T06:00:00.000Z") }
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      sourceId: "claude-platform-release-notes",
      platform: "claude-platform",
      url: "https://platform.claude.com/docs/en/release-notes/overview#june-5-2026",
      title: "Claude Platform release notes: June 5, 2026",
      author: "Anthropic",
      publishedAt: "2026-06-05T00:00:00.000Z",
      metadata: {
        sourcePage: "https://platform.claude.com/docs/en/release-notes/overview",
        releaseDate: "June 5, 2026"
      }
    });
    expect(items[0]?.id).toMatch(/^claude-platform-release-notes:[a-f0-9]{16}$/);
    expect(items[0]?.analyzableText).toContain("claude-opus-4-1-20250805");
    expect(items[1]?.analyzableText).toContain("refusal responses are no longer billed");
  });

  it("records fetch failures with a clear adapter-specific status", async () => {
    const adapter = createClaudePlatformReleaseNotesFetchAdapter({
      fetchImpl: async () => new Response("not found", { status: 404 })
    });

    await expect(
      adapter.fetch(
        {
          id: "claude-platform-release-notes",
          platform: "claude-platform",
          adapter: "claude-platform-release-notes",
          target: "https://platform.claude.com/docs/en/release-notes/overview",
          enabled: true,
          notes: "Official Claude Platform release notes"
        },
        { fetchedAt: new Date("2026-06-07T06:00:00.000Z") }
      )
    ).rejects.toThrow("Claude Platform release notes target returned 404");
  });
});
