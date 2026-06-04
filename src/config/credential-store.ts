import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { OAuthCredentials } from "@earendil-works/pi-ai/oauth";
import type { ConfiguredModelProvider } from "./model-config.js";
import { resolveDailyBriefPaths } from "./paths.js";

export type CredentialRecord = ApiKeyCredentialRecord | OAuthCredentialRecord | WebhookCredentialRecord;

export interface ApiKeyCredentialRecord {
  type: "api-key";
  provider: ConfiguredModelProvider;
  apiKey: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OAuthCredentialRecord {
  type: "oauth";
  provider: "openai-codex";
  credentials: OAuthCredentials;
  createdAt?: string;
  updatedAt?: string;
}

export interface WebhookCredentialRecord {
  type: "webhook";
  provider: "discord";
  webhookUrl: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CredentialStore {
  credentials: Record<string, CredentialRecord>;
}

export interface RedactedCredentialRecord {
  type: CredentialRecord["type"];
  provider: CredentialRecord["provider"];
  secret: "<redacted>";
}

export function readCredentialStore(path = resolveDailyBriefPaths().authPath): CredentialStore {
  if (!existsSync(path)) {
    return { credentials: {} };
  }

  const payload = JSON.parse(readFileSync(path, "utf8")) as unknown;

  if (!isRecord(payload)) {
    throw new Error("auth.json must be a JSON object");
  }

  return parseCredentialStore(payload);
}

export function writeCredentialStore(store: CredentialStore, path = resolveDailyBriefPaths().authPath): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(parseCredentialStore(store as unknown as Record<string, unknown>), null, 2)}\n`, {
    mode: 0o600
  });
}

export function putCredential(ref: string, credential: CredentialRecord, path = resolveDailyBriefPaths().authPath): CredentialStore {
  assertStoredCredentialRef(ref);
  const now = new Date().toISOString();
  const store = readCredentialStore(path);
  const previous = store.credentials[ref];

  store.credentials[ref] = {
    ...credential,
    createdAt: previous?.createdAt ?? credential.createdAt ?? now,
    updatedAt: now
  } as CredentialRecord;

  writeCredentialStore(store, path);
  return store;
}

export function removeCredential(ref: string, path = resolveDailyBriefPaths().authPath): CredentialStore {
  assertStoredCredentialRef(ref);
  const store = readCredentialStore(path);
  delete store.credentials[ref];
  writeCredentialStore(store, path);
  return store;
}

export function getCredential(ref: string, path = resolveDailyBriefPaths().authPath): CredentialRecord | undefined {
  assertStoredCredentialRef(ref);
  return readCredentialStore(path).credentials[ref];
}

export function redactCredentialStore(store: CredentialStore): Record<string, RedactedCredentialRecord> {
  return Object.fromEntries(
    Object.entries(store.credentials).map(([ref, credential]) => [
      ref,
      {
        type: credential.type,
        provider: credential.provider,
        secret: "<redacted>"
      }
    ])
  );
}

export function assertStoredCredentialRef(ref: string): void {
  if (ref.startsWith("env:")) {
    throw new Error(`Credential reference ${ref} is not supported; use a stored credential name in auth.json`);
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(ref)) {
    throw new Error(`Invalid credentialRef: ${ref}`);
  }
}

function parseCredentialStore(value: Record<string, unknown>): CredentialStore {
  const credentials = value.credentials;

  if (credentials === undefined) {
    return { credentials: {} };
  }

  if (!isRecord(credentials)) {
    throw new Error("auth.json credentials must be a mapping");
  }

  return {
    credentials: Object.fromEntries(
      Object.entries(credentials).map(([ref, credential]) => {
        assertStoredCredentialRef(ref);

        if (!isRecord(credential)) {
          throw new Error(`Credential ${ref} must be a mapping`);
        }

        return [ref, parseCredentialRecord(ref, credential)];
      })
    )
  };
}

function parseCredentialRecord(ref: string, value: Record<string, unknown>): CredentialRecord {
  if (value.type === "api-key") {
    const provider = readProvider(value.provider, ref);
    const apiKey = readString(value.apiKey, `Credential ${ref} apiKey`);

    return {
      type: "api-key",
      provider,
      apiKey,
      ...readTimestamps(value)
    };
  }

  if (value.type === "oauth") {
    const provider = readProvider(value.provider, ref);

    if (provider !== "openai-codex") {
      throw new Error(`Credential ${ref} OAuth provider must be openai-codex`);
    }

    if (!isRecord(value.credentials)) {
      throw new Error(`Credential ${ref} credentials must be a mapping`);
    }

    const credentials = value.credentials;
    const refresh = readString(credentials.refresh, `Credential ${ref} refresh`);
    const access = readString(credentials.access, `Credential ${ref} access`);
    const expires = typeof credentials.expires === "number" ? credentials.expires : undefined;

    if (!expires) {
      throw new Error(`Credential ${ref} expires must be a number`);
    }

    return {
      type: "oauth",
      provider,
      credentials: {
        ...credentials,
        refresh,
        access,
        expires
      },
      ...readTimestamps(value)
    };
  }

  if (value.type === "webhook") {
    const provider = readString(value.provider, `Credential ${ref} provider`);

    if (provider !== "discord") {
      throw new Error(`Credential ${ref} webhook provider must be discord`);
    }

    return {
      type: "webhook",
      provider,
      webhookUrl: readString(value.webhookUrl, `Credential ${ref} webhookUrl`),
      ...readTimestamps(value)
    };
  }

  throw new Error(`Credential ${ref} type must be api-key, oauth, or webhook`);
}

function readProvider(value: unknown, ref: string): ConfiguredModelProvider {
  const provider = readString(value, `Credential ${ref} provider`).toLowerCase();

  if (
    provider === "faux" ||
    provider === "openai" ||
    provider === "openai-codex" ||
    provider === "deepseek" ||
    provider === "openai-compatible"
  ) {
    return provider;
  }

  throw new Error(`Credential ${ref} has unsupported provider: ${provider}`);
}

function readTimestamps(value: Record<string, unknown>): Pick<CredentialRecord, "createdAt" | "updatedAt"> {
  return {
    ...(typeof value.createdAt === "string" ? { createdAt: value.createdAt } : {}),
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {})
  };
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
