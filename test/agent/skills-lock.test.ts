import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("skills lockfile", () => {
  it("verifies external skill hashes and local-only skill exclusions", () => {
    const result = spawnSync(process.execPath, ["scripts/verify-skills-lock.mjs"], {
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK skills-lock.json:");
    expect(result.stdout).toContain("OK local-only skills excluded from external lock: prd-go, release");
    expect(result.stderr).toBe("");
  });
});
