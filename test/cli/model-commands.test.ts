import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli.js";

describe("model CLI commands", () => {
  it("configures a model non-interactively and stores API key credentials in auth.json", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-model-"));
    const output: string[] = [];

    try {
      await runCli(
        [
          "model",
          "configure",
          "--provider",
          "openai",
          "--model",
          "gpt-4.1-mini",
          "--credential-ref",
          "openai.work",
          "--api-key",
          "secret-value"
        ],
        captureOutput(output),
        { DAILY_BRIEF_HOME: directory }
      );

      const config = await readFile(join(directory, "config.yaml"), "utf8");
      const auth = await readFile(join(directory, "auth.json"), "utf8");

      expect(config).toContain("provider: openai");
      expect(config).toContain("credentialRef: openai.work");
      expect(config).not.toContain("secret-value");
      expect(auth).toContain("secret-value");
      expect(output.join("\n")).toContain("Model configured: openai/gpt-4.1-mini");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("supports prompt-backed interactive configuration with recommended Codex defaults", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-model-"));
    const output: string[] = [];

    try {
      await runCli(["model", "configure"], promptingOutput(output, ["", "", ""]), { DAILY_BRIEF_HOME: directory });

      const config = await readFile(join(directory, "config.yaml"), "utf8");
      expect(config).toContain("provider: openai-codex");
      expect(config).toContain("model: gpt-5.5");
      expect(config).toContain("credentialRef: openai-codex.default");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails non-interactive configure with a clear missing flag error", async () => {
    await expect(
      runCli(["model", "configure", "--provider", "openai"], captureOutput([]), {})
    ).rejects.toThrow("model configure requires --model");
  });

  it("prints status with redacted credential data", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-model-"));
    const output: string[] = [];

    try {
      await runCli(
        [
          "model",
          "configure",
          "--provider",
          "openai",
          "--model",
          "gpt-4.1-mini",
          "--credential-ref",
          "openai.work",
          "--api-key",
          "secret-value"
        ],
        captureOutput([]),
        { DAILY_BRIEF_HOME: directory }
      );
      await runCli(["model", "status"], captureOutput(output), { DAILY_BRIEF_HOME: directory });

      const status = output.join("\n");
      expect(status).toContain("Provider: openai");
      expect(status).toContain("Credential: openai.work provider=openai type=api-key secret=<redacted>");
      expect(status).not.toContain("secret-value");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("logs out only the selected credential reference", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-cli-model-"));
    const output: string[] = [];

    try {
      await runCli(
        [
          "model",
          "configure",
          "--provider",
          "openai",
          "--model",
          "gpt-4.1-mini",
          "--credential-ref",
          "openai.work",
          "--api-key",
          "secret-value"
        ],
        captureOutput([]),
        { DAILY_BRIEF_HOME: directory }
      );
      await runCli(
        [
          "model",
          "configure",
          "--provider",
          "deepseek",
          "--model",
          "deepseek-chat",
          "--credential-ref",
          "deepseek.personal",
          "--api-key",
          "deepseek-secret"
        ],
        captureOutput([]),
        { DAILY_BRIEF_HOME: directory }
      );

      await runCli(["model", "logout", "--credential-ref", "openai.work"], captureOutput(output), {
        DAILY_BRIEF_HOME: directory
      });

      const auth = await readFile(join(directory, "auth.json"), "utf8");
      expect(auth).not.toContain("openai.work");
      expect(auth).toContain("deepseek.personal");
      expect(output.join("\n")).toContain("Logged out credential: openai.work");
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

function promptingOutput(output: string[], answers: string[]) {
  return {
    ...captureOutput(output),
    async prompt(message: string) {
      output.push(`prompt:${message}`);
      return answers.shift() ?? "";
    }
  };
}
