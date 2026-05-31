import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli.js";

describe("delivery CLI commands", () => {
  it("configures Discord delivery with webhook secret in auth.json and ref in config.yaml", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-delivery-"));

    try {
      await runCli(
        [
          "delivery",
          "configure",
          "--enabled",
          "true",
          "--webhook-ref",
          "discord.default",
          "--webhook-url",
          "https://discord.example/webhook"
        ],
        captureOutput([]),
        { DAILY_BRIEF_HOME: directory }
      );

      expect(await readFile(join(directory, "config.yaml"), "utf8")).toContain("webhookRef: discord.default");
      expect(await readFile(join(directory, "auth.json"), "utf8")).toContain("https://discord.example/webhook");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports disabled delivery and redacts configured webhook status", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-delivery-"));
    const output: string[] = [];

    try {
      await runCli(["delivery", "status"], captureOutput(output), { DAILY_BRIEF_HOME: directory });
      expect(output.join("\n")).toContain("Discord delivery: disabled");

      output.length = 0;
      await runCli(
        ["delivery", "configure", "--enabled", "true", "--webhook-url", "https://discord.example/webhook"],
        captureOutput([]),
        { DAILY_BRIEF_HOME: directory }
      );
      await runCli(["delivery", "status"], captureOutput(output), { DAILY_BRIEF_HOME: directory });

      expect(output.join("\n")).toContain("Webhook: <redacted>");
      expect(output.join("\n")).not.toContain("https://discord.example/webhook");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("sends deterministic test notification through mocked transport", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-delivery-"));
    const requests: unknown[] = [];
    const output: string[] = [];

    try {
      await runCli(
        ["delivery", "configure", "--enabled", "true", "--webhook-url", "https://discord.example/webhook"],
        captureOutput([]),
        { DAILY_BRIEF_HOME: directory }
      );
      await runCli(
        ["delivery", "test"],
        {
          ...captureOutput(output),
          fetchImpl: async (_url, init) => {
            requests.push(JSON.parse(String(init?.body)));
            return new Response(null, { status: 204 });
          }
        },
        { DAILY_BRIEF_HOME: directory }
      );

      expect(requests[0]).toEqual({ content: "Daily Brief delivery test" });
      expect(output.join("\n")).toContain("Discord delivery test: sent");
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
