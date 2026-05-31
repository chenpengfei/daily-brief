import { Agent } from "@earendil-works/pi-agent-core";
import type { DailyBrief, Signal, SignalSummary } from "../brief/index.js";
import type { SourceItem } from "../domain/index.js";
import { createStageModelRuntime, type StageModelRuntime } from "./model-stage-runtime.js";
import type { ModelRuntimeConfig, ModelRuntimeEnv } from "./model-runtime-config.js";
import type { AuditStageOutput } from "./stage-contracts.js";

interface SignalNarrative {
  signalId: string;
  focusAreas: string[];
  directions: string[];
  whatItIs: string;
  whatItIsNot: string;
  minimalExample: string;
  whyItMatters: string;
}

interface NarrativeResponse {
  executiveSummary: string;
  signalNarratives: SignalNarrative[];
}

export interface NarrativeRequest {
  signals: Array<{
    id: string;
    type: Signal["type"];
    title: string;
    currentFallback: {
      summary: SignalSummary;
      whyItMatters: string;
    };
    citedSourceItems: Array<{
      id: string;
      sourceId: string;
      platform: SourceItem["platform"];
      url: string;
      title: string;
      author?: string;
      publishedAt?: string;
      analyzableText: string;
      metadata?: Record<string, unknown>;
    }>;
  }>;
}

export interface SignalNarrativeEnrichmentResult {
  brief: DailyBrief;
  events: string[];
}

export class NarrativeGroundingError extends Error {
  readonly findings: string[];

  constructor(findings: string[]) {
    super(`Signal narrative grounding failed:\n${findings.map((finding) => `- ${finding}`).join("\n")}`);
    this.name = "NarrativeGroundingError";
    this.findings = findings;
  }
}

export async function enrichDailyBriefNarrativeWithAgent(input: {
  brief: DailyBrief;
  sourceItems: SourceItem[];
  modelRuntimeConfig: ModelRuntimeConfig;
  modelRuntimeEnv?: ModelRuntimeEnv;
  repairContext?: NarrativeRepairContext;
}): Promise<SignalNarrativeEnrichmentResult> {
  const request = buildNarrativeRequest(input.brief, input.sourceItems);
  const events: string[] = [];
  let groundingFindings = input.repairContext?.groundingFindings ?? [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const runtime = createStageModelRuntime({
      config: input.modelRuntimeConfig,
      env: input.modelRuntimeEnv ?? process.env,
      fauxResponse: JSON.stringify(buildFauxNarrativeResponse(request))
    });

    try {
      const response = await runNarrativeAgent(request, runtime, {
        attempt,
        ...(input.repairContext?.auditFindings ? { auditFindings: input.repairContext.auditFindings } : {}),
        ...(groundingFindings.length > 0 ? { groundingFindings } : {})
      });
      events.push(...response.events);
      const narrative = parseNarrativeResponse(response.text);
      assertNarrativeGrounding(request, narrative);

      return {
        brief: applyNarratives(input.brief, narrative),
        events
      };
    } catch (error) {
      if (error instanceof NarrativeGroundingError && attempt < 2) {
        groundingFindings = error.findings;
        continue;
      }

      throw error;
    } finally {
      runtime.unregister?.();
    }
  }

  throw new Error("Signal narrative Agent exhausted retry attempts");
}

export interface NarrativeRepairContext {
  auditFindings?: AuditStageOutput["findings"];
  groundingFindings?: string[];
}

function buildNarrativeRequest(brief: DailyBrief, sourceItems: SourceItem[]): NarrativeRequest {
  const itemsById = new Map(sourceItems.map((item) => [item.id, item]));

  return {
    signals: brief.signals.map((signal) => ({
      id: signal.id,
      type: signal.type,
      title: signal.title,
      currentFallback: {
        summary: signal.summary,
        whyItMatters: signal.whyItMatters
      },
      citedSourceItems: signal.citations.flatMap((citation) => {
        const item = itemsById.get(citation.sourceItemId);

        if (!item) {
          return [];
        }

        return [
          {
            id: item.id,
            sourceId: item.sourceId,
            platform: item.platform,
            url: item.url,
            title: item.title,
            ...(item.author ? { author: item.author } : {}),
            ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
            analyzableText: item.analyzableText,
            ...(item.metadata ? { metadata: item.metadata } : {})
          }
        ];
      })
    }))
  };
}

async function runNarrativeAgent(
  request: NarrativeRequest,
  runtime: StageModelRuntime,
  feedback: { attempt: number; auditFindings?: AuditStageOutput["findings"]; groundingFindings?: string[] }
): Promise<{ text: string; events: string[] }> {
  const events: string[] = [];
  const agent = new Agent({
    initialState: {
      systemPrompt: [
        "你是 Daily Brief Agent 的 Signal narrative 子任务。",
        "你必须只基于用户提供的 cited Source Items 理解内容，生成读者可用的中文说明。",
        "不要做开放研究，不要补充未引用事实，不要把 GitHub trending 当作质量背书。",
        "保留项目名、库名、关键英文技术词。输出必须是 JSON object，不要 Markdown，不要解释。"
      ].join("\n"),
      model: runtime.model,
      thinkingLevel: runtime.thinkingLevel
    },
    sessionId: "daily-brief-signal-narrative",
    ...(runtime.getApiKey ? { getApiKey: runtime.getApiKey } : {})
  });

  agent.subscribe((event) => {
    events.push(`signal_narrative:${event.type}`);
  });

  await agent.prompt(
    [
      "请为每个 Signal 生成 narrative 字段。",
      "",
      "JSON schema:",
      "{",
      "  \"executiveSummary\": \"一句简洁中文 Executive Summary\",",
      "  \"signalNarratives\": [",
      "    {",
      "      \"signalId\": \"signal id from input\",",
      "      \"focusAreas\": [\"Agent 架构|AI Coding\"],",
      "      \"directions\": [\"先进工具|长程任务|持续学习|自我改进|人与 Agent 的边界\"],",
      "      \"whatItIs\": \"是什么：一句中文，说明它到底是什么\",",
      "      \"whatItIsNot\": \"不是什么：一句中文，澄清容易误解的边界\",",
      "      \"minimalExample\": \"最小例子：一句中文，用最小具体场景帮助理解\",",
      "      \"whyItMatters\": \"为什么重要：一句中文，具体说明它对 Agent Architecture 或 AI Coding 的意义\"",
      "    }",
      "  ]",
      "}",
      "",
      "质量要求:",
      "- 不要复述模板句。",
      "- whyItMatters 必须具体到这个 Signal，不能只说“可能改变工具链”。",
      "- whatItIsNot 不是否定项目价值，而是防止误读。",
      "- minimalExample 要足够小，小到今天读者可以立刻想象怎么验证。",
      "- 如果 Source Item 信息不足，明确写“当前 Source Item 只表明...”。",
      "- 不要写“从 X 扩展到 Y”“正在走向...”这类演进判断，除非 cited Source Items 同时支撑 X 和 Y。",
      "- 不要把 IDE 补全、长期维护、代码审查、harness 运行时调度等常见 AI Coding 背景知识写进 narrative，除非 cited Source Items 明确提到。",
      "- minimalExample 只能使用 cited Source Items 明确描述的能力；不要发明 harness 何时调用 skill 之类的执行机制。",
      "- whyItMatters 可以说明它对设计者提出了什么检查点，但不能声称它已经支撑未被 cited Source Items 直接提到的 workflow。",
      "- citedSourceItems 不是有序映射列表。多个 citation 只能写“共同表明/共同构成/共同指向”这类集合性判断。",
      "- 禁止写“分别指向”“分别对应”“一一对应”“respectively”这类把多个 Source Items 映射到多个结论的句子，除非每个映射都能在对应 Source Item 原文中逐字找到支撑。",
      "- 如果需要说明某个 Source Item 支撑某个能力，必须点名该 Source Item 的 id 或 title，并且只使用它 analyzableText 或 metadata 明确给出的词。",
      ...(feedback.attempt > 1 || feedback.auditFindings?.length || feedback.groundingFindings?.length
        ? [
            "",
            "这是一次 bounded repair retry。必须修复上一轮发现的问题，不要扩大叙述范围。",
            "上一轮 Audit findings:",
            JSON.stringify(feedback.auditFindings ?? [], null, 2),
            "上一轮 Narrative grounding findings:",
            JSON.stringify(feedback.groundingFindings ?? [], null, 2)
          ]
        : []),
      "",
      "Input:",
      JSON.stringify(request, null, 2)
    ].join("\n")
  );

  const text = latestAssistantText(agent);

  if (!text) {
    throw new Error("Signal narrative Agent did not return text");
  }

  return { text, events };
}

function latestAssistantText(agent: Agent): string | undefined {
  const assistantMessage = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
  const text = assistantMessage?.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return text && text.trim().length > 0 ? text.trim() : undefined;
}

function parseNarrativeResponse(text: string): NarrativeResponse {
  const jsonText = extractJsonObject(text);
  const parsed = JSON.parse(jsonText) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("Signal narrative Agent returned non-object JSON");
  }

  return {
    executiveSummary: readRequiredString(parsed, "executiveSummary"),
    signalNarratives: readSignalNarrativeArray(parsed.signalNarratives)
  };
}

export function assertNarrativeGrounding(request: NarrativeRequest, narrativeResponse: NarrativeResponse): void {
  const requestBySignal = new Map(request.signals.map((signal) => [signal.id, signal]));
  const findings: string[] = [];

  for (const narrative of narrativeResponse.signalNarratives) {
    const signal = requestBySignal.get(narrative.signalId);

    if (!signal || signal.citedSourceItems.length < 2) {
      continue;
    }

    const text = [
      narrative.whatItIs,
      narrative.whatItIsNot,
      narrative.minimalExample,
      narrative.whyItMatters
    ].join(" ");

    if (/分别(?:指向|对应|代表|说明|表明|描述)|一一对应|respectively/i.test(text)) {
      findings.push(
        `${narrative.signalId} uses ordered per-source mapping language across multiple cited Source Items; use source-specific support or a collective claim instead.`
      );
    }
  }

  if (findings.length > 0) {
    throw new NarrativeGroundingError(findings);
  }
}

function extractJsonObject(text: string): string {
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Signal narrative Agent returned invalid JSON");
  }

  return withoutFence.slice(start, end + 1);
}

function readSignalNarrativeArray(value: unknown): SignalNarrative[] {
  if (!Array.isArray(value)) {
    throw new Error("Signal narrative Agent requires signalNarratives array");
  }

  return value.map(parseSignalNarrative);
}

function parseSignalNarrative(value: unknown): SignalNarrative {
  if (!isRecord(value)) {
    throw new Error("Signal narrative item must be an object");
  }

  return {
    signalId: readRequiredString(value, "signalId"),
    focusAreas: readRequiredStringArray(value, "focusAreas"),
    directions: readRequiredStringArray(value, "directions"),
    whatItIs: readRequiredString(value, "whatItIs"),
    whatItIsNot: readRequiredString(value, "whatItIsNot"),
    minimalExample: readRequiredString(value, "minimalExample"),
    whyItMatters: readRequiredString(value, "whyItMatters")
  };
}

function applyNarratives(brief: DailyBrief, narrativeResponse: NarrativeResponse): DailyBrief {
  const bySignalId = new Map(narrativeResponse.signalNarratives.map((narrative) => [narrative.signalId, narrative]));

  return {
    ...brief,
    executiveSummary: narrativeResponse.executiveSummary,
    signals: brief.signals.map((signal) => {
      const narrative = bySignalId.get(signal.id);

      if (!narrative) {
        throw new Error(`Signal narrative Agent omitted ${signal.id}`);
      }

      return {
        ...signal,
        focusAreas: narrative.focusAreas,
        directions: narrative.directions,
        summary: {
          whatItIs: narrative.whatItIs,
          whatItIsNot: narrative.whatItIsNot,
          minimalExample: narrative.minimalExample
        },
        whyItMatters: narrative.whyItMatters
      };
    })
  };
}

function buildFauxNarrativeResponse(request: NarrativeRequest): NarrativeResponse {
  return {
    executiveSummary:
      request.signals.length === 0
        ? "今天是 low-signal day：Agent Stages 没有选出足够强、可由 Source Items 支撑的 Signals。"
        : `今天有 ${request.signals.length} 个 Agent-generated Signals，重点围绕 Agent 架构与 AI Coding 的可回溯变化。`,
    signalNarratives: request.signals.map((signal) => {
      const sourceText = signal.citedSourceItems[0]?.analyzableText ?? signal.title;

      return {
        signalId: signal.id,
        focusAreas: inferFocusAreas(signal),
        directions: inferDirections(signal),
        whatItIs: `当前 Source Item 表明：${sourceText}`,
        whatItIsNot: `它不是对 ${signal.title} 的成熟度背书；只是本次来源中可回溯的一条 ${signal.type} Signal。`,
        minimalExample: `最小例子：围绕 ${signal.title} 选一个 README 或小任务，验证它描述的能力是否成立。`,
        whyItMatters: `它值得关注，因为 ${signal.title} 暴露了一个可检查的 Agent Architecture 或 AI Coding 实践切面。`
      };
    })
  };
}

function readRequiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Signal narrative item requires ${key}`);
  }

  return value.trim();
}

function readRequiredStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];

  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    throw new Error(`Signal narrative item requires ${key}`);
  }

  return value.map((entry) => String(entry).trim());
}

function inferFocusAreas(signal: NarrativeRequest["signals"][number]): string[] {
  if (signal.type === "ai-coding") {
    return ["AI Coding"];
  }

  if (signal.type === "architecture") {
    return ["Agent 架构"];
  }

  return ["Agent 架构", "AI Coding"];
}

function inferDirections(signal: NarrativeRequest["signals"][number]): string[] {
  const text = `${signal.title} ${signal.citedSourceItems.map((item) => item.analyzableText).join(" ")}`.toLowerCase();
  const directions: string[] = [];

  if (signal.type === "tool-repo" || text.includes("tool")) directions.push("先进工具");
  if (text.includes("long") || text.includes("workflow")) directions.push("长程任务");
  if (text.includes("learning")) directions.push("持续学习");
  if (text.includes("improve") || text.includes("optimization")) directions.push("自我改进");
  if (text.includes("human") || text.includes("boundary")) directions.push("人与 Agent 的边界");

  return directions.length > 0 ? directions : ["先进工具"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
