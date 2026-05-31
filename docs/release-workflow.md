# Formal Release Workflow

Formal Releases publish both a GitHub Release and the npm package `@chenpengfei/daily-brief`. The installed command remains `daily-brief`.

The workflow has three human-triggered Release Gates:

1. Agent Release Preparation Gate
2. Agent Release Review Gate
3. Human Release Gate

Publication commands are never run before the Human Release Gate.

## Release Invariants

- The Release Version uses SemVer: npm/package uses `X.Y.Z`, while GitHub tag and release title use `vX.Y.Z`.
- Release Pull Requests prepare release materials only: package metadata, version, Changelog, User Manual, release workflow documentation, and evidence.
- Release Pull Requests should not include product code fixes.
- Product-code Release Blockers leave the release line and are handled through a separate issue or fix PR.
- Published tags and npm versions are immutable. Post-Release Incidents use documentation and patch releases instead of moved tags or silent rollback.

## Gate 1: Agent Release Preparation

Trigger this gate by asking an Agent to prepare release `vX.Y.Z`.

The Agent must:

- Create or update the Release Checklist Issue.
- Create a `release/vX.Y.Z` branch and Release Pull Request.
- Update `package.json` and `package-lock.json` to the Release Version and package metadata.
- Update `CHANGELOG.md` with user-visible changes, installation or upgrade notes, and known limitations.
- Update `docs/user-manual.md` for any user-facing behavior changes.
- Update `docs/release-workflow.md` if the release process changes.
- Run `npm run release:check`.
- Run `npm run release:publish:dry-run`.
- Run the isolated Release Install Smoke Test.
- Record command evidence and any Release Blockers in the Release Checklist Issue and Release Pull Request.

The Release Check Command runs:

```bash
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

The npm publish dry-run verifies scoped package publication metadata without publishing:

```bash
npm run release:publish:dry-run
```

The Release Install Smoke Test must use temporary npm and Daily Brief paths:

```bash
npm pack
npm install --prefix /tmp/daily-brief-smoke -g ./chenpengfei-daily-brief-X.Y.Z.tgz --no-audit --no-fund
DAILY_BRIEF_HOME=/tmp/daily-brief-home \
DAILY_BRIEF_DATA_HOME=/tmp/daily-brief-data \
/tmp/daily-brief-smoke/bin/daily-brief --help
DAILY_BRIEF_HOME=/tmp/daily-brief-home \
DAILY_BRIEF_DATA_HOME=/tmp/daily-brief-data \
/tmp/daily-brief-smoke/bin/daily-brief setup
```

Use a unique temporary directory for real runs. Do not install into the maintainer's real global npm prefix or real `~/.daily-brief` during the smoke test.

If a product-code blocker appears, stop the release preparation, record the blocker, create or link the fix issue, and restart this gate after the fix is merged.

## Gate 2: Agent Release Review

Trigger this gate in an independent Agent context after the Release Pull Request is ready.

The reviewing Agent must use a review stance and inspect:

- Release Checklist Issue evidence.
- Release Pull Request diff.
- `package.json` and `package-lock.json`.
- `CHANGELOG.md`.
- `docs/user-manual.md`.
- `docs/release-workflow.md`.
- Release CI Workflow result.
- Local evidence for `npm run release:check`.
- Local evidence for the Release Install Smoke Test.

The reviewing Agent should report blocking findings first, with file and line references when possible. It may recommend approval or request fixes, but it must not publish the release or approve its own preparation work.

## Gate 3: Human Release

Only the maintainer can pass the Human Release Gate.

Before publishing, verify:

- Release Pull Request is merged.
- Local `main` matches `origin/main`.
- Release CI Workflow is green on the merged state.
- Agent Release Review Gate recommends approval or all findings are resolved.
- npm credentials and GitHub credentials are available to the maintainer.
- npm package state has been checked with `npm view @chenpengfei/daily-brief version`; first release should be unpublished, and later releases should show a version lower than the target Release Version.
- `/tmp/daily-brief-release-notes.md` has been prepared from the matching `CHANGELOG.md` entry.

Publish in this order:

```bash
git checkout main
git pull --ff-only
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
npm publish --access public
gh release create vX.Y.Z --verify-tag --title "vX.Y.Z" --notes-file /tmp/daily-brief-release-notes.md
```

The GitHub Release notes should be derived from the `CHANGELOG.md` entry and include:

- User-visible changes.
- Installation or upgrade notes.
- Known limitations.
- Installation command: `npm install -g @chenpengfei/daily-brief`.

After publication, verify public installation:

```bash
npm view @chenpengfei/daily-brief version
npm install --prefix /tmp/daily-brief-public-smoke -g @chenpengfei/daily-brief@X.Y.Z --no-audit --no-fund
/tmp/daily-brief-public-smoke/bin/daily-brief --help
```

Record the npm version, GitHub Release URL, tag, and public install verification in the Release Checklist Issue.

## Post-Release Incidents

If npm publish succeeds but GitHub Release creation fails, continue by fixing GitHub Release creation for the same tag and version.

If GitHub Release is public but install verification fails, record the incident in the Release Checklist Issue, update release notes when relevant, create a fix issue, and publish a patch Release Version after the fix. Do not move the tag or unpublish the npm package unless the release exposed a severe secret or credential issue.

## Release Checklist Issue Template

```md
# Release vX.Y.Z

## Scope

- Release Version: X.Y.Z
- GitHub tag: vX.Y.Z
- npm package: @chenpengfei/daily-brief
- Release Pull Request:

## Gate 1: Agent Release Preparation

- [ ] Release branch created: release/vX.Y.Z
- [ ] Release Pull Request opened
- [ ] package metadata updated
- [ ] CHANGELOG.md updated
- [ ] docs/user-manual.md updated
- [ ] docs/release-workflow.md updated if needed
- [ ] npm run release:check completed
- [ ] npm run release:publish:dry-run completed
- [ ] Release Install Smoke Test completed with temporary npm prefix and Daily Brief homes
- [ ] Release Blockers recorded or confirmed absent

### Preparation Evidence

- release:check:
- publish dry-run:
- npm pack output:
- install smoke test:
- git status:
- notes:

## Gate 2: Agent Release Review

- [ ] Independent Agent review requested
- [ ] Release Pull Request reviewed
- [ ] Release Checklist evidence reviewed
- [ ] Release CI Workflow result reviewed
- [ ] Review recommendation recorded

### Review Findings

- Blocking:
- Non-blocking:
- Recommendation:

## Gate 3: Human Release

- [ ] Release Pull Request merged
- [ ] main matches origin/main
- [ ] npm package state checked
- [ ] GitHub Release notes file prepared
- [ ] tag pushed: vX.Y.Z
- [ ] npm publish completed
- [ ] GitHub Release created
- [ ] public install verification completed

### Publication Evidence

- npm version:
- npm package state before publish:
- GitHub Release URL:
- tag:
- public install:

## Post-Release Incidents

- None known.
```
