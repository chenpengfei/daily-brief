import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { putCredential, readCredentialStore, redactCredentialStore, removeCredential } from "../../src/config/index.js";

describe("Daily Brief credential store", () => {
  it("stores multiple credentials by stable reference and redacts status output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-auth-"));
    const authPath = join(directory, "auth.json");

    try {
      putCredential("openai.work", { type: "api-key", provider: "openai", apiKey: "sk-secret" }, authPath);
      putCredential("deepseek.personal", { type: "api-key", provider: "deepseek", apiKey: "deepseek-secret" }, authPath);

      const store = readCredentialStore(authPath);
      const redacted = redactCredentialStore(store);

      expect(Object.keys(store.credentials)).toEqual(["openai.work", "deepseek.personal"]);
      expect(redacted).toEqual({
        "openai.work": { type: "api-key", provider: "openai", secret: "<redacted>" },
        "deepseek.personal": { type: "api-key", provider: "deepseek", secret: "<redacted>" }
      });
      expect(JSON.stringify(redacted)).not.toContain("sk-secret");
      expect(JSON.stringify(redacted)).not.toContain("deepseek-secret");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("removes only the selected credential", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-auth-"));
    const authPath = join(directory, "auth.json");

    try {
      putCredential("openai.work", { type: "api-key", provider: "openai", apiKey: "sk-secret" }, authPath);
      putCredential("deepseek.personal", { type: "api-key", provider: "deepseek", apiKey: "deepseek-secret" }, authPath);

      removeCredential("openai.work", authPath);

      expect(Object.keys(readCredentialStore(authPath).credentials)).toEqual(["deepseek.personal"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
