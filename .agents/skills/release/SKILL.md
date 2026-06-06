---
name: release
description: Run Daily Brief releases through the three human-triggered gates, with GitHub Release, npm publish, PR closure, and evidence capture. Use when the user asks to prepare, review, publish, close, or recover a release or formal release, mentions Release Gates, GitHub Release, npm registry, npm publish, release PRs, or versioned Daily Brief releases.
---

# Release

Use this skill to drive Daily Brief releases without skipping gates or losing evidence.

## Quick Start

1. Read `docs/release-workflow.md`, `CHANGELOG.md`, `package.json`, and `scripts/human-release.mjs`.
2. Identify the release state before asking the user to choose a gate:
   - If the user gave a version, PR, issue, tag, or failure, inspect it and recommend the next valid step.
   - If state is discoverable, present the recommendation instead of a generic gate menu.
   - If state is not discoverable, ask for the smallest missing identifier, such as version, Release PR, or checklist issue.
3. Identify the user's requested gate, but treat it as a claimed stage to verify, not permission to skip prerequisites:
   - Gate 1: Agent Release Preparation.
   - Gate 2: Agent Release Review.
   - Gate 3: Human Release.
   - Recovery: resume after npm authentication, npm 2FA, GitHub Release, or smoke-test interruption.
4. Keep publication commands behind Gate 3 only.
5. Record evidence in the Release Checklist Issue, Release PR, or PR closure comment.

See [REFERENCE.md](REFERENCE.md) for command checklists, evidence templates, and recovery paths.

## Gate Discipline

- Treat all gates as human-triggered. Do not move from one gate to the next unless the user asks.
- A requested gate is not a bypass. Validate all earlier gate evidence and current release state before acting.
- Prefer guided next-step recommendations over a static gate menu. Say what you detected, what is blocked, and what the next human action should be.
- Never run `npm publish`, create a GitHub Release, or push a release tag before Gate 3.
- Never describe a release as published or complete merely because the Release PR is merged or preflight passed.
- Do not treat a generic "continue" as publish confirmation; require explicit wording such as `confirm publish vX.Y.Z` before running an irreversible publish command.
- Do not use GitHub auto-close keywords for Release Checklist Issues in Release PR bodies. Link them without `Closes`, `Fixes`, or `Resolves`; close the issue only after the Closure Standard is met.
- Keep Release PRs focused on release materials unless a minimal Release-Blocking Fix is explicitly documented.
- Published npm versions and GitHub tags are immutable. Recover with follow-up release work, not silent mutation.
- Prefer existing repo automation, especially `npm run release:check`, `npm run release:publish:dry-run`, and `npm run release:human`; run release checks with temporary `DAILY_BRIEF_HOME` and `DAILY_BRIEF_DATA_HOME` so tests cannot use real user delivery config.

## Release State Triage

When the user says "continue", asks what to do next, or requests a later gate, first determine the current release state:

1. Find the target version, Release Checklist Issue, Release PR, current branch, package version, npm registry version, tags, GitHub Release, and CI state.
2. Recommend the next valid step:
   - No release issue/PR for the target version: Gate 1 Preparation.
   - Release PR open and evidence ready: Gate 2 Review.
   - Release PR unmerged: merge or satisfy branch protection before Gate 3; keep the checklist issue open.
   - PR merged but npm auth/preflight blocked: Recovery for the exact blocker.
   - Preflight clean but not published: ask for explicit Human Release publish confirmation.
   - npm published but GitHub Release/tag/smoke incomplete: Recovery from the exact completed step.
3. If the user asks for Gate 3 directly, verify Gate 1 evidence, Gate 2 review or explicit acceptance, merged PR, clean `main`, green CI, npm state, absent tag/release, and npm auth before any publish command.

## Gate 1: Preparation

When the user asks to prepare a release:

1. Create or update the Release Checklist Issue.
2. Create a release branch and Release PR.
   - Link the checklist issue as `Release Checklist Issue: #N`, not `Closes #N`.
3. Update package version metadata, `CHANGELOG.md`, user docs, and release docs as needed.
4. Run release checks, dry-run publish, and isolated install smoke tests.
5. Add evidence and blockers to the issue and PR.

Stop before publication. Ask for or wait for Agent Release Review.

## Gate 2: Review

When the user asks for Agent Release Review:

1. Review the Release Checklist Issue, Release PR diff, CI, docs, package metadata, and local evidence.
2. Lead with blocking findings, then non-blocking findings and residual risk.
3. Explicitly review any Release-Blocking Fix exception.
4. Do not publish and do not review your own preparation work when avoidable.

## Gate 3: Human Release

When the user confirms Human Release:

1. Merge or verify the release PR is merged.
2. Ensure local `main` matches `origin/main`, the working tree is clean, and CI is green on the merged commit.
3. Run preflight: `npm run release:human -- --version X.Y.Z`.
4. If preflight blocks on npm authentication (`npm whoami` `E401`, expired login, missing credentials, or 2FA), actively guide the maintainer through npm login before continuing; do not merely say "authenticate npm". See [REFERENCE.md](REFERENCE.md).
5. After explicit publish confirmation, run: `npm run release:human -- --version X.Y.Z --publish --yes --issue <issue>`.
6. If npm 2FA blocks publish, recover with browser/Security Key auth (`npm publish --access public --auth-type=web`) instead of OTP, then resume from the exact remaining release step.
7. Verify npm latest, GitHub Release, tag, and public install smoke.
8. Comment final evidence on the Release Checklist Issue and release PR.
9. Close the Release Checklist Issue only after the Closure Standard is satisfied.

## Closure Standard

A release is closed only when these are true:

- npm registry has `@chenpengfei/daily-brief@X.Y.Z` and `latest` points to `X.Y.Z`.
- GitHub tag and GitHub Release `vX.Y.Z` exist and are not draft/prerelease unless requested.
- Public npm install smoke passes from a clean temporary prefix.
- Release issue or PR contains final publication evidence.
- `git status --short --branch` is clean or any residual changes are explained.
