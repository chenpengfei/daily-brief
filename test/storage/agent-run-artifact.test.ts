import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  agentRunArtifactPath,
  createAgentRunArtifact,
  readAgentRunArtifact,
  writeAgentRunArtifact
} from "../../src/storage/index.js";

describe("Agent Run Artifact store", () => {
  it("writes artifacts under date and unique run id paths without prompt or transcript fields", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-agent-run-"));
    const date = new Date("2026-05-28T07:00:00.000Z");
    const artifact = createAgentRunArtifact({
      date,
      runId: "run-one",
      startedAt: date,
      modelRuntimeConfig: {
        provider: "openai-codex",
        model: "gpt-5.5",
        credentialRef: "openai-codex.default",
        ready: true,
        issues: []
      },
      inputRefs: { sourceItemIds: ["item-1"] }
    });

    try {
      const written = await writeAgentRunArtifact(artifact, date, directory);
      const saved = await readAgentRunArtifact(written.path);
      const serialized = JSON.stringify(saved);

      expect(written.path).toBe(join(directory, "2026", "05", "2026-05-28", "run-one.json"));
      expect(saved).toMatchObject({
        runId: "run-one",
        model: { provider: "openai-codex", model: "gpt-5.5", credentialRef: "openai-codex.default" },
        inputRefs: { sourceItemIds: ["item-1"] }
      });
      expect(serialized).not.toContain("rawPrompt");
      expect(serialized).not.toContain("transcript");
      expect(serialized).not.toContain("streamed");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not overwrite an existing run artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-agent-run-"));
    const date = new Date("2026-05-28T07:00:00.000Z");
    const artifact = createAgentRunArtifact({
      date,
      runId: "same-run",
      modelRuntimeConfig: {
        provider: "faux",
        model: "faux-daily-brief-renderer",
        ready: true,
        issues: []
      }
    });

    try {
      await writeAgentRunArtifact(artifact, date, directory);
      await expect(writeAgentRunArtifact(artifact, date, directory)).rejects.toThrow("EEXIST");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("appends multiple same-date generation attempts under separate run ids", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-agent-run-"));
    const date = new Date("2026-05-28T07:00:00.000Z");
    const artifactInput = {
      date,
      modelRuntimeConfig: {
        provider: "faux" as const,
        model: "faux-daily-brief-renderer",
        ready: true,
        issues: []
      }
    };

    try {
      await mkdir(join(directory, "2026", "05", "2026-05-28"), { recursive: true });
      await writeAgentRunArtifact(createAgentRunArtifact({ ...artifactInput, runId: "run-a" }), date, directory);
      await writeAgentRunArtifact(createAgentRunArtifact({ ...artifactInput, runId: "run-b" }), date, directory);

      await expect(readdir(join(directory, "2026", "05", "2026-05-28"))).resolves.toEqual(["run-a.json", "run-b.json"]);
      expect(agentRunArtifactPath(date, "run-a", directory)).toBe(
        join(directory, "2026", "05", "2026-05-28", "run-a.json")
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
