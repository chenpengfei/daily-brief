import { describe, expect, it } from "vitest";
import { generateOnce, readModelRuntimeConfig } from "../../src/agent/index.js";
import { parseSourceRegistry } from "../../src/domain/index.js";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("model runtime configuration", () => {
  it("uses the faux provider by default so tests do not require live model secrets", () => {
    expect(readModelRuntimeConfig({})).toEqual({
      provider: "faux",
      model: "faux-daily-brief-renderer",
      ready: true,
      issues: []
    });
  });

  it("parses an OpenAI production contract without exposing the secret value", () => {
    const config = readModelRuntimeConfig({
      DAILY_BRIEF_MODEL_PROVIDER: "openai",
      DAILY_BRIEF_MODEL: "gpt-4.1-mini",
      OPENAI_API_KEY: "secret-value"
    });

    expect(config).toEqual({
      provider: "openai",
      model: "gpt-4.1-mini",
      secretEnvName: "OPENAI_API_KEY",
      ready: true,
      issues: []
    });
    expect(JSON.stringify(config)).not.toContain("secret-value");
  });

  it("reports missing provider secrets without reading Source Registry fields", () => {
    expect(
      readModelRuntimeConfig({
        DAILY_BRIEF_MODEL_PROVIDER: "openai",
        DAILY_BRIEF_MODEL: "gpt-4.1-mini"
      })
    ).toEqual({
      provider: "openai",
      model: "gpt-4.1-mini",
      secretEnvName: "OPENAI_API_KEY",
      ready: false,
      issues: ["OPENAI_API_KEY is required when DAILY_BRIEF_MODEL_PROVIDER=openai"]
    });
  });

  it("keeps model and secret fields out of the Source Registry contract", () => {
    expect(() =>
      parseSourceRegistry({
        sources: [
          {
            id: "blog",
            platform: "blog",
            adapter: "rss",
            target: "https://example.com/feed.xml",
            enabled: true,
            notes: "Example feed",
            model: "gpt-4.1-mini",
            secret: "OPENAI_API_KEY"
          }
        ]
      })
    ).toThrow(/model is not allowed|secret is not allowed/);
  });

  it("reports the model runtime config used by brief generation without leaking secrets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-model-config-"));

    try {
      const result = await generateOnce({
        date: new Date("2026-05-28T07:00:00.000Z"),
        sourceItemRoot: join(directory, "source-items"),
        archiveRoot: join(directory, "briefs"),
        modelRuntimeEnv: {
          DAILY_BRIEF_MODEL_PROVIDER: "openai",
          DAILY_BRIEF_MODEL: "gpt-4.1-mini",
          OPENAI_API_KEY: "secret-value"
        }
      });

      expect(result.modelRuntimeConfig).toEqual({
        provider: "openai",
        model: "gpt-4.1-mini",
        secretEnvName: "OPENAI_API_KEY",
        ready: true,
        issues: []
      });
      expect(JSON.stringify(result)).not.toContain("secret-value");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
