export type SourcePlatform = string;
export type FetchAdapterName = string;

export interface Source {
  id: string;
  platform: SourcePlatform;
  adapter: FetchAdapterName;
  target: string;
  enabled: boolean;
  notes: string;
}

export interface SourceRegistry {
  sources: Source[];
}

const SOURCE_KEYS = ["id", "platform", "adapter", "target", "enabled", "notes"] as const;
const REGISTRY_KEYS = ["sources"] as const;

type SourceKey = (typeof SOURCE_KEYS)[number];

export class SourceRegistryValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid Source Registry:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "SourceRegistryValidationError";
    this.issues = issues;
  }
}

export function parseSourceRegistry(value: unknown): SourceRegistry {
  const issues: string[] = [];

  if (!isRecord(value)) {
    throw new SourceRegistryValidationError(["registry must be a mapping with a sources list"]);
  }

  collectUnknownKeys("registry", value, REGISTRY_KEYS, issues);

  if (!Array.isArray(value.sources)) {
    throw new SourceRegistryValidationError([...issues, "sources must be a list"]);
  }

  const sourceIds = new Set<string>();
  const sources = value.sources.flatMap((entry, index) => {
    const prefix = `sources[${index}]`;
    const parsed = parseSource(entry, prefix, issues);

    if (!parsed) {
      return [];
    }

    if (sourceIds.has(parsed.id)) {
      issues.push(`${prefix}.id duplicates another Source id: ${parsed.id}`);
    }

    sourceIds.add(parsed.id);
    return [parsed];
  });

  if (issues.length > 0) {
    throw new SourceRegistryValidationError(issues);
  }

  return { sources };
}

function parseSource(value: unknown, prefix: string, issues: string[]): Source | undefined {
  if (!isRecord(value)) {
    issues.push(`${prefix} must be a mapping`);
    return undefined;
  }

  collectUnknownKeys(prefix, value, SOURCE_KEYS, issues);

  const id = readRequiredString(value, "id", prefix, issues);
  const platform = readRequiredString(value, "platform", prefix, issues);
  const adapter = readRequiredString(value, "adapter", prefix, issues);
  const target = readRequiredString(value, "target", prefix, issues);
  const enabled = readRequiredBoolean(value, "enabled", prefix, issues);
  const notes = readRequiredString(value, "notes", prefix, issues);

  if (!id || !platform || !adapter || !target || enabled === undefined || !notes) {
    return undefined;
  }

  return {
    id,
    platform,
    adapter,
    target,
    enabled,
    notes
  };
}

function readRequiredString(
  source: Record<string, unknown>,
  key: SourceKey,
  prefix: string,
  issues: string[]
): string | undefined {
  const value = source[key];

  if (typeof value !== "string") {
    issues.push(`${prefix}.${key} must be a string`);
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    issues.push(`${prefix}.${key} must not be empty`);
    return undefined;
  }

  return trimmed;
}

function readRequiredBoolean(
  source: Record<string, unknown>,
  key: SourceKey,
  prefix: string,
  issues: string[]
): boolean | undefined {
  const value = source[key];

  if (typeof value !== "boolean") {
    issues.push(`${prefix}.${key} must be a boolean`);
    return undefined;
  }

  return value;
}

function collectUnknownKeys(
  prefix: string,
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  issues: string[]
): void {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push(`${prefix}.${key} is not allowed in the Source Registry`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
