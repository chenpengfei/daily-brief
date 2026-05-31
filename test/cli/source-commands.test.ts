import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli.js";

describe("source CLI commands", () => {
  it("lists, disables, and enables Sources from the configured Source Registry path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-sources-"));
    const registryPath = join(directory, "sources.yaml");
    const output: string[] = [];

    try {
      await writeFile(
        registryPath,
        [
          "sources:",
          "  - id: simon-blog",
          "    platform: blog",
          "    adapter: rss",
          "    target: https://example.com/feed.xml",
          "    enabled: true",
          "    notes: Useful Agent architecture writing"
        ].join("\n"),
        "utf8"
      );

      const io = captureOutput(output);
      const env = { DAILY_BRIEF_HOME: directory };

      await runCli(["sources", "list"], io, env);
      await runCli(["sources", "disable", "simon-blog"], io, env);
      await runCli(["sources", "list"], io, env);
      await runCli(["sources", "enable", "simon-blog"], io, env);

      const saved = await readFile(registryPath, "utf8");

      expect(output.join("\n")).toContain("enabled  simon-blog blog/rss https://example.com/feed.xml");
      expect(output.join("\n")).toContain("Disabled Source: simon-blog");
      expect(output.join("\n")).toContain("disabled simon-blog blog/rss https://example.com/feed.xml");
      expect(output.join("\n")).toContain("Enabled Source: simon-blog");
      expect(saved).toContain("enabled: true");
      expect(saved).toContain("notes: Useful Agent architecture writing");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails clearly when enabling or disabling an unknown Source id", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-sources-"));
    const registryPath = join(directory, "sources.yaml");

    try {
      await writeFile(registryPath, "sources: []\n", "utf8");

      await expect(
        runCli(["sources", "enable", "missing-source"], captureOutput([]), {
          DAILY_BRIEF_HOME: directory
        })
      ).rejects.toThrow("Source not found: missing-source");

      const saved = await readFile(registryPath, "utf8");
      expect(saved).toBe("sources: []\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("requires a Source id for enable and disable commands", async () => {
    await expect(runCli(["sources", "disable"], captureOutput([]), {})).rejects.toThrow(
      "sources disable requires a Source id"
    );
  });

  it("validates the user-home Source Registry without modifying it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-sources-"));
    const registryPath = join(directory, "sources.yaml");
    const output: string[] = [];

    try {
      const contents = [
        "sources:",
        "  - id: simon-blog",
        "    platform: blog",
        "    adapter: rss",
        "    target: https://example.com/feed.xml",
        "    enabled: true",
        "    notes: Useful Agent architecture writing"
      ].join("\n");
      await writeFile(registryPath, contents, "utf8");

      await runCli(["sources", "validate"], captureOutput(output), { DAILY_BRIEF_HOME: directory });

      expect(output.join("\n")).toContain(`Valid Source Registry: ${registryPath}`);
      expect(output.join("\n")).toContain("Sources: 1");
      expect(await readFile(registryPath, "utf8")).toBe(contents);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports Source Registry validation errors clearly without modifying the file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-sources-"));
    const registryPath = join(directory, "sources.yaml");
    const contents = "sources:\n  - id: missing-fields\n";

    try {
      await writeFile(registryPath, contents, "utf8");

      await expect(runCli(["sources", "validate"], captureOutput([]), { DAILY_BRIEF_HOME: directory })).rejects.toThrow(
        new RegExp(`Source Registry invalid: ${escapeRegExp(registryPath)}[\\s\\S]*platform must be a string`)
      );
      expect(await readFile(registryPath, "utf8")).toBe(contents);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prints the user-home Source Registry edit path and validation hint", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-sources-"));
    const output: string[] = [];

    try {
      await runCli(["sources", "edit"], captureOutput(output), { DAILY_BRIEF_HOME: directory });

      expect(output.join("\n")).toContain(`Source Registry: ${join(directory, "sources.yaml")}`);
      expect(output.join("\n")).toContain("daily-brief sources validate");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function captureOutput(output: string[]) {
  return {
    stdout(line: string) {
      output.push(line);
    },
    stderr(line: string) {
      output.push(line);
    }
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
