import {
  fixtureFetchAdapter,
  githubTrendingFetchAdapter,
  rssFetchAdapter,
  xFetchAdapter,
  type FetchAdapterRegistry
} from "../adapters/index.js";
import { loadSourceRegistry } from "../config/index.js";
import { appendSourceItems } from "../storage/index.js";

export type SourceCollectionStatus = "success" | "skipped" | "failed";

export interface SourceCollectionResult {
  sourceId: string;
  status: SourceCollectionStatus;
  itemCount: number;
  writtenCount: number;
  skippedDuplicateCount: number;
  reason?: string;
}

export interface CollectionRunResult {
  storePath: string;
  sources: SourceCollectionResult[];
}

export interface CollectSourcesOptions {
  date?: Date;
  dateKey?: string;
  fetchedAt?: Date;
  sourceRegistryPath?: string;
  sourceItemRoot?: string;
  adapters?: FetchAdapterRegistry;
}

export async function collectSources(options: CollectSourcesOptions = {}): Promise<CollectionRunResult> {
  const date = options.date ?? new Date();
  const fetchedAt = options.fetchedAt ?? new Date();
  const registry = await loadSourceRegistry(options.sourceRegistryPath);
  const adapters = options.adapters ?? defaultFetchAdapters();
  const results: SourceCollectionResult[] = [];
  let storePath = "";

  for (const source of registry.sources) {
    if (!source.enabled) {
      results.push({
        sourceId: source.id,
        status: "skipped",
        itemCount: 0,
        writtenCount: 0,
        skippedDuplicateCount: 0,
        reason: "Source disabled"
      });
      continue;
    }

    const adapter = adapters[source.adapter];

    if (!adapter) {
      results.push({
        sourceId: source.id,
        status: "failed",
        itemCount: 0,
        writtenCount: 0,
        skippedDuplicateCount: 0,
        reason: `Fetch Adapter not registered: ${source.adapter}`
      });
      continue;
    }

    try {
      const items = await adapter.fetch(source, { fetchedAt, collectionDate: date });
      const appendResult = await appendSourceItems(items, date, options.sourceItemRoot, options.dateKey);
      storePath = appendResult.path;
      results.push({
        sourceId: source.id,
        status: "success",
        itemCount: items.length,
        writtenCount: appendResult.written.length,
        skippedDuplicateCount: appendResult.skipped.length
      });
    } catch (error) {
      results.push({
        sourceId: source.id,
        status: "failed",
        itemCount: 0,
        writtenCount: 0,
        skippedDuplicateCount: 0,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { storePath, sources: results };
}

export function defaultFetchAdapters(): FetchAdapterRegistry {
  return {
    [fixtureFetchAdapter.name]: fixtureFetchAdapter,
    [githubTrendingFetchAdapter.name]: githubTrendingFetchAdapter,
    [rssFetchAdapter.name]: rssFetchAdapter,
    [xFetchAdapter.name]: xFetchAdapter
  };
}
