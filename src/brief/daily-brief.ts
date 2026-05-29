import type { Source } from "../domain/index.js";
import type { SourceItem } from "../domain/index.js";

export type SignalType = "architecture" | "ai-coding" | "tool-repo" | "risk";

export interface SignalCitation {
  sourceItemId: string;
  sourceId: string;
  title: string;
  url: string;
}

export interface Signal {
  id: string;
  type: SignalType;
  title: string;
  whyItMatters: string;
  citations: SignalCitation[];
}

export interface SourceCoverage {
  sourceItemCount: number;
  sourceCount: number;
  partialFailures: string[];
}

export interface DailyBrief {
  date: Date;
  executiveSummary: string;
  signals: Signal[];
  sourceCoverage: SourceCoverage;
}

export interface DailyBriefInput {
  date: Date;
  sources: Source[];
}

export interface GenerateDailyBriefInput {
  date: Date;
  sourceItems: SourceItem[];
  partialFailures?: string[];
}

export function generateLowSignalDailyBrief(input: DailyBriefInput): string {
  const date = input.date.toISOString().slice(0, 10);
  const enabledSources = input.sources.filter((source) => source.enabled);
  const disabledSources = input.sources.length - enabledSources.length;

  return [
    `# Daily Brief - ${date}`,
    "",
    "## Executive Summary",
    "",
    "今天是 low-signal day：当前 Collection Window 没有可用于生成 Top Signals 的 Source Items。系统仍然生成 Brief，以确认每日链路可运行，并避免用弱信号填充内容。",
    "",
    "## Top Signals",
    "",
    "暂无可引用的 Signals。没有 Source Item 引用支撑的判断不会进入 Daily Brief。",
    "",
    "## Source Coverage",
    "",
    input.sources.length === 0
      ? "Source Registry 当前为空；本次运行没有可采集的 Sources。"
      : `读取到 ${input.sources.length} 个 Sources，其中 ${enabledSources.length} 个启用，${disabledSources} 个停用。本次基础链路尚未接入真实 Fetch Adapter，因此没有产生 Source Items。`,
    "",
    "## Sources",
    "",
    input.sources.length === 0
      ? "- None configured."
      : input.sources
          .map((source) => {
            const state = source.enabled ? "enabled" : "disabled";
            return `- ${source.id} (${source.platform}, ${source.adapter}, ${state}) - ${source.target}`;
          })
          .join("\n"),
    ""
  ].join("\n");
}

export function generateDailyBrief(input: GenerateDailyBriefInput): DailyBrief {
  const relevantItems = input.sourceItems.filter(isRelevantSourceItem);
  const signals = buildSignals(relevantItems);
  const sourceIds = new Set(input.sourceItems.map((item) => item.sourceId));

  return {
    date: input.date,
    executiveSummary:
      signals.length === 0
        ? "今天是 low-signal day：没有足够 Source-grounded 的 Agent Architecture 或 AI Coding Signals。"
        : `今天有 ${signals.length} 个 Source-grounded Signals，均保留 Source Item citation 以便回溯。`,
    signals,
    sourceCoverage: {
      sourceItemCount: input.sourceItems.length,
      sourceCount: sourceIds.size,
      partialFailures: input.partialFailures ?? []
    }
  };
}

export function renderDailyBriefMarkdown(brief: DailyBrief): string {
  const date = brief.date.toISOString().slice(0, 10);

  return [
    `# Daily Brief - ${date}`,
    "",
    "## Executive Summary",
    "",
    brief.executiveSummary,
    "",
    "## Top Signals",
    "",
    brief.signals.length === 0
      ? "暂无可引用的 Signals。没有 Source Item 引用支撑的判断不会进入 Daily Brief。"
      : brief.signals.map(renderSignal).join("\n\n"),
    "",
    "## Source Coverage",
    "",
    renderSourceCoverage(brief.sourceCoverage),
    "",
    "## Sources",
    "",
    renderSources(brief.signals),
    ""
  ].join("\n");
}

function buildSignals(items: SourceItem[]): Signal[] {
  const groups = new Map<string, SourceItem[]>();

  for (const item of items) {
    const key = normalizeSignalKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()].map(([key, group]) => {
    const primary = group[0];

    if (!primary) {
      throw new Error(`Cannot build Signal for empty group: ${key}`);
    }

    return {
      id: `signal:${key}`,
      type: classifySignal(primary),
      title: primary.title,
      whyItMatters: explainWhyItMatters(primary),
      citations: group.map((item) => ({
        sourceItemId: item.id,
        sourceId: item.sourceId,
        title: item.title,
        url: item.url
      }))
    };
  });
}

function isRelevantSourceItem(item: SourceItem): boolean {
  const text = `${item.title} ${item.analyzableText}`.toLowerCase();
  const terms = [
    "agent architecture",
    "agent runtime",
    "coding agent",
    "ai coding",
    "tool execution",
    "eval",
    "memory",
    "workflow",
    "source-grounded",
    "mcp"
  ];

  return terms.some((term) => text.includes(term));
}

function classifySignal(item: SourceItem): SignalType {
  const text = `${item.title} ${item.analyzableText}`.toLowerCase();

  if (text.includes("risk") || text.includes("failure") || text.includes("security")) {
    return "risk";
  }

  if (text.includes("coding agent") || text.includes("ai coding")) {
    return "ai-coding";
  }

  if (item.platform === "github" || text.includes("repo") || text.includes("tool repo")) {
    return "tool-repo";
  }

  return "architecture";
}

function explainWhyItMatters(item: SourceItem): string {
  const type = classifySignal(item);
  const reasonByType: Record<SignalType, string> = {
    architecture: "它提供了 Agent Architecture 的具体实现或设计线索，值得进一步阅读原文。",
    "ai-coding": "它影响工程团队使用 Coding Agents 构建和维护软件的实践方式。",
    "tool-repo": "它指向一个可能改变 Agent 工具链或实现选择的项目/工具信号。",
    risk: "它提示了构建或运行 Agent 系统时需要显式管理的风险。"
  };

  return reasonByType[type];
}

function normalizeSignalKey(item: SourceItem): string {
  return item.url.trim().toLowerCase();
}

function renderSignal(signal: Signal): string {
  return [
    `### ${signal.title}`,
    "",
    `- Type: ${signal.type}`,
    `- why_it_matters: ${signal.whyItMatters}`,
    `- Citations: ${signal.citations.map((citation) => citation.sourceItemId).join(", ")}`
  ].join("\n");
}

function renderSourceCoverage(coverage: SourceCoverage): string {
  const base = `Processed ${coverage.sourceItemCount} Source Items from ${coverage.sourceCount} Sources.`;

  if (coverage.partialFailures.length === 0) {
    return base;
  }

  return `${base}\nPartial failures: ${coverage.partialFailures.join("; ")}`;
}

function renderSources(signals: Signal[]): string {
  const citations = signals.flatMap((signal) => signal.citations);

  if (citations.length === 0) {
    return "- None cited.";
  }

  return citations
    .map((citation) => `- ${citation.sourceItemId}: [${citation.title}](${citation.url})`)
    .join("\n");
}
