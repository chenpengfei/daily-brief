import { existsSync } from "node:fs";
import {
  getOAuthApiKey,
  loginOpenAICodex,
  type OAuthCredentials,
  type OAuthLoginCallbacks
} from "@earendil-works/pi-ai/oauth";
import {
  envNameFromCredentialRef,
  getCredential,
  isEnvCredentialRef,
  putCredential,
  readCredentialStore,
  readModelConfig,
  removeCredential,
  writeCredentialStore,
  type ApiKeyCredentialRecord,
  type ConfiguredModelProvider,
  type CredentialRecord,
  type OAuthCredentialRecord
} from "../config/index.js";
import { resolveDailyBriefPaths } from "../config/paths.js";

export type ModelProvider = ConfiguredModelProvider;

export interface ModelRuntimeConfig {
  provider: ModelProvider;
  model: string;
  credentialRef?: string;
  baseUrl?: string;
  ready: boolean;
  issues: string[];
}

export type ModelRuntimeEnv = Partial<Record<string, string | undefined>>;

export interface ModelRuntimeConfigOptions {
  configPath?: string;
  authPath?: string;
}

export interface OAuthHelpers {
  getOAuthApiKey(providerId: string, credentials: Record<string, OAuthCredentials>): Promise<{
    newCredentials: OAuthCredentials;
    apiKey: string;
  } | null>;
  loginOpenAICodex(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>;
}

export const defaultOAuthHelpers: OAuthHelpers = {
  getOAuthApiKey,
  loginOpenAICodex
};

export function readModelRuntimeConfig(
  env: ModelRuntimeEnv = process.env,
  options: ModelRuntimeConfigOptions = {}
): ModelRuntimeConfig {
  const paths = resolveDailyBriefPaths(env);
  const configPath = options.configPath ?? paths.configPath;
  const authPath = options.authPath ?? paths.authPath;
  const config = readEnvModelConfig(env) ?? (existsSync(configPath) ? readModelConfig(configPath) : undefined);

  if (!config) {
    return {
      provider: "faux",
      model: "faux-daily-brief-renderer",
      ready: true,
      issues: []
    };
  }

  const issues = credentialIssues(config.provider, config.credentialRef, env, authPath);

  return {
    provider: config.provider,
    model: config.model,
    ...(config.credentialRef ? { credentialRef: config.credentialRef } : {}),
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    ready: issues.length === 0,
    issues
  };
}

export async function resolveModelApiKey(
  config: Pick<ModelRuntimeConfig, "provider" | "credentialRef">,
  env: ModelRuntimeEnv = process.env,
  options: ModelRuntimeConfigOptions & { oauthHelpers?: OAuthHelpers } = {}
): Promise<string | undefined> {
  if (config.provider === "faux") {
    return undefined;
  }

  const credentialRef = config.credentialRef;

  if (!credentialRef) {
    throw new Error(`credentialRef is required for ${config.provider}`);
  }

  if (isEnvCredentialRef(credentialRef)) {
    const envName = envNameFromCredentialRef(credentialRef);
    return env[envName]?.trim();
  }

  const authPath = options.authPath ?? resolveDailyBriefPaths(env).authPath;
  const credential = getCredential(credentialRef, authPath);

  if (!credential) {
    throw new Error(`Credential not found: ${credentialRef}`);
  }

  if (credential.provider !== config.provider) {
    throw new Error(`Credential ${credentialRef} is for ${credential.provider}, not ${config.provider}`);
  }

  if (credential.type === "api-key") {
    return credential.apiKey;
  }

  const helpers = options.oauthHelpers ?? defaultOAuthHelpers;
  const result = await helpers.getOAuthApiKey(credential.provider, {
    [credential.provider]: credential.credentials
  });

  if (!result) {
    throw new Error(`OAuth credential ${credentialRef} is not logged in`);
  }

  persistRefreshedOAuthCredential(credentialRef, credential, result.newCredentials, authPath);
  return result.apiKey;
}

export interface ModelLoginIo {
  stdout(line: string): void;
  prompt?(message: string): Promise<string>;
}

export async function loginModelCredential(input: {
  provider: ModelProvider;
  credentialRef: string;
  io: ModelLoginIo;
  env?: ModelRuntimeEnv;
  authPath?: string;
  oauthHelpers?: OAuthHelpers;
}): Promise<void> {
  if (input.provider !== "openai-codex") {
    throw new Error(`model login currently supports OAuth provider openai-codex, received ${input.provider}`);
  }

  const helpers = input.oauthHelpers ?? defaultOAuthHelpers;
  const credentials = await helpers.loginOpenAICodex({
    onAuth: (info) => {
      input.io.stdout(`Open authorization URL: ${info.url}`);

      if (info.instructions) {
        input.io.stdout(info.instructions);
      }
    },
    onDeviceCode: (info) => {
      input.io.stdout(`Open verification URL: ${info.verificationUri}`);
      input.io.stdout(`Device code: ${info.userCode}`);
    },
    onPrompt: (prompt) => promptForOAuth(input.io, prompt.message),
    onManualCodeInput: () => promptForOAuth(input.io, "Authorization code:"),
    onProgress: (message) => input.io.stdout(message),
    onSelect: async (prompt) => {
      for (const option of prompt.options) {
        input.io.stdout(`${option.id}: ${option.label}`);
      }

      const selected = await promptForOAuth(input.io, prompt.message);
      return selected || undefined;
    }
  });

  putCredential(
    input.credentialRef,
    {
      type: "oauth",
      provider: "openai-codex",
      credentials
    },
    input.authPath ?? resolveDailyBriefPaths(input.env ?? process.env).authPath
  );
}

export function logoutModelCredential(ref: string, env: ModelRuntimeEnv = process.env, authPath?: string): void {
  removeCredential(ref, authPath ?? resolveDailyBriefPaths(env).authPath);
}

export function statusModelCredentials(
  env: ModelRuntimeEnv = process.env,
  options: ModelRuntimeConfigOptions = {}
): Array<{ ref: string; type: CredentialRecord["type"]; provider: CredentialRecord["provider"]; secret: "<redacted>" }> {
  const authPath = options.authPath ?? resolveDailyBriefPaths(env).authPath;
  return Object.entries(readCredentialStore(authPath).credentials).map(([ref, credential]) => ({
    ref,
    type: credential.type,
    provider: credential.provider,
    secret: "<redacted>"
  }));
}

function credentialIssues(
  provider: ModelProvider,
  credentialRef: string | undefined,
  env: ModelRuntimeEnv,
  authPath: string
): string[] {
  if (provider === "faux") {
    return [];
  }

  if (!credentialRef) {
    return [`credentialRef is required for ${provider}`];
  }

  if (isEnvCredentialRef(credentialRef)) {
    const envName = envNameFromCredentialRef(credentialRef);
    return env[envName]?.trim() ? [] : [`${envName} is required for credentialRef ${credentialRef}`];
  }

  const credential = getCredential(credentialRef, authPath);

  if (!credential) {
    return [`Credential not found: ${credentialRef}`];
  }

  if (credential.provider !== provider) {
    return [`Credential ${credentialRef} is for ${credential.provider}, not ${provider}`];
  }

  return [];
}

function readEnvModelConfig(env: ModelRuntimeEnv):
  | {
      provider: ModelProvider;
      model: string;
      credentialRef?: string;
      baseUrl?: string;
    }
  | undefined {
  const provider = env.DAILY_BRIEF_MODEL_PROVIDER?.trim();

  if (!provider) {
    return undefined;
  }

  const normalizedProvider = normalizeProvider(provider);

  return {
    provider: normalizedProvider,
    model: env.DAILY_BRIEF_MODEL?.trim() || defaultModelForProvider(normalizedProvider),
    ...(env.DAILY_BRIEF_MODEL_BASE_URL?.trim() ? { baseUrl: env.DAILY_BRIEF_MODEL_BASE_URL.trim() } : {}),
    ...readEnvCredentialRef(env, normalizedProvider)
  };
}

function normalizeProvider(value: string): ModelProvider {
  const provider = value.trim().toLowerCase();

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

  throw new Error(`Unsupported DAILY_BRIEF_MODEL_PROVIDER: ${value}`);
}

function defaultModelForProvider(provider: ModelProvider): string {
  if (provider === "openai-codex") {
    return "gpt-5.5";
  }

  if (provider === "openai") {
    return "gpt-4.1-mini";
  }

  if (provider === "deepseek") {
    return "deepseek-chat";
  }

  if (provider === "openai-compatible") {
    return "openai-compatible-model";
  }

  return "faux-daily-brief-renderer";
}

function defaultCredentialRefForProvider(provider: ModelProvider): string | undefined {
  if (provider === "faux") {
    return undefined;
  }

  if (provider === "openai") {
    return "env:OPENAI_API_KEY";
  }

  if (provider === "deepseek") {
    return "env:DEEPSEEK_API_KEY";
  }

  if (provider === "openai-compatible") {
    return "env:OPENAI_API_KEY";
  }

  return "openai-codex.default";
}

function persistRefreshedOAuthCredential(
  ref: string,
  credential: OAuthCredentialRecord,
  credentials: OAuthCredentials,
  authPath: string
): void {
  const store = readCredentialStore(authPath);
  const previous = store.credentials[ref] as OAuthCredentialRecord | undefined;
  store.credentials[ref] = {
    ...credential,
    ...((previous?.createdAt ?? credential.createdAt) ? { createdAt: previous?.createdAt ?? credential.createdAt } : {}),
    updatedAt: new Date().toISOString(),
    credentials
  };
  writeCredentialStore(store, authPath);
}

function readEnvCredentialRef(
  env: ModelRuntimeEnv,
  provider: ModelProvider
): { credentialRef?: string } {
  const credentialRef =
    env.DAILY_BRIEF_MODEL_CREDENTIAL_REF?.trim() ||
    defaultCredentialRefForProvider(provider);

  return credentialRef ? { credentialRef } : {};
}

function promptForOAuth(io: ModelLoginIo, message: string): Promise<string> {
  if (!io.prompt) {
    throw new Error(`OAuth login requires interactive input: ${message}`);
  }

  return io.prompt(message);
}

export function toApiKeyCredential(provider: ModelProvider, apiKey: string): ApiKeyCredentialRecord {
  if (provider === "faux" || provider === "openai-codex") {
    throw new Error(`${provider} does not accept API key credentials in auth.json`);
  }

  return {
    type: "api-key",
    provider,
    apiKey
  };
}
