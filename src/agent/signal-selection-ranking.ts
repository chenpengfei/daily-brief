import type { Signal, SignalCitation, SignalSummary, SignalType } from "../brief/index.js";
import type { SourceItem } from "../domain/index.js";
import type { AgentRunArtifact } from "../storage/index.js";
import { runAgentStage } from "./stage-runner.js";
import type { SelectionStageOutput, RankingStageOutput, UnderstandingStageOutput } from "./stage-contracts.js";

export interface SignalSelectionRankingResult {
  signals: Signal[];
  selection: SelectionStageOutput;
  ranking: RankingStageOutput;
}

export interface SignalSelectionRankingInput {
  sourceItems: SourceItem[];
  annotations: UnderstandingStageOutput["sourceItemAnnotations"];
  artifact: AgentRunArtifact;
  maxSignals?: number;
}

export async function runSignalSelectionAndRankingStages(
  input: SignalSelectionRankingInput
): Promise<SignalSelectionRankingResult> {
  const selectionRaw = buildSelectionOutput(input.sourceItems, input.annotations);
  const selectionStage = await runAgentStage<SelectionStageOutput>({
    stage: "selection",
    artifact: input.artifact,
    inputRefs: { sourceItemIds: input.sourceItems.map((item) => item.id) },
    validationContext: { sourceItemIds: input.sourceItems.map((item) => item.id) },
    execute: async () => selectionRaw
  });
  const merged = mergeCandidateSignals(selectionStage.output.candidateSignals);
  const rankingRaw = buildRankingOutput(merged, input.maxSignals ?? 5);
  const rankingStage = await runAgentStage<RankingStageOutput>({
    stage: "ranking",
    artifact: input.artifact,
    inputRefs: { sourceItemIds: unique(merged.flatMap((signal) => signal.sourceItemIds)), signalIds: merged.map((signal) => signal.signalId) },
    validationContext: { signalIds: merged.map((signal) => signal.signalId) },
    execute: async () => rankingRaw
  });

  return {
    signals: buildSignalsFromRanking(input.sourceItems, merged, rankingStage.output),
    selection: selectionStage.output,
    ranking: rankingStage.output
  };
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

function buildSelectionOutput(
  sourceItems: SourceItem[],
  annotations: UnderstandingStageOutput["sourceItemAnnotations"]
): SelectionStageOutput {
  const itemById = new Map(sourceItems.map((item) => [item.id, item]));
  const candidateSignals: SelectionStageOutput["candidateSignals"] = [];
  const excludedSourceItems: NonNullable<SelectionStageOutput["excludedSourceItems"]> = [];

  for (const annotation of annotations) {
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

function buildRankingOutput(candidates: SelectionStageOutput["candidateSignals"], maxSignals: number): RankingStageOutput {
  const strong = candidates.filter((candidate) => candidate.strength === "strong");

  return {
    stage: "ranking",
    rankedSignals: strong.slice(0, maxSignals).map((candidate, index) => ({
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
