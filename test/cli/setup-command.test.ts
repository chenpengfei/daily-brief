import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli.js";

describe("setup command", () => {
  it("fails without interactive input support", async () => {
    const home = await mkdtemp(join(tmpdir(), "daily-brief-home-"));

    try {
      await expect(runCli(["setup"], captureOutput([]), { DAILY_BRIEF_HOME: home })).rejects.toThrow(
        "daily-brief setup requires an interactive terminal"
      );
      await expect(readFile(join(home, "config.yaml"), "utf8")).rejects.toThrow("ENOENT");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("fails before writing files when interactive input is unavailable", async () => {
    const home = await mkdtemp(join(tmpdir(), "daily-brief-home-"));
    const data = await mkdtemp(join(tmpdir(), "daily-brief-data-"));

    try {
      await expect(
        runCli(
          ["setup"],
          {
            ...captureOutput([]),
            interactive: false,
            async prompt() {
              return "";
            }
          },
          { DAILY_BRIEF_HOME: home, DAILY_BRIEF_DATA_HOME: data }
        )
      ).rejects.toThrow("daily-brief setup requires an interactive terminal");
      await expect(readFile(join(home, "config.yaml"), "utf8")).rejects.toThrow("ENOENT");
      await expect(readFile(join(home, "sources.yaml"), "utf8")).rejects.toThrow("ENOENT");
      await expect(readFile(join(home, "auth.json"), "utf8")).rejects.toThrow("ENOENT");
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(data, { recursive: true, force: true });
    }
  });

  it("prepares a fresh user home and data home interactively without running the workflow", async () => {
    const home = await mkdtemp(join(tmpdir(), "daily-brief-home-"));
    const data = await mkdtemp(join(tmpdir(), "daily-brief-data-"));
    const output: string[] = [];

    try {
      await runCli(["setup"], promptingOutput(output, ["", "", "", "", "no", "no"]), {
        DAILY_BRIEF_HOME: home,
        DAILY_BRIEF_DATA_HOME: data,
        TZ: "Asia/Shanghai"
      });

      expect(await readFile(join(home, "config.yaml"), "utf8")).toContain("timezone: Asia/Shanghai");
      expect(await readFile(join(home, "config.yaml"), "utf8")).toContain("language: zh");
      expect(await readFile(join(home, "config.yaml"), "utf8")).toContain("provider: openai-codex");
      expect(await readFile(join(home, "sources.yaml"), "utf8")).toContain("github-trending-daily");
      expect(await readFile(join(home, "auth.json"), "utf8")).toContain("\"credentials\": {}");
      expect(output.join("\n")).toContain("Model credential: missing");
      expect(output.join("\n")).toContain("Discord delivery: disabled");
      expect(output.join("\n")).toContain("Ready to run:");
      expect(output).toContain("prompt:Login to openai-codex now? [Y/n]:");
      expect(output).toContain("prompt:Enable Discord delivery? [y/N]:");
      expect(output.join("\n")).toContain("Credential name identifies where Daily Brief finds the model secret.");
      expect(output).toContain("prompt:Model credential name (openai-codex.default):");
      await expect(readFile(join(data, "briefs", "2026", "05", "2026-05-28.md"), "utf8")).rejects.toThrow("ENOENT");
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(data, { recursive: true, force: true });
    }
  });

  it("preserves existing files by default and rejects --force", async () => {
    const home = await mkdtemp(join(tmpdir(), "daily-brief-home-"));

    try {
      await writeFile(join(home, "config.yaml"), "timezone: UTC\ncustom: keep\n", "utf8");
      await writeFile(
        join(home, "sources.yaml"),
        [
          "sources:",
          "  - id: custom-source",
          "    platform: blog",
          "    adapter: rss",
          "    target: https://example.com/feed.xml",
          "    enabled: true",
          "    notes: Keep this Source"
        ].join("\n"),
        "utf8"
      );

      await runCli(["setup"], promptingOutput([], ["", "no", "", "", "", "no", "no"]), {
        DAILY_BRIEF_HOME: home,
        TZ: "Asia/Shanghai"
      });
      expect(await readFile(join(home, "config.yaml"), "utf8")).toContain("custom: keep");
      expect(await readFile(join(home, "sources.yaml"), "utf8")).toContain("custom-source");

      await expect(runCli(["setup", "--force"], promptingOutput([], []), { DAILY_BRIEF_HOME: home })).rejects.toThrow(
        "daily-brief setup does not accept flags"
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("can reinitialize an invalid existing Source Registry", async () => {
    const home = await mkdtemp(join(tmpdir(), "daily-brief-home-"));
    const output: string[] = [];

    try {
      await writeFile(join(home, "sources.yaml"), "sources: nope\n", "utf8");

      await runCli(["setup"], promptingOutput(output, ["", "yes", "", "", "", "no", "no"]), {
        DAILY_BRIEF_HOME: home,
        TZ: "Asia/Shanghai"
      });

      expect(output.join("\n")).toContain("Source Registry invalid:");
      expect(output.join("\n")).toContain("Source Registry reinitialized from the packaged example.");
      expect(await readFile(join(home, "sources.yaml"), "utf8")).toContain("github-trending-daily");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("guides model API key and Discord delivery configuration through setup", async () => {
    const home = await mkdtemp(join(tmpdir(), "daily-brief-home-"));
    const output: string[] = [];

    try {
      await runCli(
        ["setup"],
        promptingOutput(output, [
          "",
          "openai",
          "",
          "openai.work",
          "yes",
          "secret-value",
          "yes",
          "",
          "https://discord.example/webhook"
        ]),
        { DAILY_BRIEF_HOME: home, TZ: "Asia/Shanghai" }
      );

      const config = await readFile(join(home, "config.yaml"), "utf8");
      const auth = await readFile(join(home, "auth.json"), "utf8");

      expect(config).toContain("provider: openai");
      expect(config).toContain("credentialRef: openai.work");
      expect(config).toContain("webhookRef: discord.default");
      expect(config).not.toContain("secret-value");
      expect(auth).toContain("secret-value");
      expect(auth).toContain("https://discord.example/webhook");
      expect(output.join("\n")).toContain("Stored credential: openai.work");
      expect(output.join("\n")).toContain("Discord webhook stored: discord.default");
      expect(output).toContain("prompt:Store API key in credential store? API key input may be visible in this terminal. [y/N]:");
      expect(output).toContain("prompt:Enable Discord delivery? [y/N]:");
      expect(output).toContain("prompt:Discord webhook credential name (discord.default):");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("accepts short y/n answers in yes-no setup prompts", async () => {
    const home = await mkdtemp(join(tmpdir(), "daily-brief-home-"));
    const output: string[] = [];

    try {
      await runCli(
        ["setup"],
        promptingOutput(output, ["", "openai", "", "openai.work", "y", "secret-value", "y", "", "https://discord.example/webhook"]),
        { DAILY_BRIEF_HOME: home, TZ: "Asia/Shanghai" }
      );

      const config = await readFile(join(home, "config.yaml"), "utf8");
      expect(config).toContain("credentialRef: openai.work");
      expect(config).toContain("webhookRef: discord.default");
      expect(output.join("\n")).toContain("Discord webhook stored: discord.default");
    } finally {
      await rm(home, { recursive: true, force: true });
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

function promptingOutput(output: string[], answers: string[]) {
  return {
    ...captureOutput(output),
    async prompt(message: string) {
      output.push(`prompt:${message}`);
      return answers.shift() ?? "";
    }
  };
}
