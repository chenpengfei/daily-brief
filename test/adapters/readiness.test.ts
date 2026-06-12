import { describe, expect, it } from "vitest";
import {
  fixtureFetchAdapter,
  githubTrendingFetchAdapter,
  rssFetchAdapter,
  xFetchAdapter
} from "../../src/adapters/index.js";

describe("Fetch Adapter readiness metadata", () => {
  it("declares whether each adapter is local-only or live-capable", () => {
    expect({
      [fixtureFetchAdapter.name]: fixtureFetchAdapter.readiness,
      [githubTrendingFetchAdapter.name]: githubTrendingFetchAdapter.readiness,
      [rssFetchAdapter.name]: rssFetchAdapter.readiness,
      [xFetchAdapter.name]: xFetchAdapter.readiness
    }).toEqual({
      fixture: "local-only",
      "github-trending": "live-capable",
      rss: "live-capable",
      x: "live-capable"
    });
  });
});
