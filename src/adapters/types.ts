import type { Source, SourceItem } from "../domain/index.js";

export interface FetchContext {
  fetchedAt: Date;
  collectionDate?: Date;
  signal?: AbortSignal;
  authPath?: string;
}

export type FetchAdapterReadiness = "local-only" | "live-capable";

export interface FetchAdapter {
  name: string;
  readiness: FetchAdapterReadiness;
  fetch(source: Source, context: FetchContext): Promise<SourceItem[]>;
}

export type FetchAdapterRegistry = Record<string, FetchAdapter>;
