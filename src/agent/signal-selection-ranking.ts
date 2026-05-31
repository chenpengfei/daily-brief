import { Agent } from "@earendil-works/pi-agent-core";
import type { Signal, SignalCitation, SignalSummary, SignalType } from "../brief/index.js";
import type { SourceItem } from "../domain/index.js";
import type { AgentRunArtifact } from "../storage/index.js";
import { createStageModelRuntime, type StageModelRuntime } from "./model-stage-runtime.js";
import type { ModelRuntimeConfig, ModelRuntimeEnv } from "./model-runtime-config.js";
import { runAgentStage } from "./stage-runner.js";
import type { SelectionStageOutput, RankingStageOutput, UnderstandingStageOutput } from "./stage-contracts.js";

export interface SignalSelectionRankingResult {
  signals: Signal[];
  selection: SelectionStageOutput;
  ranking: RankingStageOutput;
  events: string[];
}

export interface SignalSelectionRankingInput {
  sourceItems: SourceItem[];
  annotations: UnderstandingStageOutput["sourceItemAnnotations"];
  artifact: AgentRunArtifact;
  modelRuntimeConfig?: ModelRuntimeConfig;
  modelRuntimeEnv?: ModelRuntimeEnv;
  maxSignals?: number;
}

interface SelectionRequest {
  sourceItems: Array<{
    id: string;
    sourceId: string;
    platform: SourceItem["platform"];
    url: string;
    title: string;
    analyzableText: string;
  }>;
  annotations: UnderstandingStageOutput["sourceItemAnnotations"];
}

interface RankingRequest {
  maxSignals: number;
  candidateSignals: SelectionStageOutput["candidateSignals"];
}

export async function runSignalSelectionAndRankingStages(
  input: SignalSelectionRankingInput
): Promise<SignalSelectionRankingResult> {
  const modelRuntimeConfig = input.modelRuntimeConfig ?? {
    provider: "faux" as const,
    model: "faux-daily-brief-renderer",
    ready: true,
    issues: []
  };
  const modelRuntimeEnv = input.modelRuntimeEnv ?? process.env;
  const selectionRequest = buildSelectionRequest(input.sourceItems, input.annotations);
  const selectionRuntime = createStageModelRuntime({
    config: modelRuntimeConfig,
    env: modelRuntimeEnv,
    fauxResponse: JSON.stringify(buildFauxSelectionOutput(selectionRequest))
  });
  const selectionResponse = await runSelectionAgent(selectionRequest, selectionRuntime);
  const selectionStage = await runAgentStage<SelectionStageOutput>({
    stage: "selection",
    artifact: input.artifact,
    inputRefs: { sourceItemIds: input.sourceItems.map((item) => item.id) },
    validationContext: { sourceItemIds: input.sourceItems.map((item) => item.id) },
    execute: async () => selectionResponse.text
  });
  const merged = mergeCandidateSignals(selectionStage.output.candidateSignals);
  const rankingRequest = { maxSignals: input.maxSignals ?? 5, candidateSignals: merged };
  const rankingRuntime = createStageModelRuntime({
    config: modelRuntimeConfig,
    env: modelRuntimeEnv,
    fauxResponse: JSON.stringify(buildFauxRankingOutput(rankingRequest))
  });
  const rankingResponse = await runRankingAgent(rankingRequest, rankingRuntime);
  const rankingStage = await runAgentStage<RankingStageOutput>({
    stage: "ranking",
    artifact: input.artifact,
    inputRefs: { sourceItemIds: unique(merged.flatMap((signal) => signal.sourceItemIds)), signalIds: merged.map((signal) => signal.signalId) },
    validationContext: { signalIds: merged.map((signal) => signal.signalId) },
    execute: async () => rankingResponse.text
  });

  return {
    signals: buildSignalsFromRanking(input.sourceItems, merged, rankingStage.output),
    selection: selectionStage.output,
    ranking: rankingStage.output,
    events: [...selectionResponse.events, ...rankingResponse.events]
  };
}

function buildSelectionRequest(
  sourceItems: SourceItem[],
  annotations: UnderstandingStageOutput["sourceItemAnnotations"]
): SelectionRequest {
  return {
    sourceItems: sourceItems.map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      platform: item.platform,
      url: item.url,
      title: item.title,
      analyzableText: item.analyzableText
    })),
    annotations
  };
}

async function runSelectionAgent(
  request: SelectionRequest,
  runtime: StageModelRuntime
): Promise<{ text: string; events: string[] }> {
  const events: string[] = [];
  const agent = new Agent({
    initialState: {
      systemPrompt: [
        "你是 Daily Brief Agent 的 Signal Selection Stage。",
        "你必须基于 Understanding annotations 和 Source Items 选择候选 Signal。",
        "不要使用关键词兜底，不要按数组顺序照搬；候选必须能被 sourceItemIds 支撑。",
        "输出必须是 JSON object。"
      ].join("\n"),
      model: runtime.model,
      thinkingLevel: runtime.thinkingLevel
    },
    sessionId: "daily-brief-signal-selection",
    ...(runtime.getApiKey ? { getApiKey: runtime.getApiKey } : {})
  });

  agent.subscribe((event) => {
    events.push(`selection:${event.type}`);
  });
  await agent.prompt(
    [
      "请选择 Daily Brief 候选 Signals，并排除弱或不相关 Source Items。",
      "",
      "JSON schema:",
      "{",
      "  \"stage\": \"selection\",",
      "  \"candidateSignals\": [",
      "    {",
      "      \"signalId\": \"stable unique signal id\",",
      "      \"title\": \"reader-facing title\",",
      "      \"signalType\": \"architecture|ai-coding|tool-repo|risk\",",
      "      \"strength\": \"strong|weak\",",
      "      \"sourceItemIds\": [\"cited source item ids\"],",
      "      \"reason\": \"why this is a candidate, grounded in annotations\"",
      "    }",
      "  ],",
      "  \"excludedSourceItems\": [{ \"sourceItemId\": \"id\", \"reason\": \"why excluded\" }]",
      "}",
      "",
      "Selection lens: 领域包括 Agent 架构、AI Coding；方向包括先进工具、长程任务、持续学习、自我改进、人与 Agent 的边界。",
      "Merge near-duplicate candidates yourself by using the same signalId and multiple sourceItemIds.",
      "Title rules:",
      "- title 只能概括 cited Source Items 直接共同说明的对象或能力。",
      "- 不要在 title 中写“正在成为”“趋势”“继续升温”“生态演进”“走向”等 adoption/evolution 判断，除非输入 Source Items 直接证明这种变化。",
      "- 如果只有若干 repository observations，title 应写成“X 类项目/能力出现于本次 Source Items”，而不是宣称整个生态变化。",
      "",
      "Input:",
      JSON.stringify(request, null, 2)
    ].join("\n")
  );

  const text = latestAssistantText(agent);
  if (!text) {
    throw new Error("Selection Stage did not return text");
  }

  return { text, events };
}

async function runRankingAgent(
  request: RankingRequest,
  runtime: StageModelRuntime
): Promise<{ text: string; events: string[] }> {
  const events: string[] = [];
  const agent = new Agent({
    initialState: {
      systemPrompt: [
        "你是 Daily Brief Agent 的 Signal Ranking Stage。",
        "你必须从候选 Signals 中决定最终排序和 low-signal 结果。",
        "不要补充候选外 Signal；如果候选不足或都弱，返回空 rankedSignals。",
        "输出必须是 JSON object。"
      ].join("\n"),
      model: runtime.model,
      thinkingLevel: runtime.thinkingLevel
    },
    sessionId: "daily-brief-signal-ranking",
    ...(runtime.getApiKey ? { getApiKey: runtime.getApiKey } : {})
  });

  agent.subscribe((event) => {
    events.push(`ranking:${event.type}`);
  });
  await agent.prompt(
    [
      "请对候选 Signals 排序，最多选择 maxSignals 个 strong signals。",
      "",
      "JSON schema:",
      "{",
      "  \"stage\": \"ranking\",",
      "  \"rankedSignals\": [{ \"signalId\": \"candidate signal id\", \"rank\": 1, \"reason\": \"grounded ranking reason\" }]",
      "}",
      "",
      "Input:",
      JSON.stringify(request, null, 2)
    ].join("\n")
  );

  const text = latestAssistantText(agent);
  if (!text) {
    throw new Error("Ranking Stage did not return text");
  }

  return { text, events };
}

export function mergeCandidateSignals(
  candidates: SelectionStageOutput["candidateSignals"]
): SelectionStageOutput["candidateSignals"] {
  const byId = new Map<string, SelectionStageOutput["candidateSignals"][number]>();

  for (const candidate of candidates) {
    const previous = byId.get(candidate.signalId);

    if (!previous) {
      byId.set(candidate.signalId, { ...candidate, sourceItemIds: unique(candidate.sourceItemIds) });
      continue;
    }

    byId.set(candidate.signalId, {
      ...previous,
      strength: previous.strength === "strong" || candidate.strength === "strong" ? "strong" : "weak",
      sourceItemIds: unique([...previous.sourceItemIds, ...candidate.sourceItemIds]),
      reason: unique([previous.reason, candidate.reason]).join(" / ")
    });
  }

  return [...byId.values()];
}

function buildFauxSelectionOutput(request: SelectionRequest): SelectionStageOutput {
  const itemById = new Map(request.sourceItems.map((item) => [item.id, item]));
  const candidateSignals: SelectionStageOutput["candidateSignals"] = [];
  const excludedSourceItems: NonNullable<SelectionStageOutput["excludedSourceItems"]> = [];

  for (const annotation of request.annotations) {
    const item = itemById.get(annotation.sourceItemId);

    if (!item) {
      continue;
    }

    if (annotation.relevance === "relevant" && annotation.focusAreaRelevance !== "none") {
      candidateSignals.push({
        signalId: `signal:${item.url.trim().toLowerCase()}`,
        title: item.title,
        signalType: inferSignalType(item, annotation),
        strength: annotation.focusAreaRelevance === "strong" || annotation.focusAreaRelevance === "partial" ? "strong" : "weak",
        sourceItemIds: [item.id],
        reason: annotation.summary
      });
    } else {
      excludedSourceItems.push({
        sourceItemId: item.id,
        reason: annotation.weakItemHints[0] ?? "Understanding Stage judged this Source Item too weak for a Signal."
      });
    }
  }

  return { stage: "selection", candidateSignals, excludedSourceItems };
}

function buildFauxRankingOutput(request: RankingRequest): RankingStageOutput {
  const strong = request.candidateSignals.filter((candidate) => candidate.strength === "strong");

  return {
    stage: "ranking",
    rankedSignals: strong.slice(0, request.maxSignals).map((candidate, index) => ({
      signalId: candidate.signalId,
      rank: index + 1,
      reason: candidate.reason
    }))
  };
}

function buildSignalsFromRanking(
  sourceItems: SourceItem[],
  candidates: SelectionStageOutput["candidateSignals"],
  ranking: RankingStageOutput
): Signal[] {
  const itemById = new Map(sourceItems.map((item) => [item.id, item]));
  const candidateById = new Map(candidates.map((candidate) => [candidate.signalId, candidate]));

  return ranking.rankedSignals.flatMap((ranked) => {
    const candidate = candidateById.get(ranked.signalId);

    if (!candidate) {
      return [];
    }

    const citedItems = candidate.sourceItemIds.flatMap((id) => {
      const item = itemById.get(id);
      return item ? [item] : [];
    });
    const citations: SignalCitation[] = citedItems.map((item) => ({
      sourceItemId: item.id,
      sourceId: item.sourceId,
      title: item.title,
      url: item.url
    }));
    const first = citedItems[0];

    if (!first) {
      return [];
    }

    return [
      {
        id: candidate.signalId,
        type: candidate.signalType ?? inferSignalType(first),
        title: candidate.title,
        summary: summarizeSelectedSignal(first, candidate.reason),
        whyItMatters: ranked.reason,
        citations
      }
    ];
  });
}

function summarizeSelectedSignal(item: SourceItem, reason: string): SignalSummary {
  return {
    whatItIs: item.platform === "github" ? `它是一个 GitHub repository：${reason}` : `它是一个 Source-grounded Signal：${reason}`,
    whatItIsNot: "不是未引用来源支撑的通用判断；当前只代表 Selection/Ranking Stages 基于 cited Source Items 选出的 Signal。",
    minimalExample: "最小地看，先回到 citations 中的 Source Item，确认这个判断是否被原文直接支撑。"
  };
}

function inferSignalType(
  item: Pick<SourceItem, "platform" | "title" | "analyzableText">,
  annotation?: UnderstandingStageOutput["sourceItemAnnotations"][number]
): SignalType {
  const text = `${item.title} ${item.analyzableText} ${annotation?.claims.join(" ") ?? ""}`.toLowerCase();

  if (text.includes("risk") || text.includes("failure") || text.includes("security")) {
    return "risk";
  }

  if (text.includes("coding agent") || text.includes("ai coding")) {
    return "ai-coding";
  }

  if (item.platform === "github" || text.includes("repo")) {
    return "tool-repo";
  }

  return "architecture";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function latestAssistantText(agent: Agent): string | undefined {
  const assistantMessage = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
  const text = assistantMessage?.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return text && text.trim().length > 0 ? text.trim() : undefined;
}
