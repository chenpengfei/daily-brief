import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";
import { resolveDailyBriefPaths } from "./paths.js";

export type ConfiguredModelProvider = "faux" | "openai-codex" | "openai" | "deepseek" | "openai-compatible";

export interface DailyBriefModelConfig {
  provider: ConfiguredModelProvider;
  model: string;
  credentialRef?: string;
  baseUrl?: string;
}

export interface DailyBriefConfig {
  model?: DailyBriefModelConfig;
  delivery?: DailyBriefDeliveryConfig;
  [key: string]: unknown;
}

export interface DailyBriefDeliveryConfig {
  enabled: boolean;
  webhookRef?: string;
}

export function readDailyBriefConfig(path = resolveDailyBriefPaths().configPath): DailyBriefConfig {
  if (!existsSync(path)) {
    return {};
  }

  const contents = readFileSync(path, "utf8");
  const parsed = parse(contents) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("Daily Brief config must be a mapping");
  }

  return parseDailyBriefConfig(parsed);
}

export function readModelConfig(path = resolveDailyBriefPaths().configPath): DailyBriefModelConfig | undefined {
  return readDailyBriefConfig(path).model;
}

export function writeModelConfig(config: DailyBriefModelConfig, path = resolveDailyBriefPaths().configPath): void {
  const current = readDailyBriefConfig(path);
  const next = {
    ...current,
    model: parseModelConfig(config as unknown as Record<string, unknown>)
  };

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringify(next), "utf8");
}

export function parseDailyBriefConfig(value: Record<string, unknown>): DailyBriefConfig {
  const config: DailyBriefConfig = { ...value };

  if (value.model !== undefined) {
    if (!isRecord(value.model)) {
      throw new Error("config.model must be a mapping");
    }

    config.model = parseModelConfig(value.model);
  }

  if (value.delivery !== undefined) {
    if (!isRecord(value.delivery)) {
      throw new Error("config.delivery must be a mapping");
    }

    config.delivery = parseDeliveryConfig(value.delivery);
  }

  return config;
}

export function readDeliveryConfig(path = resolveDailyBriefPaths().configPath): DailyBriefDeliveryConfig | undefined {
  return readDailyBriefConfig(path).delivery;
}

export function writeDeliveryConfig(config: DailyBriefDeliveryConfig, path = resolveDailyBriefPaths().configPath): void {
  const current = readDailyBriefConfig(path);
  const next = { ...current, delivery: parseDeliveryConfig(config as unknown as Record<string, unknown>) };

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringify(next), "utf8");
}

function parseDeliveryConfig(value: Record<string, unknown>): DailyBriefDeliveryConfig {
  if (typeof value.enabled !== "boolean") {
    throw new Error("config.delivery.enabled must be a boolean");
  }

  const webhookRef = readOptionalString(value.webhookRef, "config.delivery.webhookRef");

  return {
    enabled: value.enabled,
    ...(webhookRef ? { webhookRef } : {})
  };
}

export function parseModelConfig(value: Record<string, unknown>): DailyBriefModelConfig {
  const provider = readProvider(value.provider);
  const model = readRequiredString(value.model, "config.model.model");
  const credentialRef = readOptionalString(value.credentialRef, "config.model.credentialRef");
  const baseUrl = readOptionalString(value.baseUrl, "config.model.baseUrl");

  if ("apiKey" in value || "secret" in value || "accessToken" in value || "refreshToken" in value) {
    throw new Error("config.model must not contain secrets; use auth.json via credentialRef");
  }

  if (provider === "openai-compatible" && !baseUrl) {
    throw new Error("config.model.baseUrl is required when provider is openai-compatible");
  }

  return {
    provider,
    model,
    ...(credentialRef ? { credentialRef } : {}),
    ...(baseUrl ? { baseUrl } : {})
  };
}

export function defaultModelConfig(): DailyBriefModelConfig {
  return {
    provider: "openai-codex",
    model: "gpt-5.5",
    credentialRef: "openai-codex.default"
  };
}

function readProvider(value: unknown): ConfiguredModelProvider {
  const provider = readRequiredString(value, "config.model.provider").toLowerCase();

  if (provider === "codex" || provider === "hermes") {
    return "openai-codex";
  }

  if (
    provider === "faux" ||
    provider === "openai-codex" ||
    provider === "openai" ||
    provider === "deepseek" ||
    provider === "openai-compatible"
  ) {
    return provider;
  }

  throw new Error(`Unsupported model provider: ${provider}`);
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function readOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
