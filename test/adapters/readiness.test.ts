import { describe, expect, it } from "vitest";
import {
  anthropicNewsFetchAdapter,
  claudePlatformReleaseNotesFetchAdapter,
  fixtureFetchAdapter,
  githubTrendingFetchAdapter,
  openAiNewsFetchAdapter,
  rssFetchAdapter,
  xFetchAdapter
} from "../../src/adapters/index.js";

describe("Fetch Adapter readiness metadata", () => {
  it("declares whether each adapter is local-only or live-capable", () => {
    expect({
      [anthropicNewsFetchAdapter.name]: anthropicNewsFetchAdapter.readiness,
      [claudePlatformReleaseNotesFetchAdapter.name]: claudePlatformReleaseNotesFetchAdapter.readiness,
      [fixtureFetchAdapter.name]: fixtureFetchAdapter.readiness,
      [githubTrendingFetchAdapter.name]: githubTrendingFetchAdapter.readiness,
      [openAiNewsFetchAdapter.name]: openAiNewsFetchAdapter.readiness,
      [rssFetchAdapter.name]: rssFetchAdapter.readiness,
      [xFetchAdapter.name]: xFetchAdapter.readiness
    }).toEqual({
      "anthropic-news": "live-capable",
      "claude-platform-release-notes": "live-capable",
      fixture: "local-only",
      "github-trending": "live-capable",
      "openai-news": "live-capable",
      rss: "live-capable",
      x: "live-capable"
    });
  });
});
