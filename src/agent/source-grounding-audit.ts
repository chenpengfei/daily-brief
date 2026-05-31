import { Agent } from "@earendil-works/pi-agent-core";
import type { DailyBrief } from "../brief/index.js";
import type { SourceItem } from "../domain/index.js";
import type { AgentRunArtifact, AgentRunInputRefs } from "../storage/index.js";
import { createStageModelRuntime, type StageModelRuntime } from "./model-stage-runtime.js";
import type { ModelRuntimeConfig, ModelRuntimeEnv } from "./model-runtime-config.js";
import { runAgentStage } from "./stage-runner.js";
import type { AuditStageOutput } from "./stage-contracts.js";

export class AnalysisFailureError extends Error {
  readonly findings: AuditStageOutput["findings"];

  constructor(message: string, findings: AuditStageOutput["findings"]) {
    super(message);
    this.name = "AnalysisFailureError";
    this.findings = findings;
  }
}

export async function runSourceGroundingAuditStage(input: {
  brief: DailyBrief;
  sourceItems: SourceItem[];
  artifact: AgentRunArtifact;
  modelRuntimeConfig?: ModelRuntimeConfig;
  modelRuntimeEnv?: ModelRuntimeEnv;
  inputRefs?: AgentRunInputRefs;
  allowRepair?: boolean;
}): Promise<{ brief: DailyBrief; audit: AuditStageOutput; repairAttempts: number }> {
  const modelRuntimeConfig = input.modelRuntimeConfig ?? {
    provider: "faux" as const,
    model: "faux-daily-brief-renderer",
    ready: true,
    issues: []
  };
  const first = await recordAudit(
    input.brief,
    input.sourceItems,
    input.artifact,
    modelRuntimeConfig,
    input.modelRuntimeEnv ?? process.env,
    input.inputRefs
  );

  if (first.status === "passed") {
    return { brief: input.brief, audit: first, repairAttempts: 0 };
  }

  throw new AnalysisFailureError("Source-grounding audit failed", first.findings);
}

async function recordAudit(
  brief: DailyBrief,
  sourceItems: SourceItem[],
  artifact: AgentRunArtifact,
  modelRuntimeConfig: ModelRuntimeConfig,
  modelRuntimeEnv: ModelRuntimeEnv,
  inputRefs: AgentRunInputRefs | undefined
): Promise<AuditStageOutput> {
  const sourceItemIds = sourceItems.map((item) => item.id);
  const signalIds = brief.signals.map((signal) => signal.id);
  const request = buildAuditRequest(brief, sourceItems);
  const runtime = createStageModelRuntime({
    config: modelRuntimeConfig,
    env: modelRuntimeEnv,
    fauxResponse: JSON.stringify(buildFauxAuditOutput(brief, sourceItems))
  });
  const response = await runAuditAgent(request, runtime);
  const result = await runAgentStage<AuditStageOutput>({
    stage: "audit",
    artifact,
    inputRefs: { ...(inputRefs ?? {}), sourceItemIds, signalIds },
    validationContext: { sourceItemIds, signalIds },
    execute: async () => response.text
  });

  return result.output;
}

function buildAuditRequest(brief: DailyBrief, sourceItems: SourceItem[]): unknown {
  return {
    brief,
    citedSourceItems: sourceItems.map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      platform: item.platform,
      url: item.url,
      title: item.title,
      analyzableText: item.analyzableText,
      ...(item.metadata ? { metadata: item.metadata } : {})
    }))
  };
}

async function runAuditAgent(request: unknown, runtime: StageModelRuntime): Promise<{ text: string; events: string[] }> {
  const events: string[] = [];
  const agent = new Agent({
    initialState: {
      systemPrompt: [
        "你是 Daily Brief Agent 的 Source-grounding Audit Stage。",
        "你必须审查 brief 中每个 narrative 是否被 cited Source Items 支撑。",
        "重点检查 unsupported claims、generic AI drift、open-ended research leakage、citation mismatch、coverage overstatement。",
        "不要修复 brief，只输出 audit JSON。"
      ].join("\n"),
      model: runtime.model,
      thinkingLevel: runtime.thinkingLevel
    },
    sessionId: "daily-brief-source-grounding-audit",
    ...(runtime.getApiKey ? { getApiKey: runtime.getApiKey } : {})
  });

  agent.subscribe((event) => {
    events.push(`audit:${event.type}`);
  });
  await agent.prompt(
    [
      "请审查 Daily Brief 是否 Source-grounded。",
      "",
      "JSON schema:",
      "{",
      "  \"stage\": \"audit\",",
      "  \"status\": \"passed|failed\",",
      "  \"findings\": [{ \"signalId\": \"optional known signal id\", \"sourceItemId\": \"optional known source item id\", \"issue\": \"specific issue\" }]",
      "}",
      "",
      "如果无法确认某个强断言被 cited Source Item 支撑，必须 failed。",
      "如果 Source Coverage 有 partial failures，Executive Summary 不得声称完整覆盖。",
      "Source Coverage 的 Processed N Source Items from M Sources 是运行覆盖统计，不表示 Top Signals 必须叙述每个 Source Item；不要因为未引用所有 Source Items 而 failed。",
      "whyItMatters 和 minimalExample 可以包含基于 cited facts 的有限读者含义或设计检查点；只要它没有引入外部事实、质量背书、采用趋势或未支撑能力，不要仅因 Source Item 没有逐字说“设计者需要...”而 failed。",
      "对规范性措辞的审查重点是是否越过 cited facts：例如“必须采用”“已经成熟”“广泛使用”需要直接支撑；“提醒设计者检查...”这类弱含义可由 cited capabilities 支撑。",
      "",
      "Input:",
      JSON.stringify(request, null, 2)
    ].join("\n")
  );

  const text = latestAssistantText(agent);
  if (!text) {
    throw new Error("Audit Stage did not return text");
  }

  return { text, events };
}

function buildFauxAuditOutput(brief: DailyBrief, sourceItems: SourceItem[]): AuditStageOutput {
  const sourceItemIds = new Set(sourceItems.map((item) => item.id));
  const findings: AuditStageOutput["findings"] = [];

  if (brief.sourceCoverage.partialFailures.length > 0 && /全部|完整|all sources|complete/i.test(brief.executiveSummary)) {
    findings.push({ issue: "Executive Summary overstates collection completeness despite partial failures." });
  }

  for (const signal of brief.signals) {
    if (signal.citations.length === 0) {
      findings.push({ signalId: signal.id, issue: "Signal has no citations." });
    }

    if (!signal.focusAreas || signal.focusAreas.length === 0) {
      findings.push({ signalId: signal.id, issue: "Signal lens focusAreas are missing." });
    }

    if (!signal.directions || signal.directions.length === 0) {
      findings.push({ signalId: signal.id, issue: "Signal lens directions are missing." });
    }

    for (const citation of signal.citations) {
      if (!sourceItemIds.has(citation.sourceItemId)) {
        findings.push({
          signalId: signal.id,
          issue: `Citation references unknown Source Item: ${citation.sourceItemId}`
        });
      }
    }

    const narrative = `${signal.summary.whatItIs} ${signal.summary.whatItIsNot} ${signal.summary.minimalExample} ${signal.whyItMatters}`;
    if (/market leader|guaranteed|best in class|widely adopted/i.test(narrative)) {
      findings.push({ signalId: signal.id, issue: "Narrative contains unsupported overconfident claim." });
    }
    if (
      signal.citations.length > 1 &&
      /分别(?:指向|对应|代表|说明|表明|描述)|一一对应|respectively/i.test(narrative)
    ) {
      findings.push({ signalId: signal.id, issue: "Narrative contains risky per-source mapping across multiple citations." });
    }
  }

  return {
    stage: "audit",
    status: findings.length === 0 ? "passed" : "failed",
    findings
  };
}

function latestAssistantText(agent: Agent): string | undefined {
  const assistantMessage = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
  const text = assistantMessage?.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return text && text.trim().length > 0 ? text.trim() : undefined;
}
