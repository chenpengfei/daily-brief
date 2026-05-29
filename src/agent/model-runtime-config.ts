export type ModelProvider = "faux" | "openai";

export interface ModelRuntimeConfig {
  provider: ModelProvider;
  model: string;
  secretEnvName?: string;
  ready: boolean;
  issues: string[];
}

export type ModelRuntimeEnv = Partial<Record<string, string | undefined>>;

export function readModelRuntimeConfig(env: ModelRuntimeEnv = process.env): ModelRuntimeConfig {
  const provider = readProvider(env.DAILY_BRIEF_MODEL_PROVIDER);

  if (provider === "openai") {
    const secretEnvName = "OPENAI_API_KEY";
    const issues = env[secretEnvName]
      ? []
      : [`${secretEnvName} is required when DAILY_BRIEF_MODEL_PROVIDER=openai`];

    return {
      provider,
      model: readModel(env.DAILY_BRIEF_MODEL, "gpt-4.1-mini"),
      secretEnvName,
      ready: issues.length === 0,
      issues
    };
  }

  return {
    provider,
    model: readModel(env.DAILY_BRIEF_MODEL, "faux-daily-brief-renderer"),
    ready: true,
    issues: []
  };
}

function readProvider(value: string | undefined): ModelProvider {
  if (!value) {
    return "faux";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "faux" || normalized === "openai") {
    return normalized;
  }

  throw new Error(`Unsupported DAILY_BRIEF_MODEL_PROVIDER: ${value}`);
}

function readModel(value: string | undefined, fallback: string): string {
  const model = value?.trim();
  return model && model.length > 0 ? model : fallback;
}
