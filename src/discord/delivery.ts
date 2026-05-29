import { readFile } from "node:fs/promises";
import type { DailyBrief } from "../brief/index.js";
import { createCoreWorkflowFailureNotification, type CoreWorkflowFailure } from "../workflow/index.js";

export interface DiscordNotificationInput {
  brief: DailyBrief;
  briefPath: string;
  templatePath?: string;
}

export interface DiscordDeliveryOptions {
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
}

export type DiscordDeliveryResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export async function renderDiscordNotification(input: DiscordNotificationInput): Promise<string> {
  const template = await readFile(input.templatePath ?? "templates/discord-notification.md", "utf8");
  const date = input.brief.date.toISOString().slice(0, 10);
  const summaryBullets = buildSummaryBullets(input.brief);

  return template
    .replaceAll("{{date}}", date)
    .replaceAll("{{summary_bullets}}", summaryBullets)
    .replaceAll("{{brief_path}}", input.briefPath)
    .trim();
}

export async function deliverDiscordNotification(
  input: DiscordNotificationInput,
  options: DiscordDeliveryOptions = {}
): Promise<DiscordDeliveryResult> {
  const content = await renderDiscordNotification(input);
  return sendDiscordContent(content, options);
}

export async function deliverCoreFailureNotification(
  failure: CoreWorkflowFailure,
  options: DiscordDeliveryOptions = {}
): Promise<DiscordDeliveryResult> {
  return sendDiscordContent(createCoreWorkflowFailureNotification(failure), options);
}

async function sendDiscordContent(
  content: string,
  options: DiscordDeliveryOptions
): Promise<DiscordDeliveryResult> {
  const webhookUrl = options.webhookUrl ?? process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return { status: "skipped", reason: "DISCORD_WEBHOOK_URL is not configured" };
  }

  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      return { status: "failed", reason: `Discord webhook returned ${response.status}` };
    }

    return { status: "sent" };
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}

function buildSummaryBullets(brief: DailyBrief): string {
  if (brief.signals.length === 0) {
    return "- low-signal day：暂无可引用的 Top Signals";
  }

  return brief.signals
    .slice(0, 3)
    .map((signal) => `- [${signal.type}] ${signal.title}`)
    .join("\n");
}
