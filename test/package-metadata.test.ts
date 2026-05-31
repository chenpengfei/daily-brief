import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isCliEntrypoint } from "../src/cli.js";

describe("package metadata", () => {
  it("exposes the installed daily-brief CLI and package files", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8")) as {
      private?: boolean;
      bin?: Record<string, string>;
      files?: string[];
    };

    expect(pkg.private).toBe(false);
    expect(pkg.bin).toEqual({ "daily-brief": "dist/src/cli.js" });
    expect(pkg.files).toEqual(
      expect.arrayContaining(["dist/src", "config/sources.example.yaml", "templates", "docs/operations.md"])
    );
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
