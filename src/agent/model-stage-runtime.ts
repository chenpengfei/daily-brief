import {
  fauxAssistantMessage,
  getModel,
  registerBuiltInApiProviders,
  registerFauxProvider,
  type Model
} from "@earendil-works/pi-ai";
import { resolveModelApiKey, type ModelRuntimeConfig, type ModelRuntimeEnv } from "./model-runtime-config.js";

export interface StageModelRuntime {
  model: Model<any>;
  getApiKey?: (provider: string) => string | Promise<string | undefined> | undefined;
  thinkingLevel: "off" | "low";
  unregister?: () => void;
}

export function createStageModelRuntime(input: {
  config: ModelRuntimeConfig;
  env: ModelRuntimeEnv;
  fauxResponse?: string;
  openAICodexThinkingLevel?: "off" | "low";
}): StageModelRuntime {
  const { config, env } = input;

  if (config.provider === "faux") {
    if (!input.fauxResponse) {
      throw new Error("fauxResponse is required for faux model runtime");
    }

    const provider = registerFauxProvider({
      models: [{ id: config.model, name: config.model }]
    });
    provider.setResponses([fauxAssistantMessage(input.fauxResponse)]);

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
      thinkingLevel: input.openAICodexThinkingLevel ?? "low"
    };
  }

  if (config.provider === "deepseek") {
    return {
      model: getModel("deepseek", config.model as never) as Model<any>,
      getApiKey: (provider) => (provider === "deepseek" ? resolveModelApiKey(config, env) : undefined),
      thinkingLevel: "off"
    };
  }

  if (config.provider === "openai-compatible") {
    return {
      model: buildOpenAICompatibleModel(config),
      getApiKey: (provider) => (provider === "openai-compatible" ? resolveModelApiKey(config, env) : undefined),
      thinkingLevel: "off"
    };
  }

  return {
    model: getModel("openai", config.model as never) as Model<any>,
    getApiKey: (provider) => (provider === "openai" ? resolveModelApiKey(config, env) : undefined),
    thinkingLevel: "off"
  };
}

export function buildOpenAICompatibleModel(config: Pick<ModelRuntimeConfig, "model" | "baseUrl">): Model<any> {
  if (!config.baseUrl) {
    throw new Error("baseUrl is required for openai-compatible model runtime");
  }

  return {
    id: config.model,
    name: config.model,
    api: "openai-completions",
    provider: "openai-compatible",
    baseUrl: config.baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 4096
  };
}
