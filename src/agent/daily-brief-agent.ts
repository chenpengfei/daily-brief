import { Agent } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, registerFauxProvider } from "@earendil-works/pi-ai";
import { readFile } from "node:fs/promises";
import { generateDailyBrief, renderDailyBriefMarkdown, type DailyBrief } from "../brief/index.js";
import { collectSources, type CollectionRunResult } from "../collection/index.js";
import { deliverCoreFailureNotification, deliverDiscordNotification, type DiscordDeliveryResult } from "../discord/index.js";
import {
  briefArchivePath,
  createAgentRunArtifact,
  readSourceItems,
  writeAgentRunArtifact,
  writeBriefArchive
} from "../storage/index.js";
import type { CoreWorkflowFailure } from "../workflow/index.js";
import { readModelRuntimeConfig, type ModelRuntimeConfig, type ModelRuntimeEnv } from "./model-runtime-config.js";
import { enrichDailyBriefNarrativeWithAgent } from "./signal-narrative.js";
import { runSignalSelectionAndRankingStages } from "./signal-selection-ranking.js";
import { runSourceGroundingAuditStage } from "./source-grounding-audit.js";
import { runSourceItemUnderstandingStage } from "./source-item-understanding.js";
import { runAgentStage } from "./stage-runner.js";

export interface RunOnceOptions {
  date?: Date;
  dateKey?: string;
  sourceRegistryPath?: string;
  archiveRoot?: string;
  agentRunRoot?: string;
  sourceItemRoot?: string;
  discordWebhookUrl?: string;
  discordFetchImpl?: typeof fetch;
  discordTemplatePath?: string;
  modelRuntimeEnv?: ModelRuntimeEnv;
  sourceCount?: number;
  partialFailures?: string[];
  collectionFailures?: Array<{ sourceId: string; reason: string }>;
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
  agentRunArtifactPath?: string;
}

export interface GenerateOnceResult {
  archivePath: string;
  markdown: string;
  brief: DailyBrief;
  sourceItemCount: number;
  piEvents: string[];
  modelRuntimeConfig: ModelRuntimeConfig;
  agentRunArtifactPath?: string;
}

export async function runOnce(options: RunOnceOptions = {}): Promise<RunOnceResult> {
  const date = options.date ?? new Date();
  const dateKey = options.dateKey;
  let collection: CollectionRunResult;

  try {
    collection = await collectSources({
      date,
      ...(dateKey ? { dateKey } : {}),
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

  const collectedItems = await readSourceItems(date, options.sourceItemRoot, dateKey);
  const collectionFailure = classifyCollectionCoreFailure(collection, collectedItems.length);

  if (collectionFailure) {
    const delivery = await deliverCoreFailureNotification(collectionFailure, {
      ...(options.discordWebhookUrl ? { webhookUrl: options.discordWebhookUrl } : {}),
      ...(options.discordFetchImpl ? { fetchImpl: options.discordFetchImpl } : {})
    });

    return {
      archivePath: "",
      markdown: "",
      sourceCount: collection.sources.length,
      sourceItemCount: collectedItems.length,
      piEvents: [],
      collection,
      delivery,
      coreFailure: collectionFailure
    };
  }

  const collectionFailures = collectionFailureRefs(collection);
  const generated = await generateOnce({
    ...options,
    ...(dateKey ? { dateKey } : {}),
    sourceCount: collection.sources.length,
    ...(collectionFailures.length > 0
      ? {
          partialFailures: collectionFailures.map((failure) => `${failure.sourceId}: ${failure.reason}`),
          collectionFailures
        }
      : {})
  });
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
    delivery,
    ...(generated.agentRunArtifactPath ? { agentRunArtifactPath: generated.agentRunArtifactPath } : {})
  };
}

export async function generateOnce(options: RunOnceOptions = {}): Promise<GenerateOnceResult> {
  const date = options.date ?? new Date();
  const dateKey = options.dateKey;
  const sourceItems = await readSourceItems(date, options.sourceItemRoot, dateKey);
  const modelRuntimeConfig = readModelRuntimeConfig(options.modelRuntimeEnv);

  if (sourceItems.length === 0) {
    throw new Error("No usable Source Items found for generation; Daily Brief will not archive a false low-signal brief.");
  }

  if (!modelRuntimeConfig.ready) {
    throw new Error(`Model runtime is not ready:\n${modelRuntimeConfig.issues.map((issue) => `- ${issue}`).join("\n")}`);
  }

  const baseBrief = generateDailyBrief({
    date,
    ...(dateKey ? { dateKey } : {}),
    sourceItems,
    ...(options.partialFailures ? { partialFailures: options.partialFailures } : {}),
    ...(options.sourceCount ? { sourceCount: options.sourceCount } : {})
  });
  const artifact = createAgentRunArtifact({
    date,
    ...(dateKey ? { dateKey } : {}),
    modelRuntimeConfig,
    inputRefs: {
      sourceItemIds: sourceItems.map((item) => item.id),
      signalIds: baseBrief.signals.map((signal) => signal.id),
      ...(options.collectionFailures ? { collectionFailures: options.collectionFailures } : {})
    }
  });

  try {
    const collectionInputRefs = options.collectionFailures
      ? { collectionFailures: options.collectionFailures }
      : undefined;
    const understanding = await runSourceItemUnderstandingStage({
      sourceItems,
      modelRuntimeConfig,
      artifact,
      ...(collectionInputRefs ? { inputRefs: collectionInputRefs } : {}),
      ...(options.modelRuntimeEnv ? { modelRuntimeEnv: options.modelRuntimeEnv } : {})
    });
    const selected = await runSignalSelectionAndRankingStages({
      sourceItems,
      annotations: understanding.annotations,
      artifact,
      modelRuntimeConfig,
      ...(collectionInputRefs ? { inputRefs: collectionInputRefs } : {}),
      ...(options.modelRuntimeEnv ? { modelRuntimeEnv: options.modelRuntimeEnv } : {})
    });
    const selectedBrief: DailyBrief = {
      ...baseBrief,
      executiveSummary:
        selected.signals.length === 0
          ? "今天是 low-signal day：Selection/Ranking Stages 没有选出足够强的 Source-grounded Signals。"
          : `今天有 ${selected.signals.length} 个 Agent-selected Source-grounded Signals，均保留 Source Item citation 以便回溯。`,
      signals: selected.signals
    };
    const narrative = await enrichDailyBriefNarrativeWithAgent({
      brief: selectedBrief,
      sourceItems,
      modelRuntimeConfig,
      ...(options.modelRuntimeEnv ? { modelRuntimeEnv: options.modelRuntimeEnv } : {})
    });
    const narrativeStage = await runAgentStage({
      stage: "narrative",
      artifact,
      date,
      inputRefs: {
        ...(options.collectionFailures ? { collectionFailures: options.collectionFailures } : {}),
        sourceItemIds: sourceItems.map((item) => item.id),
        signalIds: narrative.brief.signals.map((signal) => signal.id)
      },
      validationContext: {
        signalIds: narrative.brief.signals.map((signal) => signal.id)
      },
      execute: async () => ({
        stage: "narrative",
        executiveSummary: narrative.brief.executiveSummary,
        signalNarratives: narrative.brief.signals.map((signal) => ({
          signalId: signal.id,
          focusAreas: signal.focusAreas ?? [],
          directions: signal.directions ?? [],
          whatItIs: signal.summary.whatItIs,
          whatItIsNot: signal.summary.whatItIsNot,
          minimalExample: signal.summary.minimalExample,
          whyItMatters: signal.whyItMatters
        }))
      })
    });
    const audited = await runSourceGroundingAuditStage({
      brief: narrative.brief,
      sourceItems,
      artifact,
      modelRuntimeConfig,
      ...(collectionInputRefs ? { inputRefs: collectionInputRefs } : {}),
      ...(options.modelRuntimeEnv ? { modelRuntimeEnv: options.modelRuntimeEnv } : {})
    });
    const writtenArtifact = options.agentRunRoot ? await writeAgentRunArtifact(artifact, date, options.agentRunRoot, dateKey) : undefined;
    const markdown = renderDailyBriefMarkdown(audited.brief);
    const piResult = await renderBriefThroughPiRuntime(markdown);
    const archived = await writeBriefArchive(piResult.markdown, date, options.archiveRoot, dateKey);

    return {
      archivePath: archived.path,
      markdown: piResult.markdown,
      brief: audited.brief,
      sourceItemCount: sourceItems.length,
      piEvents: [...understanding.events, ...selected.events, ...narrative.events, ...piResult.events],
      modelRuntimeConfig,
      ...((writtenArtifact?.path ?? narrativeStage.artifactPath) ? { agentRunArtifactPath: writtenArtifact?.path ?? narrativeStage.artifactPath } : {})
    };
  } catch (error) {
    artifact.failure = {
      kind: "execution",
      message: error instanceof Error ? error.message : String(error)
    };

    if (options.agentRunRoot) {
      await writeAgentRunArtifact(artifact, date, options.agentRunRoot, dateKey);
    }

    throw error;
  }
}

function collectionFailureRefs(collection: CollectionRunResult): Array<{ sourceId: string; reason: string }> {
  return collection.sources
    .filter((source) => source.status === "failed")
    .map((source) => ({ sourceId: source.sourceId, reason: source.reason ?? "Unknown failure" }));
}

function classifyCollectionCoreFailure(
  collection: CollectionRunResult,
  storedSourceItemCount: number
): CoreWorkflowFailure | undefined {
  const enabledResults = collection.sources.filter((source) => source.status !== "skipped");
  const failedResults = enabledResults.filter((source) => source.status === "failed");

  if (enabledResults.length === 0 && storedSourceItemCount === 0) {
    return {
      kind: "no-usable-source-items",
      message: "No enabled Sources produced Source Items; Daily Brief will not generate a false low-signal brief."
    };
  }

  if (enabledResults.length > 0 && failedResults.length === enabledResults.length && storedSourceItemCount === 0) {
    return {
      kind: "no-usable-source-items",
      message: `All enabled Sources failed and no Source Items exist for this date: ${failedResults
        .map((source) => `${source.sourceId}: ${source.reason ?? "Unknown failure"}`)
        .join("; ")}`
    };
  }

  return undefined;
}

export async function deliverOnce(
  options: RunOnceOptions & { brief?: DailyBrief; archivePath?: string } = {}
): Promise<DiscordDeliveryResult> {
  const date = options.date ?? new Date();
  const archivePath = options.archivePath ?? briefArchivePath(date, options.archiveRoot, options.dateKey);

  try {
    await readFile(archivePath, "utf8");
  } catch {
    return { status: "failed", reason: `Brief Archive entry not found: ${archivePath}` };
  }

  const brief =
    options.brief ??
    generateDailyBrief({
      date,
      ...(options.dateKey ? { dateKey: options.dateKey } : {}),
      sourceItems: await readSourceItems(date, options.sourceItemRoot, options.dateKey)
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
