import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import { createSourceItem, type Source, type SourceItem } from "../domain/index.js";
import type { FetchAdapter, FetchContext } from "./types.js";

export interface RssFetchAdapterOptions {
  fetchImpl?: typeof fetch;
}

interface ParsedFeedEntry {
  url: string;
  title: string;
  author?: string;
  publishedAt?: string;
  analyzableText: string;
}

export function createRssFetchAdapter(options: RssFetchAdapterOptions = {}): FetchAdapter {
  return {
    name: "rss",
    async fetch(source: Source, context: FetchContext): Promise<SourceItem[]> {
      const feed = await readFeedTarget(source.target, options.fetchImpl);
      const entries = parseFeedEntries(feed);

      return entries.map((entry) =>
        createSourceItem({
          id: `${source.id}:${stableEntryId(entry)}`,
          sourceId: source.id,
          platform: source.platform,
          url: entry.url,
          title: entry.title,
          fetchedAt: context.fetchedAt.toISOString(),
          analyzableText: entry.analyzableText,
          ...(entry.author ? { author: entry.author } : {}),
          ...(entry.publishedAt ? { publishedAt: entry.publishedAt } : {})
        })
      );
    }
  };
}

export const rssFetchAdapter = createRssFetchAdapter();

async function readFeedTarget(target: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    const response = await fetchImpl(target);

    if (!response.ok) {
      throw new Error(`RSS target returned ${response.status}`);
    }

    return response.text();
  }

  return readFile(target, "utf8");
}

function parseFeedEntries(feed: string): ParsedFeedEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text"
  });
  const parsed = parser.parse(feed) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("RSS/Atom feed did not parse into an object");
  }

  if (isRecord(parsed.rss)) {
    return parseRssEntries(parsed.rss);
  }

  if (isRecord(parsed.feed)) {
    return parseAtomEntries(parsed.feed);
  }

  throw new Error("Unsupported feed format: expected RSS or Atom");
}

function parseRssEntries(rss: Record<string, unknown>): ParsedFeedEntry[] {
  const channel = rss.channel;

  if (!isRecord(channel)) {
    throw new Error("RSS feed missing channel");
  }

  return toArray(channel.item).map((item) => {
    if (!isRecord(item)) {
      throw new Error("RSS item must be an object");
    }

    const title = textValue(item.title, "RSS item title");
    const url = textValue(item.link, "RSS item link");
    const analyzableText = textValue(item.description ?? item["content:encoded"] ?? title, "RSS item description");
    const author = optionalTextValue(item.author ?? item["dc:creator"]);
    const publishedAt = normalizeDate(optionalTextValue(item.pubDate));

    return {
      title,
      url,
      analyzableText: stripMarkup(analyzableText),
      ...(author ? { author } : {}),
      ...(publishedAt ? { publishedAt } : {})
    };
  });
}

function parseAtomEntries(feed: Record<string, unknown>): ParsedFeedEntry[] {
  return toArray(feed.entry).map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("Atom entry must be an object");
    }

    const title = textValue(entry.title, "Atom entry title");
    const url = atomLink(entry.link);
    const analyzableText = textValue(entry.summary ?? entry.content ?? title, "Atom entry summary");
    const author = atomAuthor(entry.author);
    const publishedAt = normalizeDate(optionalTextValue(entry.published ?? entry.updated));

    return {
      title,
      url,
      analyzableText: stripMarkup(analyzableText),
      ...(author ? { author } : {}),
      ...(publishedAt ? { publishedAt } : {})
    };
  });
}

function atomLink(value: unknown): string {
  const links = toArray(value);
  const alternate = links.find((link) => isRecord(link) && (link["@_rel"] === "alternate" || link["@_rel"] === undefined));
  const selected = alternate ?? links[0];

  if (isRecord(selected)) {
    return textValue(selected["@_href"] ?? selected.href, "Atom entry link");
  }

  return textValue(selected, "Atom entry link");
}

function atomAuthor(value: unknown): string | undefined {
  if (isRecord(value)) {
    return optionalTextValue(value.name);
  }

  return optionalTextValue(value);
}

function stableEntryId(entry: ParsedFeedEntry): string {
  return createHash("sha256")
    .update(JSON.stringify({ url: entry.url, title: entry.title, publishedAt: entry.publishedAt }))
    .digest("hex")
    .slice(0, 16);
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function textValue(value: unknown, label: string): string {
  const text = optionalTextValue(value);

  if (!text) {
    throw new Error(`${label} must be present`);
  }

  return text;
}

function optionalTextValue(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text.length > 0 ? text : undefined;
  }

  if (isRecord(value) && typeof value["#text"] === "string") {
    const text = value["#text"].trim();
    return text.length > 0 ? text : undefined;
  }

  return undefined;
}

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
