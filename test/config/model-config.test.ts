import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { readModelConfig, writeModelConfig } from "../../src/config/index.js";

describe("Daily Brief model config", () => {
  it("writes provider, model, and credentialRef without secrets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-model-config-"));
    const configPath = join(directory, "config.yaml");

    try {
      writeModelConfig(
        {
          provider: "openai-codex",
          model: "gpt-5.5",
          credentialRef: "openai-codex.default"
        },
        configPath
      );

      const saved = await readFile(configPath, "utf8");

      expect(readModelConfig(configPath)).toEqual({
        provider: "openai-codex",
        model: "gpt-5.5",
        credentialRef: "openai-codex.default"
      });
      expect(saved).toContain("provider: openai-codex");
      expect(saved).not.toContain("apiKey");
      expect(saved).not.toContain("secret");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves unrelated config while replacing model config", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-model-config-"));
    const configPath = join(directory, "config.yaml");

    try {
      await writeFile(configPath, "ui:\n  language: zh-CN\n", "utf8");

      writeModelConfig(
        {
          provider: "deepseek",
          model: "deepseek-chat",
          credentialRef: "env:DEEPSEEK_API_KEY"
        },
        configPath
      );

      const saved = await readFile(configPath, "utf8");
      expect(saved).toContain("language: zh-CN");
      expect(saved).toContain("provider: deepseek");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects secrets in config.yaml model fields", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-model-config-"));
    const configPath = join(directory, "config.yaml");

    try {
      await writeFile(
        configPath,
        ["model:", "  provider: openai", "  model: gpt-4.1-mini", "  apiKey: secret-value"].join("\n"),
        "utf8"
      );

      expect(() => readModelConfig(configPath)).toThrow("must not contain secrets");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
