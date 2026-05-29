# MVP Daily Brief Agent Issue Migration

GitHub already had an implementation issue queue before the Goal Issue protocol was added. Do not create duplicate Goal Issues for the MVP PRD. Migrate the existing issues in place and keep their issue numbers.

## Mapping

| Existing Issue | Migration Target | Notes |
| --- | --- | --- |
| #1 `搭建 Pi Runtime + Operational CLI 骨架` | Foundation slice for Goal 6 | Keep as an early foundation issue; update to evidence-based format. |
| #2 `实现 Source Registry 校验和 Source CLI 管理` | Goal 1 | Use `docs/prd/goals/goal-1-source-registry-can-be-manually-managed.md`. |
| #3 `实现 Source Item Store 和 Fixture Fetch Adapter` | Foundation slice for Goal 3 | Keep as a fixture-backed collection/storage slice; update to evidence-based format. |
| #4 `从 Source Items 生成 Source-grounded Daily Brief` | Goal 4 | Use `docs/prd/goals/goal-4-brief-module-generates-source-grounded-daily-briefs.md`. |
| #5 `实现 Source Coverage 和 Core Workflow Failure 处理` | Goal 7 | Use `docs/prd/goals/goal-7-workflow-failure-behavior-is-trustworthy.md`. |
| #6 `实现 Discord Delivery 简报通知` | Goal 5 | Use `docs/prd/goals/goal-5-brief-archive-and-discord-delivery-stay-separate.md`. |
| #7 `实现 Blog/RSS Fetch Adapter 垂直切片` | Goal 2 RSS slice | Keep separate from other adapters. |
| #8 `实现 GitHub Trending Fetch Adapter 垂直切片` | Goal 2 GitHub slice | Keep separate from other adapters. |
| #9 `实现 X.com Fetch Adapter 垂直切片` | Goal 2 X slice | Keep separate from other adapters. |
| #10 `串联每日运行入口` | Goal 6 and Goal 8 | Update to workflow/CLI/cadence evidence format. |
| #11 `HITL：确定 LLM/模型与 secrets 配置契约` | Human decision issue | Keep as `ready-for-human`; do not convert to `ready-for-agent`. |

## Label policy during migration

- Issues being rewritten into the Goal Issue format should move to `needs-triage`.
- Promote to `ready-for-agent` only after the specification checklist in `docs/agents/goal-issues.md` passes.
- Keep #11 as `ready-for-human`.

## Migration status

- #1 through #11 have been migrated in GitHub, verified against the current test suite, and closed as completed.
- No duplicate Goal Issues were created for the MVP PRD.
