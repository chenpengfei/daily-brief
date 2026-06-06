import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DailyBrief } from "../brief/index.js";
import { getCredential, readDeliveryConfig, resolveDailyBriefPaths } from "../config/index.js";
import { createCoreWorkflowFailureNotification, type CoreWorkflowFailure } from "../workflow/index.js";

export interface DiscordNotificationInput {
  brief: DailyBrief;
  briefPath: string;
  templatePath?: string;
}

export interface DiscordDeliveryOptions {
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
  env?: Partial<Record<string, string | undefined>>;
}

export type DiscordDeliveryResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export async function renderDiscordNotification(input: DiscordNotificationInput): Promise<string> {
  const template = await readDiscordTemplate(input.templatePath);
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
  const webhookUrl = options.webhookUrl ?? resolveConfiguredWebhookUrl(options.env ?? process.env);

  if (!webhookUrl) {
    return { status: "skipped", reason: "Discord delivery webhook is not configured" };
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

async function readDiscordTemplate(templatePath?: string): Promise<string> {
  if (templatePath) {
    return readFile(templatePath, "utf8");
  }

  const candidates = [
    fileURLToPath(new URL("../../templates/discord-notification.md", import.meta.url)),
    fileURLToPath(new URL("../../../templates/discord-notification.md", import.meta.url))
  ];
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Discord notification template not found");
}

export function resolveConfiguredWebhookUrl(env: Partial<Record<string, string | undefined>> = process.env): string | undefined {
  const paths = resolveDailyBriefPaths(env);
  const config = readDeliveryConfig(paths.configPath);

  if (config?.enabled === false) {
    return undefined;
  }

  if (!config?.enabled || !config.webhookRef) {
    return undefined;
  }

  const credential = getCredential(config.webhookRef, paths.authPath);
  return credential?.type === "webhook" && credential.provider === "discord" ? credential.webhookUrl : undefined;
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
