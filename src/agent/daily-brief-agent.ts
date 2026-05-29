import { Agent } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, registerFauxProvider } from "@earendil-works/pi-ai";
import { readFile } from "node:fs/promises";
import { generateDailyBrief, renderDailyBriefMarkdown, type DailyBrief } from "../brief/index.js";
import { collectSources, type CollectionRunResult } from "../collection/index.js";
import { deliverCoreFailureNotification, deliverDiscordNotification, type DiscordDeliveryResult } from "../discord/index.js";
import { briefArchivePath, readSourceItems, writeBriefArchive } from "../storage/index.js";
import type { CoreWorkflowFailure } from "../workflow/index.js";
import { readModelRuntimeConfig, type ModelRuntimeConfig, type ModelRuntimeEnv } from "./model-runtime-config.js";

export interface RunOnceOptions {
  date?: Date;
  sourceRegistryPath?: string;
  archiveRoot?: string;
  sourceItemRoot?: string;
  discordWebhookUrl?: string;
  discordFetchImpl?: typeof fetch;
  discordTemplatePath?: string;
  modelRuntimeEnv?: ModelRuntimeEnv;
}

export interface RunOnceResult {
  archivePath: string;
  markdown: string;
  sourceCount: number;
  sourceItemCount: number;
  piEvents: string[];
  collection: CollectionRunResult;
  delivery: DiscordDeliveryResult;
  coreFailure?: CoreWorkflowFailure;
  modelRuntimeConfig?: ModelRuntimeConfig;
}

export interface GenerateOnceResult {
  archivePath: string;
  markdown: string;
  brief: DailyBrief;
  sourceItemCount: number;
  piEvents: string[];
  modelRuntimeConfig: ModelRuntimeConfig;
}

export async function runOnce(options: RunOnceOptions = {}): Promise<RunOnceResult> {
  const date = options.date ?? new Date();
  let collection: CollectionRunResult;

  try {
    collection = await collectSources({
      date,
      fetchedAt: date,
      ...(options.sourceRegistryPath ? { sourceRegistryPath: options.sourceRegistryPath } : {}),
      ...(options.sourceItemRoot ? { sourceItemRoot: options.sourceItemRoot } : {})
    });
  } catch (error) {
    const coreFailure: CoreWorkflowFailure = {
      kind: "unreadable-source-registry",
      message: error instanceof Error ? error.message : String(error)
    };
    const delivery = await deliverCoreFailureNotification(coreFailure, {
      ...(options.discordWebhookUrl ? { webhookUrl: options.discordWebhookUrl } : {}),
      ...(options.discordFetchImpl ? { fetchImpl: options.discordFetchImpl } : {})
    });

    return {
      archivePath: "",
      markdown: "",
      sourceCount: 0,
      sourceItemCount: 0,
      piEvents: [],
      collection: { storePath: "", sources: [] },
      delivery,
      coreFailure
    };
  }

  const generated = await generateOnce(options);
  const delivery = await deliverOnce({
    ...options,
    date,
    brief: generated.brief,
    archivePath: generated.archivePath
  });

  return {
    archivePath: generated.archivePath,
    markdown: generated.markdown,
    sourceCount: collection.sources.length,
    sourceItemCount: generated.sourceItemCount,
    piEvents: generated.piEvents,
    collection,
    delivery
  };
}

export async function generateOnce(options: RunOnceOptions = {}): Promise<GenerateOnceResult> {
  const date = options.date ?? new Date();
  const sourceItems = await readSourceItems(date, options.sourceItemRoot);
  const brief = generateDailyBrief({ date, sourceItems });
  const markdown = renderDailyBriefMarkdown(brief);
  const modelRuntimeConfig = readModelRuntimeConfig(options.modelRuntimeEnv);

  if (!modelRuntimeConfig.ready) {
    throw new Error(`Model runtime is not ready:\n${modelRuntimeConfig.issues.map((issue) => `- ${issue}`).join("\n")}`);
  }

  const piResult = await renderBriefThroughPiRuntime(markdown);
  const archived = await writeBriefArchive(piResult.markdown, date, options.archiveRoot);

  return {
    archivePath: archived.path,
    markdown: piResult.markdown,
    brief,
    sourceItemCount: sourceItems.length,
    piEvents: piResult.events,
    modelRuntimeConfig
  };
}

export async function deliverOnce(
  options: RunOnceOptions & { brief?: DailyBrief; archivePath?: string } = {}
): Promise<DiscordDeliveryResult> {
  const date = options.date ?? new Date();
  const archivePath = options.archivePath ?? briefArchivePath(date, options.archiveRoot);

  try {
    await readFile(archivePath, "utf8");
  } catch {
    return { status: "failed", reason: `Brief Archive entry not found: ${archivePath}` };
  }

  const brief =
    options.brief ??
    generateDailyBrief({
      date,
      sourceItems: await readSourceItems(date, options.sourceItemRoot)
    });

  return deliverDiscordNotification(
    {
      brief,
      briefPath: archivePath,
      ...(options.discordTemplatePath ? { templatePath: options.discordTemplatePath } : {})
    },
    {
      ...(options.discordWebhookUrl ? { webhookUrl: options.discordWebhookUrl } : {}),
      ...(options.discordFetchImpl ? { fetchImpl: options.discordFetchImpl } : {})
    }
  );
}

export async function renderBriefThroughPiRuntime(markdown: string): Promise<{ markdown: string; events: string[] }> {
  const provider = registerFauxProvider();
  provider.setResponses([fauxAssistantMessage(markdown)]);

  try {
    const events: string[] = [];
    const model = provider.getModel();
    const agent = new Agent({
      initialState: {
        systemPrompt:
          "You are the Daily Brief Agent. Return only the already grounded Markdown Daily Brief you are given.",
        model,
        thinkingLevel: "off"
      },
      sessionId: "daily-brief-run-once"
    });

    agent.subscribe((event) => {
      events.push(event.type);
    });

    await agent.prompt(
      [
        "Render this Source-grounded Daily Brief exactly as Markdown.",
        "",
        markdown
      ].join("\n")
    );

    const assistantMessage = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
    const rendered = assistantMessage?.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!rendered) {
      throw new Error("Pi Agent Runtime did not return Daily Brief Markdown");
    }

    return { markdown: rendered, events };
  } finally {
    provider.unregister();
  }
}
