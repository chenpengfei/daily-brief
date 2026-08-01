import { describe, expect, it } from "vitest";
import {
  anthropicNewsFetchAdapter,
  claudePlatformReleaseNotesFetchAdapter,
  fixtureFetchAdapter,
  githubTrendingFetchAdapter,
  openAiNewsFetchAdapter,
  rssFetchAdapter
} from "../../src/adapters/index.js";
import { defaultFetchAdapters } from "../../src/collection/index.js";

describe("Fetch Adapter readiness metadata", () => {
  it("declares whether each adapter is local-only or live-capable", () => {
    expect({
      [anthropicNewsFetchAdapter.name]: anthropicNewsFetchAdapter.readiness,
      [claudePlatformReleaseNotesFetchAdapter.name]: claudePlatformReleaseNotesFetchAdapter.readiness,
      [fixtureFetchAdapter.name]: fixtureFetchAdapter.readiness,
      [githubTrendingFetchAdapter.name]: githubTrendingFetchAdapter.readiness,
      [openAiNewsFetchAdapter.name]: openAiNewsFetchAdapter.readiness,
      [rssFetchAdapter.name]: rssFetchAdapter.readiness
    }).toEqual({
      "anthropic-news": "live-capable",
      "claude-platform-release-notes": "live-capable",
      fixture: "local-only",
      "github-trending": "live-capable",
      "openai-news": "live-capable",
      rss: "live-capable"
    });
  });

  it("does not register the retired X adapter", () => {
    expect(defaultFetchAdapters()).not.toHaveProperty("x");
  });
});
