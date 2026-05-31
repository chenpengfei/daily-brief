import { Agent } from "@earendil-works/pi-agent-core";
import type { DailyBrief } from "../brief/index.js";
import type { SourceItem } from "../domain/index.js";
import type { AgentRunArtifact, AgentRunInputRefs } from "../storage/index.js";
import { createStageModelRuntime, type StageModelRuntime } from "./model-stage-runtime.js";
import type { ModelRuntimeConfig, ModelRuntimeEnv } from "./model-runtime-config.js";
import { runAgentStage } from "./stage-runner.js";
import type { AuditStageOutput, RepairStageOutput } from "./stage-contracts.js";

export async function runSourceGroundingRepairStage(input: {
  brief: DailyBrief;
  sourceItems: SourceItem[];
  auditFindings: AuditStageOutput["findings"];
  artifact: AgentRunArtifact;
  modelRuntimeConfig: ModelRuntimeConfig;
  modelRuntimeEnv?: ModelRuntimeEnv;
  inputRefs?: AgentRunInputRefs;
}): Promise<{ brief: DailyBrief; repair: RepairStageOutput; events: string[] }> {
  const request = buildRepairRequest(input.brief, input.sourceItems, input.auditFindings);
  const runtime = createStageModelRuntime({
    config: input.modelRuntimeConfig,
    env: input.modelRuntimeEnv ?? process.env,
    fauxResponse: JSON.stringify(buildFauxRepairOutput(input.brief))
  });

  try {
    const response = await runRepairAgent(request, runtime);
    const sourceItemIds = input.sourceItems.map((item) => item.id);
    const signalIds = input.brief.signals.map((signal) => signal.id);
    const result = await runAgentStage<RepairStageOutput>({
      stage: "repair",
      artifact: input.artifact,
      inputRefs: {
        ...(input.inputRefs ?? {}),
        sourceItemIds,
        signalIds,
        repair: { stage: "audit", findings: input.auditFindings }
      },
      validationContext: { sourceItemIds, signalIds },
      execute: async () => response.text
    });

    return {
      brief: applyRepair(input.brief, result.output),
      repair: result.output,
      events: response.events
    };
  } finally {
    runtime.unregister?.();
  }
}

function buildRepairRequest(
  brief: DailyBrief,
  sourceItems: SourceItem[],
  auditFindings: AuditStageOutput["findings"]
): unknown {
  return {
    brief,
    auditFindings,
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

async function runRepairAgent(request: unknown, runtime: StageModelRuntime): Promise<{ text: string; events: string[] }> {
  const events: string[] = [];
  const agent = new Agent({
    initialState: {
      systemPrompt: [
        "你是 Daily Brief Agent 的 Source-grounding Repair Stage。",
        "你只根据 Audit findings 对 brief 做最小必要修改。",
        "不得引入新事实，不得删除 citation 来逃避问题，不得扩大叙述范围。",
        "如果某个断言无法被 cited Source Items 支撑，必须改弱、改成集合性表述，或明确写成 Source Item 只表明的范围。",
        "输出必须是 JSON object，不要 Markdown，不要解释。"
      ].join("\n"),
      model: runtime.model,
      thinkingLevel: runtime.thinkingLevel
    },
    sessionId: "daily-brief-source-grounding-repair",
    ...(runtime.getApiKey ? { getApiKey: runtime.getApiKey } : {})
  });

  agent.subscribe((event) => {
    events.push(`repair:${event.type}`);
  });
  await agent.prompt(
    [
      "请根据 Audit findings 修复 Daily Brief narrative。",
      "",
      "JSON schema:",
      "{",
      "  \"stage\": \"repair\",",
      "  \"executiveSummary\": \"可选：修复后的 Executive Summary\",",
      "  \"signalNarratives\": [",
      "    {",
      "      \"signalId\": \"signal id from input\",",
      "      \"focusAreas\": [\"Agent 架构|AI Coding\"],",
      "      \"directions\": [\"先进工具|长程任务|持续学习|自我改进|人与 Agent 的边界\"],",
      "      \"whatItIs\": \"修复后的是什么\",",
      "      \"whatItIsNot\": \"修复后的不是什么\",",
      "      \"minimalExample\": \"修复后的最小例子\",",
      "      \"whyItMatters\": \"修复后的为什么重要\"",
      "    }",
      "  ]",
      "}",
      "",
      "修复要求:",
      "- 只修改 Audit findings 指出的相关 Signal。",
      "- 保留读者可读性和具体性。",
      "- 一一映射是允许的，但每个映射都必须被对应 Source Item 直接支撑；不确定时改成集合性或更弱的表述。",
      "- 修复后仍必须能通过 Source-grounding Audit。",
      "",
      "Input:",
      JSON.stringify(request, null, 2)
    ].join("\n")
  );

  const text = latestAssistantText(agent);
  if (!text) {
    throw new Error("Repair Stage did not return text");
  }

  return { text, events };
}

function buildFauxRepairOutput(brief: DailyBrief): RepairStageOutput {
  return {
    stage: "repair",
    executiveSummary: brief.executiveSummary,
    signalNarratives: brief.signals.map((signal) => ({
      signalId: signal.id,
      focusAreas: signal.focusAreas ?? [],
      directions: signal.directions ?? [],
      whatItIs: weakenRiskyMapping(signal.summary.whatItIs),
      whatItIsNot: signal.summary.whatItIsNot,
      minimalExample: signal.summary.minimalExample,
      whyItMatters: signal.whyItMatters
    }))
  };
}

function weakenRiskyMapping(value: string): string {
  return value
    .replace(/分别(?:指向|对应|代表|说明|表明|描述)/g, "共同表明")
    .replace(/一一对应/g, "共同对应")
    .replace(/respectively/gi, "collectively");
}

function applyRepair(brief: DailyBrief, repair: RepairStageOutput): DailyBrief {
  const bySignalId = new Map(repair.signalNarratives.map((narrative) => [narrative.signalId, narrative]));

  return {
    ...brief,
    ...(repair.executiveSummary ? { executiveSummary: repair.executiveSummary } : {}),
    signals: brief.signals.map((signal) => {
      const narrative = bySignalId.get(signal.id);

      if (!narrative) {
        return signal;
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

function latestAssistantText(agent: Agent): string | undefined {
  const assistantMessage = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
  const text = assistantMessage?.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return text && text.trim().length > 0 ? text.trim() : undefined;
}
