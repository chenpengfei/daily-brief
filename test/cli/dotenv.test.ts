import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadDotenvFile } from "../../src/cli.js";

describe("CLI dotenv loading", () => {
  it("loads local .env values without overwriting existing environment variables", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-dotenv-"));
    const dotenvPath = join(directory, ".env");
    const env: Record<string, string | undefined> = {
      DAILY_BRIEF_DATA_HOME: "explicit-data"
    };

    try {
      await writeFile(
        dotenvPath,
        [
          "# Local runtime configuration",
          "DISCORD_WEBHOOK_URL=\"https://discord.example/webhook\"",
          "DAILY_BRIEF_HOME='daily-brief-home'",
          "DAILY_BRIEF_DATA_HOME=env-file-data"
        ].join("\n"),
        "utf8"
      );

      await loadDotenvFile(dotenvPath, env);

      expect(env.DISCORD_WEBHOOK_URL).toBe("https://discord.example/webhook");
      expect(env.DAILY_BRIEF_HOME).toBe("daily-brief-home");
      expect(env.DAILY_BRIEF_DATA_HOME).toBe("explicit-data");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does nothing when the local .env file is absent", async () => {
    const env: Record<string, string | undefined> = {};

    await expect(loadDotenvFile("/path/that/does/not/exist/.env", env)).resolves.toBeUndefined();
    expect(env).toEqual({});
  });
});
