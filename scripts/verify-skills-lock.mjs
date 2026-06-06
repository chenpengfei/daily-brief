#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const lockPath = join(root, "skills-lock.json");
const skillsRoot = join(root, ".agents", "skills");
const localOnlySkills = ["prd-go", "release"];

const failures = [];

if (!existsSync(lockPath)) {
  fail("skills-lock.json is missing");
} else if (!existsSync(skillsRoot)) {
  fail(".agents/skills is missing");
} else {
  verifyLock();
}

if (failures.length > 0) {
  console.error("skills-lock verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

function verifyLock() {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));

  if (lock.version !== 1) fail(`expected lock version 1, got ${String(lock.version)}`);
  if (!lock.skills || typeof lock.skills !== "object" || Array.isArray(lock.skills)) {
    fail("skills must be an object");
    return;
  }

  const entries = Object.entries(lock.skills);
  for (const [name, entry] of entries) verifyEntry(name, entry);

  for (const name of localOnlySkills) {
    const skillPath = join(skillsRoot, name, "SKILL.md");
    if (!existsSync(skillPath)) fail(`local-only skill ${name} is missing ${skillPath}`);
    if (name in lock.skills) fail(`local-only skill ${name} should not be locked as an external source`);
  }

  if (failures.length === 0) {
    console.log(`OK skills-lock.json: ${entries.length} external skill entries verified against .agents/skills`);
    console.log(`OK local-only skills excluded from external lock: ${localOnlySkills.join(", ")}`);
  }
}

function verifyEntry(name, entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    fail(`${name}: entry must be an object`);
    return;
  }

  if (entry.source !== "mattpocock/skills") {
    fail(`${name}: expected source mattpocock/skills, got ${String(entry.source)}`);
  }
  if (entry.sourceType !== "github") {
    fail(`${name}: expected sourceType github, got ${String(entry.sourceType)}`);
  }
  if (typeof entry.skillPath !== "string" || !entry.skillPath.endsWith("/SKILL.md")) {
    fail(`${name}: skillPath must point at a SKILL.md file`);
  }
  if (typeof entry.computedHash !== "string" || !/^[a-f0-9]{64}$/.test(entry.computedHash)) {
    fail(`${name}: computedHash must be a 64-character lowercase sha256 hex digest`);
    return;
  }

  const installedSkillDir = join(skillsRoot, name);
  const installedSkillPath = join(installedSkillDir, "SKILL.md");
  if (!existsSync(installedSkillPath)) {
    fail(`${name}: installed skill is missing ${installedSkillPath}`);
    return;
  }

  const computedHash = computeSkillFolderHash(installedSkillDir);
  if (computedHash !== entry.computedHash) {
    fail(`${name}: computedHash ${entry.computedHash} does not match local folder hash ${computedHash}`);
  }
}

function computeSkillFolderHash(skillDir) {
  const files = [];
  collectFiles(skillDir, skillDir, files);
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.relativePath);
    hash.update(file.content);
  }

  return hash.digest("hex");
}

function collectFiles(baseDir, currentDir, results) {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      collectFiles(baseDir, fullPath, results);
      continue;
    }

    if (entry.isFile()) {
      results.push({
        relativePath: relative(baseDir, fullPath).split("\\").join("/"),
        content: readFileSync(fullPath)
      });
    }
  }
}

function fail(message) {
  failures.push(message);
}
