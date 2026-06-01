import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isCliEntrypoint } from "../src/cli.js";

describe("package metadata", () => {
  it("exposes the installed daily-brief CLI and package files", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8")) as {
      name?: string;
      description?: string;
      license?: string;
      homepage?: string;
      bugs?: { url?: string };
      repository?: { type?: string; url?: string };
      publishConfig?: { access?: string };
      keywords?: string[];
      private?: boolean;
      bin?: Record<string, string>;
      files?: string[];
      scripts?: Record<string, string>;
    };

    expect(pkg.name).toBe("@chenpengfei/daily-brief");
    expect(pkg.description).toContain("Agent-driven daily brief CLI");
    expect(pkg.license).toBe("MIT");
    expect(pkg.homepage).toBe("https://github.com/chenpengfei/daily-brief#readme");
    expect(pkg.bugs?.url).toBe("https://github.com/chenpengfei/daily-brief/issues");
    expect(pkg.repository).toEqual({
      type: "git",
      url: "git+https://github.com/chenpengfei/daily-brief.git"
    });
    expect(pkg.publishConfig?.access).toBe("public");
    expect(pkg.keywords).toEqual(expect.arrayContaining(["agent", "daily-brief", "cli", "ai-coding"]));
    expect(pkg.private).toBe(false);
    expect(pkg.bin).toEqual({ "daily-brief": "dist/src/cli.js" });
    expect(pkg.files).toEqual(
      expect.arrayContaining([
        "dist/src",
        "config/sources.example.yaml",
        "templates",
        "docs/operations.md",
        "docs/user-manual.md",
        "docs/release-workflow.md",
        "README.md",
        "CHANGELOG.md"
      ])
    );
    expect(pkg.scripts?.["release:check"]).toBe("npm test && npm run typecheck && npm run build && npm pack --dry-run");
    expect(pkg.scripts?.["release:publish:dry-run"]).toBe("npm publish --dry-run --access public");
  });

  it("treats npm bin symlinks as the CLI entrypoint", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-bin-"));
    const target = join(directory, "cli.js");
    const link = join(directory, "daily-brief");

    await writeFile(target, "#!/usr/bin/env node\n");
    await symlink(target, link);

    await expect(isCliEntrypoint(link, pathToFileURL(target).href)).resolves.toBe(true);
  });
});
