#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const version = args.version ?? packageJson.version;
const tag = `v${version}`;
const packageName = packageJson.name;
const notesFile = args.notesFile ?? join(tmpdir(), "daily-brief-release-notes.md");
const publish = Boolean(args.publish);

const failures = [];
const evidence = [];

info(`Human Release Gate for ${packageName}@${version} (${tag})`);

if (packageJson.version !== version) {
  fail(`package.json version is ${packageJson.version}, expected ${version}`);
}

const notes = extractChangelogEntry(version);
writeFileSync(notesFile, notes, "utf8");
ok(`release notes prepared: ${notesFile}`);

checkGitState();
checkGitHubState();
checkNpmState();

if (publish && !args.yes) {
  fail("publishing requires --yes as an explicit human confirmation");
}

if (failures.length > 0) {
  printFailures();
  process.exit(1);
}

if (!publish) {
  ok("preflight passed; no publication commands were run");
  info(`publish command: npm run release:human -- --version ${version} --publish --yes`);
  process.exit(0);
}

info("Running final release check before publication");
mustRun("npm", ["run", "release:check"]);

info("Publishing release artifacts");
mustRun("git", ["tag", "-a", tag, "-m", tag]);
mustRun("git", ["push", "origin", tag]);
mustRun("npm", ["publish", "--access", "public"]);
mustRun("gh", ["release", "create", tag, "--verify-tag", "--title", tag, "--notes-file", notesFile]);

const publicVersion = mustPreflight("npm", ["view", packageName, "version"]).stdout.trim();
if (publicVersion !== version) {
  fail(`public npm version is ${publicVersion}, expected ${version}`);
  printFailures();
  process.exit(1);
}
ok(`npm registry version verified: ${publicVersion}`);

const smokePrefix = mkdtempSync(join(tmpdir(), "daily-brief-public-smoke-"));
try {
  mustRun("npm", ["install", "--prefix", smokePrefix, "-g", `${packageName}@${version}`, "--no-audit", "--no-fund"]);
  mustRun(join(smokePrefix, "bin", "daily-brief"), ["--help"]);
  ok(`public install smoke passed: ${smokePrefix}`);
} finally {
  if (!args.keepSmokeDir) {
    rmSync(smokePrefix, { recursive: true, force: true });
  }
}

if (args.issue) {
  const body = [
    `Human Release Gate completed for ${tag}.`,
    "",
    `- npm package: \`${packageName}@${version}\``,
    `- Git tag: \`${tag}\``,
    `- GitHub Release: https://github.com/chenpengfei/daily-brief/releases/tag/${tag}`,
    `- Release notes: \`${notesFile}\``,
    "- Public install smoke: passed"
  ].join("\n");
  mustRun("gh", ["issue", "comment", String(args.issue), "--body", body]);
}

ok(`release completed: ${tag}`);

function checkGitState() {
  mustPreflight("git", ["fetch", "origin", "main:refs/remotes/origin/main", "--tags"]);

  const branch = output("git", ["branch", "--show-current"]).trim();
  if (branch !== "main") {
    fail(`current branch is ${branch || "(detached)"}, expected main`);
  } else {
    ok("current branch is main");
  }

  const status = output("git", ["status", "--porcelain"]);
  if (status.trim() !== "") {
    fail("working tree is not clean");
  } else {
    ok("working tree is clean");
  }

  const head = output("git", ["rev-parse", "HEAD"]).trim();
  const originMain = output("git", ["rev-parse", "origin/main"]).trim();
  if (head !== originMain) {
    fail(`HEAD ${head} does not match origin/main ${originMain}`);
  } else {
    ok(`main matches origin/main: ${head}`);
  }

  const localTag = output("git", ["tag", "-l", tag]).trim();
  if (localTag !== "") {
    fail(`local tag already exists: ${tag}`);
  } else {
    ok(`local tag is absent: ${tag}`);
  }

  const remoteTag = output("git", ["ls-remote", "--tags", "origin", tag]).trim();
  if (remoteTag !== "") {
    fail(`remote tag already exists: ${tag}`);
  } else {
    ok(`remote tag is absent: ${tag}`);
  }
}

function checkGitHubState() {
  mustPreflight("gh", ["auth", "status"]);

  const release = run("gh", ["release", "view", tag, "--json", "tagName,url"]);
  if (release.status === 0) {
    fail(`GitHub Release already exists for ${tag}`);
  } else {
    ok(`GitHub Release is absent: ${tag}`);
  }

  const head = output("git", ["rev-parse", "HEAD"]).trim();
  const runs = mustPreflight("gh", [
    "run",
    "list",
    "--branch",
    "main",
    "--commit",
    head,
    "--json",
    "status,conclusion,url,headSha",
    "--limit",
    "10"
  ]).stdout;
  const parsedRuns = JSON.parse(runs);
  const successfulRun = parsedRuns.find((runItem) => runItem.status === "completed" && runItem.conclusion === "success");
  if (!successfulRun) {
    fail(`no successful GitHub Actions run found for main commit ${head}`);
  } else {
    ok(`main CI passed: ${successfulRun.url}`);
  }
}

function checkNpmState() {
  mustPreflight("npm", ["whoami"]);

  const view = run("npm", ["view", packageName, "version"]);
  if (view.status === 0) {
    const publishedVersion = view.stdout.trim();
    if (compareSemver(publishedVersion, version) >= 0) {
      fail(`npm registry already has ${packageName}@${publishedVersion}; target is ${version}`);
    } else {
      ok(`npm registry currently has ${publishedVersion}, lower than target ${version}`);
    }
    return;
  }

  const outputText = `${view.stdout}\n${view.stderr}`;
  if (outputText.includes("E404") || outputText.includes("Not Found")) {
    ok(`npm registry has no published ${packageName}; first release state confirmed`);
    return;
  }

  fail(`npm package state check failed: ${outputText.trim()}`);
}

function extractChangelogEntry(targetVersion) {
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  const heading = `## ${targetVersion}`;
  const start = changelog.indexOf(heading);
  if (start === -1) {
    fail(`CHANGELOG.md has no entry for ${targetVersion}`);
    return "";
  }

  const next = changelog.indexOf("\n## ", start + heading.length);
  return changelog.slice(start, next === -1 ? changelog.length : next).trim() + "\n";
}

function output(command, commandArgs) {
  return mustPreflight(command, commandArgs).stdout;
}

function mustPreflight(command, commandArgs) {
  const result = run(command, commandArgs);
  if (result.status !== 0) {
    fail(`${commandLine(command, commandArgs)} failed with exit ${result.status}: ${result.stderr || result.stdout}`);
  }
  return result;
}

function mustRun(command, commandArgs) {
  const result = run(command, commandArgs, { inherit: true });
  if (result.status !== 0) {
    throw new Error(`${commandLine(command, commandArgs)} failed with exit ${result.status}`);
  }
  return result;
}

function run(command, commandArgs, options = {}) {
  const inherit = options.inherit ?? false;
  evidence.push(commandLine(command, commandArgs));
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe"
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--publish") parsed.publish = true;
    else if (arg === "--yes") parsed.yes = true;
    else if (arg === "--keep-smoke-dir") parsed.keepSmokeDir = true;
    else if (arg === "--version") parsed.version = readValue(argv, ++index, arg);
    else if (arg === "--notes-file") parsed.notesFile = readValue(argv, ++index, arg);
    else if (arg === "--issue") parsed.issue = readValue(argv, ++index, arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function readValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function compareSemver(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function commandLine(command, commandArgs) {
  return [command, ...commandArgs].join(" ");
}

function ok(message) {
  console.log(`OK ${message}`);
}

function info(message) {
  console.log(`==> ${message}`);
}

function fail(message) {
  failures.push(message.trim());
}

function printFailures() {
  console.error("\nHuman Release Gate blocked:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
}

function printHelp() {
  console.log(`Human Release Gate helper

Usage:
  npm run release:human
  npm run release:human -- --version 0.1.0
  npm run release:human -- --version 0.1.0 --publish --yes

Options:
  --version <X.Y.Z>       Release version. Defaults to package.json version.
  --notes-file <path>     Release notes path. Defaults to the OS temp directory.
  --issue <number>        Comment final publication evidence on a GitHub issue.
  --publish               Run tag, npm publish, GitHub Release, and public smoke test.
  --yes                   Required with --publish.
  --keep-smoke-dir        Keep the temporary public install smoke directory.
  --help                  Show this help.
`);
}
