import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { deliverOnce, generateOnce, runOnce } from "../../src/agent/index.js";
import { readSourceItems } from "../../src/storage/index.js";

describe("daily workflow orchestration", () => {
  it("runs collect -> generate -> archive -> deliver without duplicating rerun Signals", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-workflow-"));
    const registryPath = join(directory, "sources.yaml");
    const fixturePath = join(directory, "fixture.json");
    const sourceItemRoot = join(directory, "source-items");
    const archiveRoot = join(directory, "briefs");
    const date = new Date("2026-05-28T07:00:00.000Z");

    try {
      await mkdir(directory, { recursive: true });
      await writeFile(
        fixturePath,
        JSON.stringify({
          items: [
            {
              id: "item-1",
              url: "https://example.com/agent-runtime",
              title: "Agent runtime patterns",
              analyzableText: "Agent Architecture notes about tool execution."
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
          "    notes: Fixture"
        ].join("\n"),
        "utf8"
      );

      const firstRun = await runOnce({
        date,
        sourceRegistryPath: registryPath,
        sourceItemRoot,
        archiveRoot
      });
      const secondRun = await runOnce({
        date,
        sourceRegistryPath: registryPath,
        sourceItemRoot,
        archiveRoot
      });
      const stored = await readSourceItems(date, sourceItemRoot);
      const archived = await readFile(firstRun.archivePath, "utf8");

      expect(firstRun.collection.sources[0]).toMatchObject({ writtenCount: 1, skippedDuplicateCount: 0 });
      expect(secondRun.collection.sources[0]).toMatchObject({ writtenCount: 0, skippedDuplicateCount: 1 });
      expect(stored).toHaveLength(1);
      expect(archived.match(/### Agent runtime patterns/g)).toHaveLength(1);
      expect(firstRun.delivery).toEqual({ status: "skipped", reason: "DISCORD_WEBHOOK_URL is not configured" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("supports separate generate and deliver commands", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-workflow-"));
    const sourceItemRoot = join(directory, "source-items");
    const archiveRoot = join(directory, "briefs");
    const date = new Date("2026-05-28T07:00:00.000Z");

    try {
      const generated = await generateOnce({ date, sourceItemRoot, archiveRoot });
      const delivery = await deliverOnce({ date, sourceItemRoot, archiveRoot });

      expect(generated.archivePath).toBe(join(archiveRoot, "2026", "05", "2026-05-28.md"));
      expect(delivery).toEqual({ status: "skipped", reason: "DISCORD_WEBHOOK_URL is not configured" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("sends a Core Workflow Failure notification without archiving a false Daily Brief", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-workflow-"));
    const registryPath = join(directory, "sources.yaml");
    const archiveRoot = join(directory, "briefs");
    const requests: unknown[] = [];

    try {
      await writeFile(registryPath, "sources:\n  - id: broken\n    platform: blog\n", "utf8");

      const result = await runOnce({
        date: new Date("2026-05-28T07:00:00.000Z"),
        sourceRegistryPath: registryPath,
        archiveRoot,
        discordWebhookUrl: "https://discord.example/webhook",
        discordFetchImpl: async (_url, init) => {
          requests.push(JSON.parse(String(init?.body)));
          return new Response(null, { status: 204 });
        }
      });

      expect(result.coreFailure).toMatchObject({ kind: "unreadable-source-registry" });
      expect(result.archivePath).toBe("");
      expect(result.delivery).toEqual({ status: "sent" });
      expect(requests[0]).toMatchObject({
        content: expect.stringContaining("Core Workflow Failure: unreadable-source-registry")
      });
      await expect(readFile(join(archiveRoot, "2026", "05", "2026-05-28.md"), "utf8")).rejects.toThrow("ENOENT");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
