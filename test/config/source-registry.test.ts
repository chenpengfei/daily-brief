import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { formatSourceRegistry, loadSourceRegistry, setSourceEnabled } from "../../src/config/index.js";
import { parseSourceRegistry, SourceRegistryValidationError } from "../../src/domain/index.js";

describe("Source Registry", () => {
  it("accepts an empty registry", () => {
    expect(parseSourceRegistry({ sources: [] })).toEqual({ sources: [] });
  });

  it("accepts valid enabled and disabled Sources", () => {
    const registry = parseSourceRegistry({
      sources: [
        {
          id: "github-agent-trending",
          platform: "github",
          adapter: "github-search",
          target: "topic:ai-agent stars:>1000",
          enabled: true,
          notes: "Agent-related GitHub projects gaining attention"
        },
        {
          id: "simon-blog",
          platform: "blog",
          adapter: "rss",
          target: "https://simonwillison.net/atom/everything/",
          enabled: false,
          notes: "Useful Agent architecture writing, disabled until adapter exists"
        }
      ]
    });

    expect(registry.sources).toHaveLength(2);
    expect(registry.sources[1]?.enabled).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(() =>
      parseSourceRegistry({
        sources: [
          {
            id: "missing-target",
            platform: "github",
            adapter: "github-search",
            enabled: true,
            notes: "Missing target"
          }
        ]
      })
    ).toThrow(SourceRegistryValidationError);
  });

  it("rejects fields outside the Source Registry contract", () => {
    expect(() =>
      parseSourceRegistry({
        sources: [
          {
            id: "github-agent-trending",
            platform: "github",
            adapter: "github-search",
            target: "topic:ai-agent stars:>1000",
            enabled: true,
            notes: "Agent-related GitHub projects gaining attention",
            priority: "high"
          }
        ]
      })
    ).toThrow(/priority is not allowed/);
  });

  it("rejects duplicate Source ids", () => {
    expect(() =>
      parseSourceRegistry({
        sources: [
          {
            id: "duplicate",
            platform: "github",
            adapter: "github-search",
            target: "topic:ai-agent",
            enabled: true,
            notes: "First Source"
          },
          {
            id: "duplicate",
            platform: "x",
            adapter: "x-search",
            target: "agent architecture",
            enabled: true,
            notes: "Second Source"
          }
        ]
      })
    ).toThrow(/duplicates another Source id/);
  });

  it("loads YAML from disk", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-"));
    const path = join(directory, "sources.yaml");

    try {
      await writeFile(
        path,
        [
          "sources:",
          "  - id: github-agent-trending",
          "    platform: github",
          "    adapter: github-search",
          "    target: 'topic:ai-agent stars:>1000'",
          "    enabled: true",
          "    notes: Agent-related GitHub projects gaining attention"
        ].join("\n"),
        "utf8"
      );

      await expect(loadSourceRegistry(path)).resolves.toEqual({
        sources: [
          {
            id: "github-agent-trending",
            platform: "github",
            adapter: "github-search",
            target: "topic:ai-agent stars:>1000",
            enabled: true,
            notes: "Agent-related GitHub projects gaining attention"
          }
        ]
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("formats Sources with enabled and disabled state", () => {
    const output = formatSourceRegistry({
      sources: [
        {
          id: "github-agent-trending",
          platform: "github",
          adapter: "github-search",
          target: "topic:ai-agent stars:>1000",
          enabled: true,
          notes: "Agent-related GitHub projects gaining attention"
        }
      ]
    });

    expect(output).toContain("enabled");
    expect(output).toContain("github-agent-trending");
  });

  it("enables and disables Sources on disk", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-"));
    const path = join(directory, "sources.yaml");

    try {
      await writeFile(
        path,
        [
          "sources:",
          "  - id: simon-blog",
          "    platform: blog",
          "    adapter: rss",
          "    target: https://simonwillison.net/atom/everything/",
          "    enabled: true",
          "    notes: Useful Agent architecture writing"
        ].join("\n"),
        "utf8"
      );

      await setSourceEnabled("simon-blog", false, path);
      await expect(loadSourceRegistry(path)).resolves.toMatchObject({
        sources: [{ id: "simon-blog", enabled: false }]
      });

      await setSourceEnabled("simon-blog", true, path);
      await expect(loadSourceRegistry(path)).resolves.toMatchObject({
        sources: [{ id: "simon-blog", enabled: true }]
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
