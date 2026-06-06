# Release Reference

This reference captures the operational details for the `release` skill. Use it with `docs/release-workflow.md`; if they diverge, trust the repo doc and update this skill.

## Required Context

Read these first:

- `docs/release-workflow.md`
- `scripts/human-release.mjs`
- `CHANGELOG.md`
- `package.json`
- The Release Checklist Issue and Release PR, when present

Useful issue docs:

- `docs/agents/issue-tracker.md`
- `docs/agents/goal-issues.md`

## Release State Triage

Use this before showing a gate menu, when the user says "continue", or when the user asks for Gate 2, Gate 3, or recovery without full context.

Collect identifiers from the user request and local/GitHub state:

```sh
git status --short --branch
git branch --show-current
git log --oneline --decorate -8
node -p "require('./package.json').version"
gh issue list --search '"Release vX.Y.Z" in:title' --state all --json number,title,state,url
gh pr list --search 'vX.Y.Z' --state all --json number,title,state,url,headRefName,baseRefName,mergedAt
npm view @chenpengfei/daily-brief version dist-tags.latest
git ls-remote --tags origin vX.Y.Z
gh release view vX.Y.Z --json tagName,url,isDraft,isPrerelease,publishedAt
```

Then present a guided recommendation:

```md
Detected release state for vX.Y.Z:

- Release issue:
- Release PR:
- Package version:
- npm latest:
- Tag/GitHub Release:
- CI:
- Current blocker:

Recommended next step: <Gate 1 | Gate 2 | Gate 3 preflight | Recovery: exact blocker>.
I will not run publish/tag/release commands unless Gate 3 preconditions pass and you explicitly confirm publication.
```

Gate requests must be verified:

- Gate 1 is valid when no prepared release PR/checklist exists, or the user asks to start/update preparation for a new target version.
- Gate 2 is valid when a Release PR and checklist issue exist and Gate 1 evidence is recorded.
- Gate 3 is valid only after the Release PR is merged, Gate 1 evidence exists, Gate 2 review is complete or explicitly accepted by the maintainer, local `main` matches `origin/main`, CI is green, npm registry is below target, tag/release are absent, and npm authentication is ready.
- Recovery is valid when any publication-adjacent step is partially complete or blocked; always inspect completed steps before rerunning commands.

Never treat "Gate 3" as permission to skip missing prerequisites. If prerequisites fail, report the exact blocker and recommend the earlier gate or recovery step.

Use precise release-state language:

- "Release PR merged" means source release materials reached `main`.
- "Preflight passed" means publication is ready but has not happened.
- "Published" means npm registry, GitHub tag/release, and public install smoke are verified.
- "Closed" means the Release Checklist Issue has final publication evidence and the Closure Standard is met.

Do not call a release "published", "released", or "complete" until all Closure Standard checks pass.

## Gate 1 Preparation Checklist

Commands and checks:

```sh
git status --short --branch
DAILY_BRIEF_HOME=/tmp/daily-brief-release-home-<id> DAILY_BRIEF_DATA_HOME=/tmp/daily-brief-release-data-<id> npm run release:check
DAILY_BRIEF_HOME=/tmp/daily-brief-release-home-<id> DAILY_BRIEF_DATA_HOME=/tmp/daily-brief-release-data-<id> npm run release:publish:dry-run
npm pack
npm install --prefix /tmp/daily-brief-smoke-<id> -g ./chenpengfei-daily-brief-X.Y.Z.tgz --no-audit --no-fund
DAILY_BRIEF_HOME=/tmp/daily-brief-home-<id> DAILY_BRIEF_DATA_HOME=/tmp/daily-brief-data-<id> /tmp/daily-brief-smoke-<id>/bin/daily-brief --help
```

Use unique temporary `DAILY_BRIEF_HOME` and `DAILY_BRIEF_DATA_HOME` values for any command that can execute tests or workflow code. This prevents release checks from reading the maintainer's real `~/.daily-brief/config.yaml` / `auth.json` and sending real Discord notifications.

Evidence to record:

- Target version and tag.
- Package metadata changes.
- Changelog entry.
- User manual changes or explicit "not needed".
- Release workflow changes or explicit "not needed".
- `release:check` output summary.
- publish dry-run summary.
- isolated install smoke summary.
- npm registry state before publish.
- blockers and Release-Blocking Fix exceptions.

Release PR body rule:

- Link the checklist as `Release Checklist Issue: #N`.
- Do not write `Closes #N`, `Fixes #N`, `Resolves #N`, or any auto-close keyword for the Release Checklist Issue.
- If the PR body accidentally contains an auto-close keyword, edit it before merge.
- The checklist issue stays open after PR merge and closes only after final publication evidence is recorded.

Safe PR body wording:

```md
Release Checklist Issue: #N
```

Unsafe PR body wording:

```md
Closes #N
Fixes #N
Resolves #N
```

## Gate 2 Review Checklist

Inspect:

- Release Checklist Issue evidence.
- Release PR diff and commits.
- `package.json` and `package-lock.json`.
- `CHANGELOG.md`.
- `docs/user-manual.md`.
- `docs/release-workflow.md`.
- CI workflow result.
- local evidence for `release:check`, dry-run publish, and install smoke.
- any Release-Blocking Fix exception.

Report in this order:

1. Blocking findings with file or issue references.
2. Non-blocking findings.
3. Open questions or assumptions.
4. Recommendation: approve, approve with notes, or request fixes.

## Gate 3 Human Release Checklist

Before publishing:

```sh
git switch main
git pull --ff-only
git status --short --branch
npm view @chenpengfei/daily-brief version dist-tags.latest
gh release view vX.Y.Z
git ls-remote --tags origin vX.Y.Z
DAILY_BRIEF_HOME=/tmp/daily-brief-release-home-<id> DAILY_BRIEF_DATA_HOME=/tmp/daily-brief-release-data-<id> npm run release:human -- --version X.Y.Z
```

If preflight stops on npm authentication, run the active handoff below before asking the maintainer to say "continue".

Publish only after human confirmation:

```sh
DAILY_BRIEF_HOME=/tmp/daily-brief-release-home-<id> DAILY_BRIEF_DATA_HOME=/tmp/daily-brief-release-data-<id> npm run release:human -- --version X.Y.Z --publish --yes --issue <release-checklist-issue-number>
```

Before running the publish command, state the exact command and require an explicit human confirmation such as `confirm publish vX.Y.Z`. A generic `continue` is enough for preflight and recovery checks, but not enough for the irreversible publish step.

Final verification:

```sh
npm view @chenpengfei/daily-brief version dist-tags.latest
gh release view vX.Y.Z --json tagName,url,isDraft,isPrerelease,publishedAt
git tag --points-at HEAD
git status --short --branch
```

Public install smoke:

```sh
npm install --prefix /tmp/daily-brief-public-smoke-<id> -g @chenpengfei/daily-brief@X.Y.Z --no-audit --no-fund
/tmp/daily-brief-public-smoke-<id>/bin/daily-brief version
/tmp/daily-brief-public-smoke-<id>/bin/daily-brief --help
```

## npm Authentication Handoff

Use this when preflight or publish reports `npm whoami` `E401`, expired npm login, missing credentials, `EOTP`, or Security Key/browser auth friction.

Do not stop with a vague "authenticate npm" message. Give the maintainer exact next actions, explain where to run them, and say how you will verify.

Suggested maintainer prompt:

```md
Human action needed: npm is not authenticated for publishing.

Please use browser/Security Key npm auth:

   `npm login --auth-type=web`

Then verify:
   `npm whoami`

When `npm whoami` prints your npm username, come back and say `continue`. I will rerun the Human Release preflight before publishing. I will not run `npm publish` until you explicitly confirm publication.
```

If the user wants the agent to run login, only run an interactive npm login command after explicit approval and keep it scoped:

```sh
npm login --auth-type=web
npm whoami
```

Record in the Release Checklist Issue:

- the exact auth blocker (`E401`, `EOTP`, expired login, etc.).
- the human guidance provided.
- whether `npm whoami` later succeeded.
- that no tag, GitHub Release, or npm publish happened while blocked.

If the Release Checklist Issue was closed by PR merge wording before publication, reopen it and record that the release remains incomplete.

## Checklist Issue Closure Control

Before closing a Release Checklist Issue, verify:

```sh
npm view @chenpengfei/daily-brief version dist-tags.latest
gh release view vX.Y.Z --json tagName,url,isDraft,isPrerelease,publishedAt
git ls-remote --tags origin vX.Y.Z
npm install --prefix /tmp/daily-brief-public-smoke-<id> -g @chenpengfei/daily-brief@X.Y.Z --no-audit --no-fund
/tmp/daily-brief-public-smoke-<id>/bin/daily-brief --help
```

Keep the issue open if any of these are true:

- npm latest does not point to `X.Y.Z`.
- GitHub tag or GitHub Release `vX.Y.Z` is absent.
- public install smoke has not passed.
- final publication evidence has not been posted.
- publication is blocked on npm auth, 2FA, GitHub Release creation, smoke test, or explicit human publish confirmation.

If a Release Checklist Issue was auto-closed by a merged PR before publication:

1. Reopen it immediately.
2. Comment or edit the body with the current blocker.
3. Record that no publish/tag/release/smoke closure happened yet.
4. Continue through Recovery from the exact blocker.

## npm 2FA and Security Key Recovery

If `npm publish --access public` fails with `EOTP`, do not rerun the full release script blindly. First determine what completed:

```sh
npm view @chenpengfei/daily-brief version dist-tags.latest
git ls-remote --tags origin vX.Y.Z
gh release view vX.Y.Z
git status --short --branch
```

If the tag was pushed but npm is still on the previous version and GitHub Release is absent, continue with browser/Security Key auth, not OTP:

```sh
npm publish --access public --auth-type=web
```

If an npm web login prompt appears, let npm open the browser when possible. If the command prints a login URL, show it to the maintainer and ask them to complete the browser/Security Key flow.

After npm publish succeeds, continue:

```sh
gh release create vX.Y.Z --verify-tag --title vX.Y.Z --notes-file <release-notes-file>
npm view @chenpengfei/daily-brief version dist-tags.latest
npm install --prefix /tmp/daily-brief-public-smoke-<id> -g @chenpengfei/daily-brief@X.Y.Z --no-audit --no-fund
/tmp/daily-brief-public-smoke-<id>/bin/daily-brief --help
```

## Release Check Side-Effect Guard

Release checks run workflow tests that can exercise Discord delivery paths. Before any `npm test`, `npm run release:check`, or `npm run release:human` command, use isolated paths:

```sh
DAILY_BRIEF_HOME=/tmp/daily-brief-release-home-<id>
DAILY_BRIEF_DATA_HOME=/tmp/daily-brief-release-data-<id>
```

If the maintainer reports a real Discord notification during release checks, inspect tests for `runOnce` / `deliverOnce` calls that omit `discordEnv` or `discordFetchImpl`. Such tests can fall back to `process.env`, resolve the maintainer's real Daily Brief home, and send to the configured webhook.

If GitHub Release creation fails after npm publish, create the GitHub Release for the same existing tag. Do not move the tag or unpublish the npm package unless a severe secret or credential exposure requires it.

## Closure Comment Template

Use this for Release Checklist Issues and PR closure comments:

```md
Release closure completed for vX.Y.Z.

- Release PR:
- Release prep commit:
- Main CI:
- npm package: @chenpengfei/daily-brief@X.Y.Z; latest points to X.Y.Z.
- Git tag: vX.Y.Z.
- GitHub Release:
- Public smoke: daily-brief version => X.Y.Z; help output renders expected public commands.
- Notes:
```

## Common Warnings

- `node-domexception@1.0.0` may appear as an npm install deprecation warning from the dependency tree. Treat it as non-blocking when install and CLI smoke pass.
- If global installs place binaries outside `PATH`, document the user's npm global bin path. Do not treat that as a package publication failure when prefix-based smoke passes.
