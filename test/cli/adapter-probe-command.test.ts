import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli.js";

describe("adapter probe CLI command", () => {
  it("probes enabled Sources, prints samples, and stays dry-run", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-probe-"));
    const dataHome = join(directory, "data");
    const fixturePath = join(directory, "fixture.json");
    const output: string[] = [];

    try {
      await writeFixture(fixturePath, 4);
      await writeFile(
        join(directory, "sources.yaml"),
        [
          "sources:",
          "  - id: local-fixture",
          "    platform: blog",
          "    adapter: fixture",
          `    target: ${fixturePath}`,
          "    enabled: true",
          "    notes: Local fixture for probe test",
          "  - id: disabled-fixture",
          "    platform: blog",
          "    adapter: fixture",
          `    target: ${fixturePath}`,
          "    enabled: false",
          "    notes: Disabled local fixture"
        ].join("\n"),
        "utf8"
      );

      await expect(
        runCli(["adapters", "probe"], captureOutput(output), {
          DAILY_BRIEF_HOME: directory,
          DAILY_BRIEF_DATA_HOME: dataHome
        })
      ).rejects.toThrow("Live Adapter Probe failed release readiness checks.");

      const text = output.join("\n");
      expect(text).toContain("Probing Source local-fixture (fixture, enabled, local)");
      expect(text).toContain("Source local-fixture succeeded: 4 item(s)");
      expect(text).toContain("Release readiness: blocked");
      expect(text).toContain("No live Source probes selected; local or fixture evidence cannot satisfy live readiness");
      expect(text).not.toContain("disabled-fixture");
      expect(text.match(/Sample:/g)).toHaveLength(3);
      expect(await exists(join(dataHome, "source-items"))).toBe(false);
      expect(await exists(join(dataHome, "agent-runs"))).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("can include disabled Sources when requested", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-probe-disabled-"));
    const fixturePath = join(directory, "fixture.json");
    const output: string[] = [];

    try {
      await writeFixture(fixturePath, 1);
      await writeFile(
        join(directory, "sources.yaml"),
        [
          "sources:",
          "  - id: enabled-fixture",
          "    platform: blog",
          "    adapter: fixture",
          `    target: ${fixturePath}`,
          "    enabled: true",
          "    notes: Enabled fixture",
          "  - id: disabled-fixture",
          "    platform: blog",
          "    adapter: fixture",
          `    target: ${fixturePath}`,
          "    enabled: false",
          "    notes: Disabled fixture"
        ].join("\n"),
        "utf8"
      );

      await expect(
        runCli(["adapters", "probe", "--include-disabled"], captureOutput(output), {
          DAILY_BRIEF_HOME: directory,
          DAILY_BRIEF_DATA_HOME: join(directory, "data")
        })
      ).rejects.toThrow("Live Adapter Probe failed release readiness checks.");

      const text = output.join("\n");
      expect(text).toContain("Probing Source enabled-fixture (fixture, enabled, local)");
      expect(text).toContain("Probing Source disabled-fixture (fixture, disabled, local)");
      expect(text).toContain("Release readiness: blocked");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("prints a blocking summary and exits non-zero when a selected Source fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-probe-fail-"));
    const output: string[] = [];

    try {
      await writeFile(
        join(directory, "sources.yaml"),
        [
          "sources:",
          "  - id: missing-adapter",
          "    platform: blog",
          "    adapter: missing",
          "    target: https://example.com/feed.xml",
          "    enabled: true",
          "    notes: Missing adapter"
        ].join("\n"),
        "utf8"
      );

      await expect(
        runCli(["adapters", "probe"], captureOutput(output), {
          DAILY_BRIEF_HOME: directory,
          DAILY_BRIEF_DATA_HOME: join(directory, "data")
        })
      ).rejects.toThrow("Live Adapter Probe failed release readiness checks.");

      const text = output.join("\n");
      expect(text).toContain("Source missing-adapter failed: Fetch Adapter not registered: missing");
      expect(text).toContain("Release readiness: blocked");
      expect(text).toContain("Adapter missing: Fetch Adapter is not registered");
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

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeFixture(path: string, itemCount: number): Promise<void> {
  const items = Array.from({ length: itemCount }, (_, index) => {
    const number = index + 1;
    return {
      id: `item-${number}`,
      url: `https://example.com/probe-${number}`,
      title: `Agent runtime probe item ${number}`,
      author: "Example Author",
      publishedAt: "2026-05-28T05:00:00.000Z",
      analyzableText: `Agent Architecture probe item ${number}.`
    };
  });

  await writeFile(path, JSON.stringify({ items }), "utf8");
}
