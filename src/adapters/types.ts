import type { Source, SourceItem } from "../domain/index.js";

export interface FetchContext {
  fetchedAt: Date;
  collectionDate?: Date;
}

export interface FetchAdapter {
  name: string;
  fetch(source: Source, context: FetchContext): Promise<SourceItem[]>;
}

export type FetchAdapterRegistry = Record<string, FetchAdapter>;
