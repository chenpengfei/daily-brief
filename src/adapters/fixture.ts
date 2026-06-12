import { readFile } from "node:fs/promises";
import { createSourceItem, type Source, type SourceItem } from "../domain/index.js";
import type { FetchAdapter, FetchContext } from "./types.js";

interface FixtureSourceItem {
  id: string;
  url: string;
  title: string;
  author?: string;
  publishedAt?: string;
  analyzableText: string;
}

interface FixtureFile {
  items: FixtureSourceItem[];
}

export const fixtureFetchAdapter: FetchAdapter = {
  name: "fixture",
  readiness: "local-only",
  async fetch(source: Source, context: FetchContext): Promise<SourceItem[]> {
    const contents = await readFile(source.target, "utf8");
    const fixture = parseFixtureFile(JSON.parse(contents));

    return fixture.items.map((item) => {
      const input = {
        id: `${source.id}:${item.id}`,
        sourceId: source.id,
        platform: source.platform,
        url: item.url,
        title: item.title,
        fetchedAt: context.fetchedAt.toISOString(),
        analyzableText: item.analyzableText,
        ...(item.author ? { author: item.author } : {}),
        ...(item.publishedAt ? { publishedAt: item.publishedAt } : {})
      };

      return createSourceItem(input);
    });
  }
};

function parseFixtureFile(value: unknown): FixtureFile {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Fixture adapter target must be a JSON object with an items list");
  }

  return {
    items: value.items.map(parseFixtureSourceItem)
  };
}

function parseFixtureSourceItem(value: unknown): FixtureSourceItem {
  if (!isRecord(value)) {
    throw new Error("Fixture Source Item must be an object");
  }

  const id = readString(value, "id");
  const url = readString(value, "url");
  const title = readString(value, "title");
  const analyzableText = readString(value, "analyzableText");
  const author = readOptionalString(value, "author");
  const publishedAt = readOptionalString(value, "publishedAt");

  return {
    id,
    url,
    title,
    ...(author ? { author } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    analyzableText
  };
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Fixture Source Item ${key} must be a non-empty string`);
  }

  return value.trim();
}

function readOptionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Fixture Source Item ${key} must be a non-empty string when present`);
  }

  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
