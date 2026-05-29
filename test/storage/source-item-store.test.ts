import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { appendSourceItems, readSourceItems, sourceItemStorePath } from "../../src/storage/index.js";
import type { SourceItem } from "../../src/domain/index.js";

describe("Source Item Store", () => {
  it("calculates the daily JSONL path", () => {
    expect(sourceItemStorePath(new Date("2026-05-28T06:00:00.000Z"), "data/source-items")).toBe(
      join("data/source-items", "2026", "05", "2026-05-28.jsonl")
    );
  });

  it("returns an empty list when the daily file does not exist", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-store-"));

    try {
      await expect(readSourceItems(new Date("2026-05-28T06:00:00.000Z"), directory)).resolves.toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("appends, reads, and deduplicates Source Items by id and content hash", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-store-"));
    const date = new Date("2026-05-28T06:00:00.000Z");
    const item = sourceItem();

    try {
      const first = await appendSourceItems([item], date, directory);
      const second = await appendSourceItems([item, { ...item, id: "other-id" }], date, directory);
      const stored = await readSourceItems(date, directory);

      expect(first.written).toHaveLength(1);
      expect(second.written).toHaveLength(0);
      expect(second.skipped).toHaveLength(2);
      expect(stored).toEqual([item]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports malformed JSONL with the path and line number", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-store-"));
    const date = new Date("2026-05-28T06:00:00.000Z");
    const path = sourceItemStorePath(date, directory);

    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${JSON.stringify(sourceItem())}\n{bad json}\n`, "utf8");

      await expect(readSourceItems(date, directory)).rejects.toThrow(
        `${path} line 2 contains malformed Source Item JSON`
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function sourceItem(): SourceItem {
  return {
    id: "fixture:item-1",
    sourceId: "fixture",
    platform: "blog",
    url: "https://example.com/agent-runtime",
    title: "Agent runtime notes",
    author: "Example Author",
    publishedAt: "2026-05-28T05:00:00.000Z",
    fetchedAt: "2026-05-28T06:00:00.000Z",
    analyzableText: "Agent Architecture notes.",
    contentHash: "a".repeat(64)
  };
}
