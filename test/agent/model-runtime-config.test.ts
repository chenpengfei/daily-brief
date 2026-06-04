import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  generateOnce,
  buildOpenAICompatibleModel,
  loginModelCredential,
  readModelRuntimeConfig,
  resolveModelApiKey,
  type OAuthHelpers
} from "../../src/agent/index.js";
import { parseSourceRegistry } from "../../src/domain/index.js";
import { putCredential, writeModelConfig } from "../../src/config/index.js";
import { appendSourceItems } from "../../src/storage/index.js";

describe("model runtime configuration", () => {
  it("requires an explicit model config by default instead of falling back to faux", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-missing-model-runtime-"));

    try {
      expect(readModelRuntimeConfig({ DAILY_BRIEF_HOME: directory })).toEqual({
        provider: "openai-codex",
        model: "gpt-5.5",
        credentialRef: "openai-codex.default",
        ready: false,
        issues: expect.arrayContaining([expect.stringContaining("Model config not found")])
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("allows faux through an explicit test config file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-faux-model-runtime-"));

    try {
      writeModelConfig(
        {
          provider: "faux",
          model: "faux-daily-brief-renderer"
        },
        join(directory, "config.yaml")
      );

      expect(readModelRuntimeConfig({ DAILY_BRIEF_HOME: directory })).toEqual({
        provider: "faux",
        model: "faux-daily-brief-renderer",
        ready: true,
        issues: []
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reads provider config from user config.yaml and resolves stored credential refs without exposing secrets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-model-runtime-"));
    const authPath = join(directory, "auth.json");

    try {
      writeModelConfig(
        {
          provider: "openai",
          model: "gpt-4.1-mini",
          credentialRef: "openai.default"
        },
        join(directory, "config.yaml")
      );
      putCredential("openai.default", { type: "api-key", provider: "openai", apiKey: "secret-value" }, authPath);

      const config = readModelRuntimeConfig(
        { DAILY_BRIEF_HOME: directory },
        { configPath: join(directory, "config.yaml"), authPath }
      );

      expect(config).toEqual({
        provider: "openai",
        model: "gpt-4.1-mini",
        credentialRef: "openai.default",
        ready: true,
        issues: []
      });
      expect(await resolveModelApiKey(config, { DAILY_BRIEF_HOME: directory }, { authPath })).toBe("secret-value");
      expect(JSON.stringify(config)).not.toContain("secret-value");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports missing provider credentials through credentialRef", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-model-runtime-"));

    try {
      writeModelConfig(
        {
          provider: "openai",
          model: "gpt-4.1-mini",
          credentialRef: "openai.default"
        },
        join(directory, "config.yaml")
      );

      expect(readModelRuntimeConfig({ DAILY_BRIEF_HOME: directory })).toEqual({
        provider: "openai",
        model: "gpt-4.1-mini",
        credentialRef: "openai.default",
        ready: false,
        issues: ["Credential not found: openai.default"]
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("builds openai-compatible models with the configured baseUrl", () => {
    expect(buildOpenAICompatibleModel({ model: "deepseek-chat", baseUrl: "https://api.deepseek.com/v1" })).toMatchObject({
      provider: "openai-compatible",
      api: "openai-completions",
      id: "deepseek-chat",
      baseUrl: "https://api.deepseek.com/v1"
    });
  });

  it("uses the selected stored credentialRef without deleting unused credentials", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-model-runtime-"));
    const authPath = join(directory, "auth.json");

    try {
      putCredential("openai.work", { type: "api-key", provider: "openai", apiKey: "work-secret" }, authPath);
      putCredential("openai.personal", { type: "api-key", provider: "openai", apiKey: "personal-secret" }, authPath);

      const config = {
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        credentialRef: "openai.personal",
        ready: true,
        issues: []
      };

      expect(await resolveModelApiKey(config, {}, { authPath })).toBe("personal-secret");
      expect(await resolveModelApiKey({ ...config, credentialRef: "openai.work" }, {}, { authPath })).toBe("work-secret");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("uses Pi OAuth helpers for openai-codex login and token resolution", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-model-runtime-"));
    const authPath = join(directory, "auth.json");
    const calls: string[] = [];
    const helpers: OAuthHelpers = {
      async loginOpenAICodex() {
        calls.push("loginOpenAICodex");
        return {
          access: "oauth-access",
          refresh: "oauth-refresh",
          expires: Date.now() + 60_000
        };
      },
      async getOAuthApiKey(providerId, credentials) {
        calls.push(`getOAuthApiKey:${providerId}:${credentials["openai-codex"]?.access}`);
        return {
          apiKey: "fresh-access-token",
          newCredentials: {
            access: "fresh-access",
            refresh: "oauth-refresh",
            expires: Date.now() + 120_000
          }
        };
      }
    };

    try {
      await loginModelCredential({
        provider: "openai-codex",
        credentialRef: "openai-codex.default",
        io: { stdout() {} },
        authPath,
        oauthHelpers: helpers
      });

      const config = {
        provider: "openai-codex" as const,
        model: "gpt-5.5",
        credentialRef: "openai-codex.default",
        ready: true,
        issues: []
      };

      expect(await resolveModelApiKey(config, {}, { authPath, oauthHelpers: helpers })).toBe("fresh-access-token");
      expect(calls).toEqual(["loginOpenAICodex", "getOAuthApiKey:openai-codex:oauth-access"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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
            secret: "provider-secret"
          }
        ]
      })
    ).toThrow(/model is not allowed|secret is not allowed/);
  });

  it("reports the model runtime config used by brief generation without leaking secrets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-model-runtime-"));

    try {
      const date = new Date("2026-05-28T07:00:00.000Z");
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
        join(directory, "source-items")
      );
      writeModelConfig(
        {
          provider: "faux",
          model: "faux-daily-brief-renderer"
        },
        join(directory, "config.yaml")
      );

      const result = await generateOnce({
        date,
        sourceItemRoot: join(directory, "source-items"),
        archiveRoot: join(directory, "briefs"),
        modelRuntimeEnv: { DAILY_BRIEF_HOME: directory }
      });

      expect(result.modelRuntimeConfig).toEqual({
        provider: "faux",
        model: "faux-daily-brief-renderer",
        ready: true,
        issues: []
      });
      expect(JSON.stringify(result)).not.toContain("secret-value");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
