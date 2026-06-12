import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { probeAdapters } from "../../src/collection/index.js";
import { createSourceItem, type Source, type SourceItem } from "../../src/domain/index.js";

describe("probeAdapters", () => {
  it("probes Sources serially, reports progress, and limits samples", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-probe-"));
    const registryPath = join(directory, "sources.yaml");
    const progress: string[] = [];
    const fetchOrder: string[] = [];

    try {
      await writeRegistry(registryPath, [
        sourceYaml("first-live", "mock-live", "https://example.com/first", true),
        sourceYaml("second-live", "mock-live", "https://example.com/second", true)
      ]);

      const result = await probeAdapters({
        sourceRegistryPath: registryPath,
        adapters: {
          "mock-live": {
            name: "mock-live",
            readiness: "live-capable",
            async fetch(source, context) {
              fetchOrder.push(source.id);
              return [1, 2, 3, 4].map((index) => item(source, context.fetchedAt, index));
            }
          }
        },
        fetchedAt: new Date("2026-06-12T06:00:00.000Z"),
        onProgress(line) {
          progress.push(line);
        }
      });

      expect(fetchOrder).toEqual(["first-live", "second-live"]);
      expect(progress).toEqual([
        "Probing Source first-live (mock-live, enabled, live)",
        "Source first-live succeeded: 4 item(s)",
        "Probing Source second-live (mock-live, enabled, live)",
        "Source second-live succeeded: 4 item(s)"
      ]);
      expect(result.releaseReady).toBe(true);
      expect(result.sources[0]).toMatchObject({ status: "success", evidence: "live", itemCount: 4 });
      expect(result.sources[0]?.samples).toHaveLength(3);
      expect(result.adapters[0]).toMatchObject({
        adapter: "mock-live",
        readiness: "live-capable",
        status: "ready",
        liveSuccessCount: 2,
        liveItemCount: 8
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("aborts timed-out fetches and continues probing later Sources", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-probe-timeout-"));
    const registryPath = join(directory, "sources.yaml");
    let aborted = false;

    try {
      await writeRegistry(registryPath, [
        sourceYaml("slow-live", "slow-live", "https://example.com/slow", true),
        sourceYaml("later-live", "later-live", "https://example.com/later", true)
      ]);

      const result = await probeAdapters({
        sourceRegistryPath: registryPath,
        timeoutMs: 5,
        adapters: {
          "slow-live": {
            name: "slow-live",
            readiness: "live-capable",
            async fetch(_source, context) {
              await new Promise((_resolve, reject) => {
                context.signal?.addEventListener("abort", () => {
                  aborted = true;
                  reject(new Error("fetch observed abort"));
                });
              });
              return [];
            }
          },
          "later-live": {
            name: "later-live",
            readiness: "live-capable",
            async fetch(source, context) {
              return [item(source, context.fetchedAt, 1)];
            }
          }
        },
        fetchedAt: new Date("2026-06-12T06:00:00.000Z")
      });

      expect(aborted).toBe(true);
      expect(result.sources).toMatchObject([
        { sourceId: "slow-live", status: "failed", reason: "Probe timed out after 5ms" },
        { sourceId: "later-live", status: "success", itemCount: 1 }
      ]);
      expect(result.releaseReady).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails missing adapters and malformed Source Items without stopping the probe", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-probe-invalid-"));
    const registryPath = join(directory, "sources.yaml");

    try {
      await writeRegistry(registryPath, [
        sourceYaml("missing-live", "missing", "https://example.com/missing", true),
        sourceYaml("malformed-live", "malformed-live", "https://example.com/malformed", true),
        sourceYaml("valid-live", "valid-live", "https://example.com/valid", true)
      ]);

      const result = await probeAdapters({
        sourceRegistryPath: registryPath,
        adapters: {
          "malformed-live": {
            name: "malformed-live",
            readiness: "live-capable",
            async fetch() {
              return [{ id: "missing-shape" } as SourceItem];
            }
          },
          "valid-live": {
            name: "valid-live",
            readiness: "live-capable",
            async fetch(source, context) {
              return [item(source, context.fetchedAt, 1)];
            }
          }
        },
        fetchedAt: new Date("2026-06-12T06:00:00.000Z")
      });

      expect(result.sources).toMatchObject([
        { sourceId: "missing-live", status: "failed", reason: "Fetch Adapter not registered: missing" },
        { sourceId: "malformed-live", status: "failed", reason: "Source Item 0.sourceId must be a non-empty string" },
        { sourceId: "valid-live", status: "success" }
      ]);
      expect(result.releaseReady).toBe(false);
      expect(result.blockers).toContain("Adapter missing: Fetch Adapter is not registered");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("treats fixture and local targets as insufficient local evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-probe-local-"));
    const registryPath = join(directory, "sources.yaml");

    try {
      await writeRegistry(registryPath, [sourceYaml("fixture-blog", "fixture", join(directory, "fixture.json"), true)]);

      const result = await probeAdapters({
        sourceRegistryPath: registryPath,
        adapters: {
          fixture: {
            name: "fixture",
            readiness: "local-only",
            async fetch(source, context) {
              return [item(source, context.fetchedAt, 1)];
            }
          }
        },
        fetchedAt: new Date("2026-06-12T06:00:00.000Z")
      });

      expect(result.sources[0]).toMatchObject({ sourceId: "fixture-blog", status: "success", evidence: "local" });
      expect(result.adapters[0]).toMatchObject({ adapter: "fixture", readiness: "local-only", status: "local-only" });
      expect(result.releaseReady).toBe(false);
      expect(result.blockers).toContain("No live Source probes selected; local or fixture evidence cannot satisfy live readiness");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("blocks live-capable adapters that only return empty live evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-probe-empty-"));
    const registryPath = join(directory, "sources.yaml");

    try {
      await writeRegistry(registryPath, [sourceYaml("empty-live", "empty-live", "https://example.com/empty", true)]);

      const result = await probeAdapters({
        sourceRegistryPath: registryPath,
        adapters: {
          "empty-live": {
            name: "empty-live",
            readiness: "live-capable",
            async fetch() {
              return [];
            }
          }
        }
      });

      expect(result.sources[0]).toMatchObject({ sourceId: "empty-live", status: "success", itemCount: 0 });
      expect(result.adapters[0]).toMatchObject({
        adapter: "empty-live",
        status: "blocked",
        blocker: "live-capable adapter has no successful non-empty live Source probe"
      });
      expect(result.releaseReady).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not count X remote JSON HTTP targets as live readiness evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-probe-x-remote-json-"));
    const registryPath = join(directory, "sources.yaml");

    try {
      await writeRegistry(registryPath, [
        sourceYaml("x-remote-json", "x", "https://x.example/mock/account/example", true)
      ]);

      const result = await probeAdapters({
        sourceRegistryPath: registryPath,
        adapters: {
          x: {
            name: "x",
            readiness: "live-capable",
            async fetch(source, context) {
              return [item(source, context.fetchedAt, 1)];
            }
          }
        },
        fetchedAt: new Date("2026-06-12T06:00:00.000Z")
      });

      expect(result.sources[0]).toMatchObject({
        sourceId: "x-remote-json",
        adapter: "x",
        status: "success",
        evidence: "local",
        itemCount: 1
      });
      expect(result.adapters[0]).toMatchObject({
        adapter: "x",
        readiness: "live-capable",
        status: "blocked",
        liveSourceCount: 0,
        liveSuccessCount: 0,
        blocker: "live-capable adapter has no successful non-empty live Source probe"
      });
      expect(result.releaseReady).toBe(false);
      expect(result.blockers).toContain("No live Source probes selected; local or fixture evidence cannot satisfy live readiness");
      expect(result.blockers).toContain("Adapter x: live-capable adapter has no successful non-empty live Source probe");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("blocks a live-capable adapter with only local evidence even when another adapter has live success", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-probe-mixed-local-"));
    const registryPath = join(directory, "sources.yaml");

    try {
      await writeRegistry(registryPath, [
        sourceYaml("rss-local-file", "rss", join(directory, "rss.xml"), true),
        sourceYaml("github-live", "github-trending", "https://example.com/trending", true)
      ]);

      const result = await probeAdapters({
        sourceRegistryPath: registryPath,
        adapters: {
          rss: {
            name: "rss",
            readiness: "live-capable",
            async fetch(source, context) {
              return [item(source, context.fetchedAt, 1)];
            }
          },
          "github-trending": {
            name: "github-trending",
            readiness: "live-capable",
            async fetch(source, context) {
              return [item(source, context.fetchedAt, 1)];
            }
          }
        },
        fetchedAt: new Date("2026-06-12T06:00:00.000Z")
      });

      expect(result.sources).toMatchObject([
        { sourceId: "rss-local-file", adapter: "rss", status: "success", evidence: "local", itemCount: 1 },
        { sourceId: "github-live", adapter: "github-trending", status: "success", evidence: "live", itemCount: 1 }
      ]);
      expect(result.adapters).toEqual([
        expect.objectContaining({
          adapter: "github-trending",
          readiness: "live-capable",
          status: "ready",
          liveSuccessCount: 1
        }),
        expect.objectContaining({
          adapter: "rss",
          readiness: "live-capable",
          status: "blocked",
          liveSourceCount: 0,
          liveSuccessCount: 0,
          blocker: "live-capable adapter has no successful non-empty live Source probe"
        })
      ]);
      expect(result.releaseReady).toBe(false);
      expect(result.blockers).toContain(
        "Adapter rss: live-capable adapter has no successful non-empty live Source probe"
      );
      expect(result.blockers).not.toContain(
        "No live Source probes selected; local or fixture evidence cannot satisfy live readiness"
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

async function writeRegistry(path: string, sources: string[]): Promise<void> {
  await writeFile(path, ["sources:", ...sources].join("\n"), "utf8");
}

function sourceYaml(id: string, adapter: string, target: string, enabled: boolean): string {
  return [
    `  - id: ${id}`,
    "    platform: blog",
    `    adapter: ${adapter}`,
    `    target: ${target}`,
    `    enabled: ${enabled}`,
    "    notes: Probe test Source"
  ].join("\n");
}

function item(source: Source, fetchedAt: Date, index: number): SourceItem {
  return createSourceItem({
    id: `${source.id}:item-${index}`,
    sourceId: source.id,
    platform: source.platform,
    url: `https://example.com/${source.id}/item-${index}`,
    title: `Item ${index} for ${source.id}`,
    fetchedAt: fetchedAt.toISOString(),
    analyzableText: `Agent Architecture note ${index}`
  });
}
