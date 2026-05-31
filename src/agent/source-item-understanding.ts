import { Agent } from "@earendil-works/pi-agent-core";
import {
  fauxAssistantMessage,
  getModel,
  registerBuiltInApiProviders,
  registerFauxProvider,
  type Model
} from "@earendil-works/pi-ai";
import type { SourceItem } from "../domain/index.js";
import type { AgentRunArtifact } from "../storage/index.js";
import { runAgentStage } from "./stage-runner.js";
import {
  AgentStageValidationError,
  type UnderstandingStageOutput
} from "./stage-contracts.js";
import { resolveModelApiKey, type ModelRuntimeConfig, type ModelRuntimeEnv } from "./model-runtime-config.js";

export interface SourceItemUnderstandingResult {
  annotations: UnderstandingStageOutput["sourceItemAnnotations"];
  batchCount: number;
  events: string[];
}

export interface SourceItemUnderstandingOptions {
  sourceItems: SourceItem[];
  modelRuntimeConfig: ModelRuntimeConfig;
  modelRuntimeEnv?: ModelRuntimeEnv;
  artifact?: AgentRunArtifact;
  maxBatchCharacters?: number;
}

interface UnderstandingRequest {
  sourceItems: Array<{
    id: string;
    sourceId: string;
    platform: SourceItem["platform"];
    url: string;
    title: string;
    analyzableText: string;
    metadata?: Record<string, unknown>;
  }>;
}

export async function runSourceItemUnderstandingStage(
  input: SourceItemUnderstandingOptions
): Promise<SourceItemUnderstandingResult> {
  if (input.sourceItems.length === 0) {
    return { annotations: [], batchCount: 0, events: [] };
  }

  const batches = batchSourceItems(input.sourceItems, input.maxBatchCharacters ?? 60_000);
  const annotations: UnderstandingStageOutput["sourceItemAnnotations"] = [];
  const events: string[] = [];

  for (const [index, batch] of batches.entries()) {
    const request = buildUnderstandingRequest(batch);
    const runtime = createUnderstandingRuntime(input.modelRuntimeConfig, input.modelRuntimeEnv ?? process.env, request);

    try {
      const response = await runUnderstandingAgent(request, runtime);
      events.push(...response.events.map((event) => `understanding:${index + 1}/${batches.length}:${event}`));
      const stage = await runAgentStage<UnderstandingStageOutput>({
        stage: "understanding",
        artifact: input.artifact ?? createInMemoryArtifact(input.modelRuntimeConfig),
        inputRefs: {
          sourceItemIds: batch.map((item) => item.id),
          batch: { index: index + 1, total: batches.length }
        },
        validationContext: {
          sourceItemIds: batch.map((item) => item.id)
        },
        execute: async () => response.text
      });

      annotations.push(...stage.output.sourceItemAnnotations);
    } finally {
      runtime.unregister?.();
    }
  }

  validateMergedAnnotations(input.sourceItems, annotations);

  return {
    annotations,
    batchCount: batches.length,
    events
  };
}

export function batchSourceItems(sourceItems: SourceItem[], maxBatchCharacters: number): SourceItem[][] {
  if (!Number.isFinite(maxBatchCharacters) || maxBatchCharacters <= 0) {
    throw new Error("maxBatchCharacters must be a positive number");
  }

  const batches: SourceItem[][] = [];
  let current: SourceItem[] = [];
  let currentSize = 0;

  for (const item of sourceItems) {
    const size = estimateSourceItemSize(item);

    if (current.length > 0 && currentSize + size > maxBatchCharacters) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }

    current.push(item);
    currentSize += size;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

function buildUnderstandingRequest(sourceItems: SourceItem[]): UnderstandingRequest {
  return {
    sourceItems: sourceItems.map((item) => ({
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

function createUnderstandingRuntime(
  config: ModelRuntimeConfig,
  env: ModelRuntimeEnv,
  request: UnderstandingRequest
): {
  model: Model<any>;
  getApiKey?: (provider: string) => string | Promise<string | undefined> | undefined;
  thinkingLevel: "off" | "low";
  unregister?: () => void;
} {
  if (config.provider === "faux") {
    const provider = registerFauxProvider({
      models: [{ id: config.model, name: config.model }]
    });
    provider.setResponses([fauxAssistantMessage(JSON.stringify(buildFauxUnderstandingOutput(request)))]);

    return {
      model: provider.getModel(config.model) ?? provider.getModel(),
      thinkingLevel: "off",
      unregister: provider.unregister
    };
  }

  registerBuiltInApiProviders();

  if (config.provider === "openai-codex") {
    return {
      model: getModel("openai-codex", config.model as never) as Model<any>,
      getApiKey: (provider) => (provider === "openai-codex" ? resolveModelApiKey(config, env) : undefined),
      thinkingLevel: "low"
    };
  }

  if (config.provider === "deepseek") {
    return {
      model: getModel("deepseek", config.model as never) as Model<any>,
      getApiKey: (provider) => (provider === "deepseek" ? resolveModelApiKey(config, env) : undefined),
      thinkingLevel: "off"
    };
  }

  return {
    model: getModel("openai", config.model as never) as Model<any>,
    getApiKey: (provider) => (provider === "openai" ? resolveModelApiKey(config, env) : undefined),
    thinkingLevel: "off"
  };
}

async function runUnderstandingAgent(
  request: UnderstandingRequest,
  runtime: {
    model: Model<any>;
    getApiKey?: (provider: string) => string | Promise<string | undefined> | undefined;
    thinkingLevel: "off" | "low";
  }
): Promise<{ text: string; events: string[] }> {
  const events: string[] = [];
  const agent = new Agent({
    initialState: {
      systemPrompt: [
        "你是 Daily Brief Agent 的 Source Item Understanding Stage。",
        "你只能基于输入 Source Items 生成结构化理解标注。",
        "不要联网，不要使用工具，不要补充未引用事实。输出必须是 JSON object。"
      ].join("\n"),
      model: runtime.model,
      thinkingLevel: runtime.thinkingLevel
    },
    sessionId: "daily-brief-understanding",
    ...(runtime.getApiKey ? { getApiKey: runtime.getApiKey } : {})
  });

  agent.subscribe((event) => {
    events.push(event.type);
  });

  await agent.prompt(
    [
      "请为每个 Source Item 生成一条 annotation。",
      "",
      "JSON schema:",
      "{",
      "  \"stage\": \"understanding\",",
      "  \"sourceItemAnnotations\": [",
      "    {",
      "      \"sourceItemId\": \"input id\",",
      "      \"claims\": [\"只基于 Source Item 的简短 claims\"],",
      "      \"summary\": \"一句简短中文理解\",",
      "      \"focusAreaRelevance\": \"strong|partial|weak|none\",",
      "      \"evidenceBoundary\": \"说明证据边界和不能推出什么\",",
      "      \"relevance\": \"relevant|not_relevant|uncertain\",",
      "      \"evidence\": [\"支撑判断的短证据片段\"],",
      "      \"weakItemHints\": [\"如果较弱，为什么弱；否则空数组\"]",
      "    }",
      "  ]",
      "}",
      "",
      "关注领域：Agent 架构、AI Coding。关注方向：先进工具、长程任务、持续学习、自我改进、人与 Agent 的边界。",
      "Input:",
      JSON.stringify(request, null, 2)
    ].join("\n")
  );

  const text = latestAssistantText(agent);

  if (!text) {
    throw new Error("Understanding Stage did not return text");
  }

  return { text, events };
}

function buildFauxUnderstandingOutput(request: UnderstandingRequest): UnderstandingStageOutput {
  return {
    stage: "understanding",
    sourceItemAnnotations: request.sourceItems.map((item) => {
      const relevance = classifyRelevance(item);
      const evidence = firstEvidence(item.analyzableText);

      return {
        sourceItemId: item.id,
        claims: [evidence],
        summary: `当前 Source Item 表明：${evidence}`,
        focusAreaRelevance: relevance === "relevant" ? "strong" : "none",
        evidenceBoundary: "仅能说明该 Source Item 自身提供的内容，不能外推项目成熟度或外部采用情况。",
        relevance,
        evidence: [evidence],
        weakItemHints: relevance === "relevant" ? [] : ["未明显命中 Agent 架构或 AI Coding 关注领域。"]
      };
    })
  };
}

function validateMergedAnnotations(
  sourceItems: SourceItem[],
  annotations: UnderstandingStageOutput["sourceItemAnnotations"]
): void {
  const expected = new Set(sourceItems.map((item) => item.id));
  const seen = new Set<string>();
  const issues: string[] = [];

  for (const annotation of annotations) {
    if (!expected.has(annotation.sourceItemId)) {
      issues.push(`sourceItemId references unknown id: ${annotation.sourceItemId}`);
    }

    if (seen.has(annotation.sourceItemId)) {
      issues.push(`duplicate annotation for sourceItemId: ${annotation.sourceItemId}`);
    }

    seen.add(annotation.sourceItemId);
  }

  for (const sourceItem of sourceItems) {
    if (!seen.has(sourceItem.id)) {
      issues.push(`missing annotation for sourceItemId: ${sourceItem.id}`);
    }
  }

  if (issues.length > 0) {
    throw new AgentStageValidationError("understanding", issues);
  }
}

function createInMemoryArtifact(modelRuntimeConfig: ModelRuntimeConfig): AgentRunArtifact {
  return {
    schemaVersion: 1,
    runId: "in-memory-understanding",
    date: new Date().toISOString().slice(0, 10),
    startedAt: new Date().toISOString(),
    model: {
      provider: modelRuntimeConfig.provider,
      model: modelRuntimeConfig.model,
      ...(modelRuntimeConfig.credentialRef ? { credentialRef: modelRuntimeConfig.credentialRef } : {})
    },
    inputRefs: {},
    stages: []
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

function estimateSourceItemSize(item: SourceItem): number {
  return item.id.length + item.title.length + item.url.length + item.analyzableText.length;
}

function classifyRelevance(item: Pick<SourceItem, "title" | "analyzableText">): UnderstandingStageOutput["sourceItemAnnotations"][number]["relevance"] {
  const text = `${item.title} ${item.analyzableText}`.toLowerCase();
  const terms = ["agent architecture", "agent runtime", "coding agent", "ai coding", "tool execution", "memory", "workflow"];
  return terms.some((term) => text.includes(term)) ? "relevant" : "not_relevant";
}

function firstEvidence(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized || "Source Item 没有可分析文本。";
}
