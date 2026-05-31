import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { writeBriefArchive } from "../../src/storage/index.js";

describe("Brief Archive", () => {
  it("overwrites the same date path directly", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-archive-"));
    const date = new Date("2026-05-28T07:00:00.000Z");

    try {
      const first = await writeBriefArchive("first", date, directory);
      const second = await writeBriefArchive("second", date, directory);

      expect(second.path).toBe(first.path);
      expect(await readFile(first.path, "utf8")).toBe("second");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
