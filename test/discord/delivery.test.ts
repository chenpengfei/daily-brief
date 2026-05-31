import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { DailyBrief } from "../../src/brief/index.js";
import {
  deliverCoreFailureNotification,
  deliverDiscordNotification,
  renderDiscordNotification
} from "../../src/discord/index.js";

describe("Discord Delivery", () => {
  it("renders the short notification template without full Signal details", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-discord-"));
    const templatePath = join(directory, "discord-notification.md");

    try {
      await writeFile(
        templatePath,
        ["Daily Brief -- {{date}}", "", "今日重点：", "{{summary_bullets}}", "", "完整简报：", "{{brief_path}}"].join(
          "\n"
        ),
        "utf8"
      );

      const notification = await renderDiscordNotification({
        brief: briefFixture(),
        briefPath: "briefs/2026/05/2026-05-28.md",
        templatePath
      });

      expect(notification).toContain("Daily Brief -- 2026-05-28");
      expect(notification).toContain("- [architecture] Agent runtime state management");
      expect(notification).toContain("briefs/2026/05/2026-05-28.md");
      expect(notification).not.toContain("whyItMatters");
      expect(notification).not.toContain("blog:item-1");
      expect(notification).not.toContain("它提供了 Agent Architecture");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("posts notifications to a provided Discord webhook transport", async () => {
    const requests: unknown[] = [];
    const result = await deliverDiscordNotification(
      {
        brief: briefFixture(),
        briefPath: "briefs/2026/05/2026-05-28.md"
      },
      {
        webhookUrl: "https://discord.example/webhook",
        fetchImpl: async (_url, init) => {
          requests.push(JSON.parse(String(init?.body)));
          return new Response(null, { status: 204 });
        }
      }
    );

    expect(result).toEqual({ status: "sent" });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      content: expect.stringContaining("完整简报")
    });
  });

  it("renders the packaged default template independent of the current working directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daily-brief-discord-cwd-"));
    const originalCwd = process.cwd();

    try {
      process.chdir(directory);

      const notification = await renderDiscordNotification({
        brief: briefFixture(),
        briefPath: "briefs/2026/05/2026-05-28.md"
      });

      expect(notification).toContain("Daily Brief -- 2026-05-28");
      expect(notification).toContain("完整简报");
    } finally {
      process.chdir(originalCwd);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not throw when Discord sending fails", async () => {
    await expect(
      deliverDiscordNotification(
        {
          brief: briefFixture(),
          briefPath: "briefs/2026/05/2026-05-28.md"
        },
        {
          webhookUrl: "https://discord.example/webhook",
          fetchImpl: async () => new Response(null, { status: 500 })
        }
      )
    ).resolves.toEqual({ status: "failed", reason: "Discord webhook returned 500" });
  });

  it("can send Core Workflow Failure notifications through Discord when configured", async () => {
    const requests: unknown[] = [];
    const result = await deliverCoreFailureNotification(
      {
        kind: "brief-generation-unavailable",
        message: "Brief generation failed"
      },
      {
        webhookUrl: "https://discord.example/webhook",
        fetchImpl: async (_url, init) => {
          requests.push(JSON.parse(String(init?.body)));
          return new Response(null, { status: 204 });
        }
      }
    );

    expect(result).toEqual({ status: "sent" });
    expect(requests[0]).toMatchObject({
      content: expect.stringContaining("Core Workflow Failure: brief-generation-unavailable")
    });
  });
});

function briefFixture(): DailyBrief {
  return {
    date: new Date("2026-05-28T07:00:00.000Z"),
    executiveSummary: "今天有 1 个 Source-grounded Signals。",
    signals: [
      {
        id: "signal:https://example.com/agent-runtime",
        type: "architecture",
        title: "Agent runtime state management",
        summary: {
          whatItIs: "它是一个 Source-grounded Signal：Agent runtime state management",
          whatItIsNot: "不是未引用来源支撑的通用观点；当前只代表它在本次 Source Items 中形成了 architecture Signal。",
          minimalExample: "最小地看，用它对照一个 Agent runtime 的 state、tool execution 或 workflow 边界。"
        },
        whyItMatters: "它提供了 Agent Architecture 的具体实现或设计线索，值得进一步阅读原文。",
        citations: [
          {
            sourceItemId: "blog:item-1",
            sourceId: "blog",
            title: "Agent runtime state management",
            url: "https://example.com/agent-runtime"
          }
        ]
      }
    ],
    sourceCoverage: {
      sourceItemCount: 1,
      sourceCount: 1,
      partialFailures: []
    }
  };
}
