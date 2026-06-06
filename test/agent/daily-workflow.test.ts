import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { deliverOnce, generateOnce, runOnce } from "../../src/agent/index.js";
import { appendSourceItems, readSourceItems } from "../../src/storage/index.js";

describe("daily workflow orchestration", () => {
  it("runs collect -> generate -> archive -> deliver without duplicating rerun Signals", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-workflow-"));
    const registryPath = join(directory, "sources.yaml");
    const fixturePath = join(directory, "fixture.json");
    const sourceItemRoot = join(directory, "source-items");
    const archiveRoot = join(directory, "briefs");
    const agentRunRoot = join(directory, "agent-runs");
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
      await writeFauxModelConfig(directory);

      const firstRun = await runOnce({
        date,
        sourceRegistryPath: registryPath,
        sourceItemRoot,
        archiveRoot,
        agentRunRoot,
        discordEnv: { DAILY_BRIEF_HOME: directory },
        modelRuntimeEnv: { DAILY_BRIEF_HOME: directory }
      });
      const secondRun = await runOnce({
        date,
        sourceRegistryPath: registryPath,
        sourceItemRoot,
        archiveRoot,
        agentRunRoot,
        discordEnv: { DAILY_BRIEF_HOME: directory },
        modelRuntimeEnv: { DAILY_BRIEF_HOME: directory }
      });
      const stored = await readSourceItems(date, sourceItemRoot);
      const archived = await readFile(firstRun.archivePath, "utf8");
      const artifact = await readFile(String(firstRun.agentRunArtifactPath), "utf8");

      expect(firstRun.collection.sources[0]).toMatchObject({ writtenCount: 1, skippedDuplicateCount: 0 });
      expect(secondRun.collection.sources[0]).toMatchObject({ writtenCount: 0, skippedDuplicateCount: 1 });
      expect(stored).toHaveLength(1);
      expect(archived.match(/### Agent runtime patterns/g)).toHaveLength(1);
      expect(archived).toContain("- 是什么: 当前 Source Item 表明：Agent Architecture notes about tool execution.");
      expect(archived).toContain(
        "- 为什么重要: 它值得关注，因为 Agent runtime patterns 暴露了一个可检查的 Agent Architecture 或 AI Coding 实践切面。"
      );
      expect(firstRun.piEvents).toContain("signal_narrative:agent_start");
      const parsedArtifact = JSON.parse(artifact);
      expect(parsedArtifact).toMatchObject({
        model: { provider: "faux", model: "faux-daily-brief-renderer" },
        inputRefs: { signalIds: ["signal:https://example.com/agent-runtime"] },
        stages: [
          { stage: "understanding", status: "succeeded", validation: { status: "passed" } },
          { stage: "selection", status: "succeeded", validation: { status: "passed" } },
          { stage: "ranking", status: "succeeded", validation: { status: "passed" } },
          { stage: "narrative", status: "succeeded", validation: { status: "passed" } },
          { stage: "audit", status: "succeeded", validation: { status: "passed" } }
        ]
      });
      expect(parsedArtifact.inputRefs.sourceItemIds).toHaveLength(1);
      expect(parsedArtifact.inputRefs.sourceItemIds[0]).toContain("fixture-blog:");
      expect(artifact).not.toContain("Render this Source-grounded Daily Brief");
      expect(artifact).not.toContain("transcript");
      expect(firstRun.delivery).toEqual({ status: "skipped", reason: "Discord delivery webhook is not configured" });
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
      await appendSourceItems(
        [
          {
            id: "item-1",
            sourceId: "source",
            platform: "blog",
            url: "https://example.com/agent-runtime",
            title: "Agent runtime",
            fetchedAt: date.toISOString(),
            analyzableText: "Agent Architecture notes about tool execution.",
            contentHash: "hash"
          }
        ],
        date,
        sourceItemRoot
      );
      await writeFauxModelConfig(directory);
      const generated = await generateOnce({
        date,
        sourceItemRoot,
        archiveRoot,
        modelRuntimeEnv: { DAILY_BRIEF_HOME: directory }
      });
      const delivery = await deliverOnce({ date, sourceItemRoot, archiveRoot, discordEnv: { DAILY_BRIEF_HOME: directory } });

      expect(generated.archivePath).toBe(join(archiveRoot, "2026", "05", "2026-05-28.md"));
      expect(delivery).toEqual({ status: "skipped", reason: "Discord delivery webhook is not configured" });
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

  it("fails when every enabled Source fails and no Source Items exist", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-workflow-"));
    const registryPath = join(directory, "sources.yaml");
    const archiveRoot = join(directory, "briefs");

    try {
      await writeFile(
        registryPath,
        [
          "sources:",
          "  - id: missing-fixture",
          "    platform: blog",
          "    adapter: fixture",
          `    target: ${join(directory, "missing.json")}`,
          "    enabled: true",
          "    notes: Missing fixture"
        ].join("\n"),
        "utf8"
      );
      await writeFauxModelConfig(directory);

      const result = await runOnce({
        date: new Date("2026-05-31T07:00:00.000Z"),
        sourceRegistryPath: registryPath,
        sourceItemRoot: join(directory, "source-items"),
        archiveRoot,
        discordEnv: { DAILY_BRIEF_HOME: directory },
        modelRuntimeEnv: { DAILY_BRIEF_HOME: directory }
      });

      expect(result.coreFailure).toMatchObject({ kind: "no-usable-source-items" });
      expect(result.archivePath).toBe("");
      await expect(readFile(join(archiveRoot, "2026", "05", "2026-05-31.md"), "utf8")).rejects.toThrow("ENOENT");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("propagates partial collection failures into brief coverage and artifact input refs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-workflow-"));
    const registryPath = join(directory, "sources.yaml");
    const fixturePath = join(directory, "fixture.json");
    const sourceItemRoot = join(directory, "source-items");
    const archiveRoot = join(directory, "briefs");
    const agentRunRoot = join(directory, "agent-runs");
    const date = new Date("2026-05-31T07:00:00.000Z");

    try {
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
          "  - id: fixture-good",
          "    platform: blog",
          "    adapter: fixture",
          `    target: ${fixturePath}`,
          "    enabled: true",
          "    notes: Good fixture",
          "  - id: fixture-missing",
          "    platform: blog",
          "    adapter: fixture",
          `    target: ${join(directory, "missing.json")}`,
          "    enabled: true",
          "    notes: Missing fixture"
        ].join("\n"),
        "utf8"
      );
      await writeFauxModelConfig(directory);

      const result = await runOnce({
        date,
        dateKey: "2026-05-31",
        sourceRegistryPath: registryPath,
        sourceItemRoot,
        archiveRoot,
        agentRunRoot,
        discordEnv: { DAILY_BRIEF_HOME: directory },
        modelRuntimeEnv: { DAILY_BRIEF_HOME: directory }
      });
      const archived = await readFile(result.archivePath, "utf8");
      const artifact = JSON.parse(await readFile(String(result.agentRunArtifactPath), "utf8"));

      expect(result.coreFailure).toBeUndefined();
      expect(archived).toContain("Processed 1 Source Items from 2 Sources.");
      expect(archived).toContain("Partial failures: fixture-missing:");
      expect(artifact.inputRefs.collectionFailures).toEqual([
        expect.objectContaining({ sourceId: "fixture-missing" })
      ]);
      expect(artifact.stages.every((stage: { inputRefs: { collectionFailures?: unknown[] } }) => stage.inputRefs.collectionFailures?.length === 1)).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not archive when the audit stage rejects unsupported narrative claims", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-workflow-"));
    const sourceItemRoot = join(directory, "source-items");
    const archiveRoot = join(directory, "briefs");
    const date = new Date("2026-05-28T07:00:00.000Z");

    try {
      await appendSourceItems(
        [
          {
            id: "item-1",
            sourceId: "source",
            platform: "blog",
            url: "https://example.com/agent-runtime",
            title: "Agent runtime",
            fetchedAt: date.toISOString(),
            analyzableText: "Agent Architecture tool is guaranteed best in class.",
            contentHash: "hash"
          }
        ],
        date,
        sourceItemRoot
      );

      await writeFauxModelConfig(directory);
      await expect(
        generateOnce({
          date,
          sourceItemRoot,
          archiveRoot,
          modelRuntimeEnv: { DAILY_BRIEF_HOME: directory }
        })
      ).rejects.toThrow("Source-grounding audit failed");
      await expect(readFile(join(archiveRoot, "2026", "05", "2026-05-28.md"), "utf8")).rejects.toThrow("ENOENT");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

async function writeFauxModelConfig(directory: string): Promise<void> {
  await writeFile(
    join(directory, "config.yaml"),
    ["model:", "  provider: faux", "  model: faux-daily-brief-renderer"].join("\n"),
    "utf8"
  );
}
