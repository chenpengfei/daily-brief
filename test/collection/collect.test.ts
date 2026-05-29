import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { collectSources } from "../../src/collection/index.js";
import { readSourceItems } from "../../src/storage/index.js";

describe("collectSources", () => {
  it("collects deterministic fixture Source Items into JSONL and skips duplicates", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-collect-"));
    const registryPath = join(directory, "sources.yaml");
    const fixturePath = join(directory, "fixture.json");
    const sourceItemRoot = join(directory, "source-items");
    const date = new Date("2026-05-28T06:00:00.000Z");
    const fetchedAt = new Date("2026-05-28T06:05:00.000Z");

    try {
      await mkdir(directory, { recursive: true });
      await writeFile(
        fixturePath,
        JSON.stringify({
          items: [
            {
              id: "item-1",
              url: "https://example.com/agent-runtime",
              title: "Agent runtime notes",
              author: "Example Author",
              publishedAt: "2026-05-28T05:00:00.000Z",
              analyzableText: "A concrete write-up about Agent Architecture state and tool execution."
            }
          ]
        }),
        "utf8"
      );
      await writeFile(
        registryPath,
        [
          "sources:",
          "  - id: fixture-blog",
          "    platform: blog",
          "    adapter: fixture",
          `    target: ${fixturePath}`,
          "    enabled: true",
          "    notes: Local deterministic fixture",
          "  - id: disabled-fixture",
          "    platform: blog",
          "    adapter: fixture",
          `    target: ${fixturePath}`,
          "    enabled: false",
          "    notes: Disabled fixture"
        ].join("\n"),
        "utf8"
      );

      const firstRun = await collectSources({ date, fetchedAt, sourceRegistryPath: registryPath, sourceItemRoot });
      const secondRun = await collectSources({ date, fetchedAt, sourceRegistryPath: registryPath, sourceItemRoot });
      const stored = await readSourceItems(date, sourceItemRoot);
      const jsonl = await readFile(firstRun.storePath, "utf8");

      expect(firstRun.sources).toEqual([
        {
          sourceId: "fixture-blog",
          status: "success",
          itemCount: 1,
          writtenCount: 1,
          skippedDuplicateCount: 0
        },
        {
          sourceId: "disabled-fixture",
          status: "skipped",
          itemCount: 0,
          writtenCount: 0,
          skippedDuplicateCount: 0,
          reason: "Source disabled"
        }
      ]);
      expect(secondRun.sources[0]).toMatchObject({ writtenCount: 0, skippedDuplicateCount: 1 });
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        id: "fixture-blog:item-1",
        sourceId: "fixture-blog",
        platform: "blog",
        url: "https://example.com/agent-runtime",
        title: "Agent runtime notes",
        author: "Example Author",
        publishedAt: "2026-05-28T05:00:00.000Z",
        fetchedAt: "2026-05-28T06:05:00.000Z",
        analyzableText: "A concrete write-up about Agent Architecture state and tool execution."
      });
      expect(stored[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(jsonl.trim().split("\n")).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("records failed Sources without stopping the whole collection run", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-collect-"));
    const registryPath = join(directory, "sources.yaml");

    try {
      await writeFile(
        registryPath,
        [
          "sources:",
          "  - id: missing-adapter",
          "    platform: blog",
          "    adapter: missing",
          "    target: ./missing.json",
          "    enabled: true",
          "    notes: Missing adapter"
        ].join("\n"),
        "utf8"
      );

      await expect(collectSources({ sourceRegistryPath: registryPath })).resolves.toMatchObject({
        sources: [
          {
            sourceId: "missing-adapter",
            status: "failed",
            reason: "Fetch Adapter not registered: missing"
          }
        ]
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
