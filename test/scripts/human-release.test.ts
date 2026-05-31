import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("../../scripts/human-release.mjs", import.meta.url));

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Human Release helper", () => {
  it("passes preflight when GitHub reports the release is not found", async () => {
    const workspace = await createWorkspace();

    const result = runHumanRelease(workspace, "not-found");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK GitHub Release is absent: v0.1.0");
    expect(result.stdout).toContain("OK preflight passed; no publication commands were run");
  });

  it("blocks preflight when the GitHub Release already exists", async () => {
    const workspace = await createWorkspace();

    const result = runHumanRelease(workspace, "exists");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("GitHub Release already exists for v0.1.0");
    expect(result.stdout).not.toContain("OK preflight passed; no publication commands were run");
  });

  it("blocks preflight when GitHub Release state cannot be checked", async () => {
    const workspace = await createWorkspace();

    const result = runHumanRelease(workspace, "api-error");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("GitHub Release state check failed for v0.1.0");
    expect(result.stderr).toContain("GraphQL: service unavailable");
    expect(result.stdout).not.toContain("OK GitHub Release is absent: v0.1.0");
    expect(result.stdout).not.toContain("OK preflight passed; no publication commands were run");
  });
});

async function createWorkspace(): Promise<{ root: string; bin: string; notesFile: string }> {
  const root = await mkdtemp(join(tmpdir(), "daily-brief-human-release-test-"));
  tempDirectories.push(root);

  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "@chenpengfei/daily-brief", version: "0.1.0" }, null, 2),
    "utf8"
  );
  await writeFile(
    join(root, "CHANGELOG.md"),
    [
      "# Changelog",
      "",
      "## 0.1.0 - 2026-05-31",
      "",
      "Initial Formal Release.",
      "",
      "### User-visible Changes",
      "",
      "- Ships the CLI."
    ].join("\n"),
    "utf8"
  );

  const bin = join(root, "bin");
  await writeExecutable(join(bin, "git"), fakeGitScript());
  await writeExecutable(join(bin, "gh"), fakeGhScript());
  await writeExecutable(join(bin, "npm"), fakeNpmScript());

  return { root, bin, notesFile: join(root, "release-notes.md") };
}

function runHumanRelease(workspace: { root: string; bin: string; notesFile: string }, releaseViewMode: string) {
  return spawnSync(process.execPath, [scriptPath, "--version", "0.1.0", "--notes-file", workspace.notesFile], {
    cwd: workspace.root,
    encoding: "utf8",
    env: {
      ...process.env,
      FAKE_GH_RELEASE_VIEW: releaseViewMode,
      PATH: `${workspace.bin}${delimiter}${process.env.PATH ?? ""}`
    }
  });
}

async function writeExecutable(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
  await chmod(path, 0o755);
}

function fakeGitScript(): string {
  return `#!/bin/sh
if [ "$1" = "fetch" ]; then exit 0; fi
if [ "$1" = "branch" ] && [ "$2" = "--show-current" ]; then echo "main"; exit 0; fi
if [ "$1" = "status" ] && [ "$2" = "--porcelain" ]; then exit 0; fi
if [ "$1" = "rev-parse" ] && [ "$2" = "HEAD" ]; then echo "abc123"; exit 0; fi
if [ "$1" = "rev-parse" ] && [ "$2" = "origin/main" ]; then echo "abc123"; exit 0; fi
if [ "$1" = "tag" ] && [ "$2" = "-l" ]; then exit 0; fi
if [ "$1" = "ls-remote" ]; then exit 0; fi
echo "unexpected git command: $*" >&2
exit 2
`;
}

function fakeGhScript(): string {
  return `#!/bin/sh
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then echo "Logged in"; exit 0; fi
if [ "$1" = "release" ] && [ "$2" = "view" ]; then
  if [ "$FAKE_GH_RELEASE_VIEW" = "exists" ]; then echo '{"tagName":"v0.1.0","url":"https://example.test/release"}'; exit 0; fi
  if [ "$FAKE_GH_RELEASE_VIEW" = "not-found" ]; then echo "release not found" >&2; exit 1; fi
  if [ "$FAKE_GH_RELEASE_VIEW" = "api-error" ]; then echo "GraphQL: service unavailable" >&2; exit 1; fi
fi
if [ "$1" = "run" ] && [ "$2" = "list" ]; then echo '[{"status":"completed","conclusion":"success","url":"https://example.test/ci"}]'; exit 0; fi
echo "unexpected gh command: $*" >&2
exit 2
`;
}

function fakeNpmScript(): string {
  return `#!/bin/sh
if [ "$1" = "whoami" ]; then echo "chenpengfei"; exit 0; fi
if [ "$1" = "view" ]; then echo "npm error code E404" >&2; echo "npm error 404 Not Found" >&2; exit 1; fi
echo "unexpected npm command: $*" >&2
exit 2
`;
}
