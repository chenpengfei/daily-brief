import type { FetchAdapterRegistry } from "../adapters/index.js";
import type { Source, SourceItem } from "../domain/index.js";
import { loadSourceRegistry } from "../config/index.js";
import { defaultFetchAdapters } from "./collect.js";

export type AdapterProbeEvidence = "local" | "live";
export type AdapterProbeSourceStatus = "success" | "failed";
export type AdapterProbeAdapterStatus = "ready" | "blocked" | "local-only" | "unknown";

export interface AdapterProbeSample {
  title: string;
  url: string;
}

export interface AdapterProbeSourceResult {
  sourceId: string;
  adapter: string;
  enabled: boolean;
  evidence: AdapterProbeEvidence;
  status: AdapterProbeSourceStatus;
  itemCount: number;
  samples: AdapterProbeSample[];
  reason?: string;
}

export interface AdapterProbeAdapterResult {
  adapter: string;
  readiness: "local-only" | "live-capable" | "unknown";
  status: AdapterProbeAdapterStatus;
  sourceCount: number;
  successCount: number;
  failureCount: number;
  liveSourceCount: number;
  liveSuccessCount: number;
  liveItemCount: number;
  blocker?: string;
}

export interface AdapterProbeRunResult {
  sources: AdapterProbeSourceResult[];
  adapters: AdapterProbeAdapterResult[];
  releaseReady: boolean;
  blockers: string[];
}

export interface ProbeAdaptersOptions {
  sourceRegistryPath?: string;
  adapters?: FetchAdapterRegistry;
  includeDisabled?: boolean;
  fetchedAt?: Date;
  collectionDate?: Date;
  timeoutMs?: number;
  onProgress?: (line: string) => void;
}

const DEFAULT_PROBE_TIMEOUT_MS = 30_000;
const SAMPLE_LIMIT = 3;

export async function probeAdapters(options: ProbeAdaptersOptions = {}): Promise<AdapterProbeRunResult> {
  const registry = await loadSourceRegistry(options.sourceRegistryPath);
  const adapters = options.adapters ?? defaultFetchAdapters();
  const fetchedAt = options.fetchedAt ?? new Date();
  const collectionDate = options.collectionDate ?? fetchedAt;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const sources = registry.sources.filter((source) => options.includeDisabled || source.enabled);
  const results: AdapterProbeSourceResult[] = [];

  for (const source of sources) {
    const adapter = adapters[source.adapter];
    const evidence = classifyProbeEvidence(source, adapter?.name);
    options.onProgress?.(
      `Probing Source ${source.id} (${source.adapter}, ${source.enabled ? "enabled" : "disabled"}, ${evidence})`
    );

    if (!adapter) {
      const result = failedProbe(source, evidence, `Fetch Adapter not registered: ${source.adapter}`);
      results.push(result);
      options.onProgress?.(`Source ${source.id} failed: ${result.reason}`);
      continue;
    }

    const abortController = new AbortController();

    try {
      const items = await withProbeTimeout(
        adapter.fetch(source, { fetchedAt, collectionDate, signal: abortController.signal }),
        timeoutMs,
        abortController
      );
      validateSourceItems(items, source);
      const result: AdapterProbeSourceResult = {
        sourceId: source.id,
        adapter: source.adapter,
        enabled: source.enabled,
        evidence,
        status: "success",
        itemCount: items.length,
        samples: items.slice(0, SAMPLE_LIMIT).map((item) => ({ title: item.title, url: item.url }))
      };
      results.push(result);
      options.onProgress?.(`Source ${source.id} succeeded: ${items.length} item(s)`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const result = failedProbe(source, evidence, reason);
      results.push(result);
      options.onProgress?.(`Source ${source.id} failed: ${reason}`);
    }
  }

  return summarizeProbeResults(results, adapters);
}

export function formatAdapterProbeReport(result: AdapterProbeRunResult): string[] {
  const lines = ["Fetch Adapter Probe", "", "Sources"];

  if (result.sources.length === 0) {
    lines.push("  No Sources selected.");
  }

  for (const source of result.sources) {
    lines.push(
      `  - ${source.sourceId}: ${source.status} (${source.adapter}, ${source.enabled ? "enabled" : "disabled"}, ${source.evidence}) - ${source.itemCount} item(s)`
    );
    if (source.reason) {
      lines.push(`    Reason: ${source.reason}`);
    }
    for (const sample of source.samples) {
      lines.push(`    Sample: ${sample.title} - ${sample.url}`);
    }
  }

  lines.push("", "Adapters");
  if (result.adapters.length === 0) {
    lines.push("  No adapters probed.");
  }

  for (const adapter of result.adapters) {
    lines.push(
      `  - ${adapter.adapter}: ${adapter.status} (${adapter.readiness}) - sources ${adapter.successCount}/${adapter.sourceCount}, live ${adapter.liveSuccessCount}/${adapter.liveSourceCount}, live items ${adapter.liveItemCount}`
    );
    if (adapter.blocker) {
      lines.push(`    Blocker: ${adapter.blocker}`);
    }
  }

  lines.push("", `Release readiness: ${result.releaseReady ? "ready" : "blocked"}`);
  for (const blocker of result.blockers) {
    lines.push(`  - ${blocker}`);
  }

  return lines;
}

function summarizeProbeResults(
  sources: AdapterProbeSourceResult[],
  adapters: FetchAdapterRegistry
): AdapterProbeRunResult {
  const adapterNames = [...new Set(sources.map((source) => source.adapter))].sort();
  const adapterResults = adapterNames.map((adapterName) => summarizeAdapter(adapterName, sources, adapters));
  const blockers = [
    ...sources
      .filter((source) => source.status === "failed")
      .map((source) => `Source ${source.sourceId} failed: ${source.reason ?? "unknown error"}`),
    ...(sources.some((source) => source.evidence === "live")
      ? []
      : ["No live Source probes selected; local or fixture evidence cannot satisfy live readiness"]),
    ...adapterResults.flatMap((adapter) => (adapter.blocker ? [`Adapter ${adapter.adapter}: ${adapter.blocker}`] : []))
  ];

  return {
    sources,
    adapters: adapterResults,
    releaseReady: blockers.length === 0,
    blockers
  };
}

function summarizeAdapter(
  adapterName: string,
  sources: AdapterProbeSourceResult[],
  adapters: FetchAdapterRegistry
): AdapterProbeAdapterResult {
  const adapterSources = sources.filter((source) => source.adapter === adapterName);
  const adapter = adapters[adapterName];
  const readiness = adapter?.readiness ?? "unknown";
  const successCount = adapterSources.filter((source) => source.status === "success").length;
  const failureCount = adapterSources.filter((source) => source.status === "failed").length;
  const liveSources = adapterSources.filter((source) => source.evidence === "live");
  const liveSuccesses = liveSources.filter((source) => source.status === "success" && source.itemCount > 0);
  const liveItemCount = liveSuccesses.reduce((total, source) => total + source.itemCount, 0);
  const blocker =
    readiness === "unknown"
      ? "Fetch Adapter is not registered"
      : readiness === "live-capable" && adapterSources.length > 0 && liveSuccesses.length === 0
        ? "live-capable adapter has no successful non-empty live Source probe"
        : undefined;
  const status: AdapterProbeAdapterStatus = blocker
    ? "blocked"
    : readiness === "local-only"
      ? "local-only"
      : readiness === "unknown"
        ? "unknown"
        : "ready";

  return {
    adapter: adapterName,
    readiness,
    status,
    sourceCount: adapterSources.length,
    successCount,
    failureCount,
    liveSourceCount: liveSources.length,
    liveSuccessCount: liveSuccesses.length,
    liveItemCount,
    ...(blocker ? { blocker } : {})
  };
}

function failedProbe(source: Source, evidence: AdapterProbeEvidence, reason: string): AdapterProbeSourceResult {
  return {
    sourceId: source.id,
    adapter: source.adapter,
    enabled: source.enabled,
    evidence,
    status: "failed",
    itemCount: 0,
    samples: [],
    reason
  };
}

function classifyProbeEvidence(source: Source, adapterName: string | undefined): AdapterProbeEvidence {
  if (adapterName === "fixture") {
    return "local";
  }

  return source.target.startsWith("http://") || source.target.startsWith("https://") ? "live" : "local";
}

async function withProbeTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  abortController: AbortController
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Probe timed out after ${timeoutMs}ms`));
      abortController.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function validateSourceItems(items: SourceItem[], source: Source): void {
  if (!Array.isArray(items)) {
    throw new Error("Fetch Adapter returned a non-list Source Item result");
  }

  items.forEach((item, index) => validateSourceItem(item, source, index));
}

function validateSourceItem(item: SourceItem, source: Source, index: number): void {
  if (!isRecord(item)) {
    throw new Error(`Source Item ${index} must be an object`);
  }

  for (const key of ["id", "sourceId", "platform", "url", "title", "fetchedAt", "analyzableText", "contentHash"]) {
    if (typeof item[key] !== "string" || item[key].trim().length === 0) {
      throw new Error(`Source Item ${index}.${key} must be a non-empty string`);
    }
  }

  if (item.sourceId !== source.id) {
    throw new Error(`Source Item ${index}.sourceId must match Source ${source.id}`);
  }

  if (item.metadata !== undefined && !isRecord(item.metadata)) {
    throw new Error(`Source Item ${index}.metadata must be an object when present`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
