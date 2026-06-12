import { readFile } from "node:fs/promises";
import { createSourceItem, type Source, type SourceItem } from "../domain/index.js";
import type { FetchAdapter, FetchContext } from "./types.js";

export interface XFetchAdapterOptions {
  fetchImpl?: typeof fetch;
}

type XPostType = "original" | "repost" | "quote" | "reply";

interface XPost {
  id: string;
  url: string;
  text: string;
  author?: string;
  createdAt?: string;
  type?: XPostType;
  addedText?: string;
}

export function createXFetchAdapter(options: XFetchAdapterOptions = {}): FetchAdapter {
  return {
    name: "x",
    readiness: "live-capable",
    async fetch(source: Source, context: FetchContext): Promise<SourceItem[]> {
      const posts = await readXPosts(source.target, options.fetchImpl, context.signal);

      return posts.filter(shouldKeepPost).map((post) =>
        createSourceItem({
          id: `${source.id}:${post.id}`,
          sourceId: source.id,
          platform: source.platform,
          url: post.url,
          title: `${post.author ?? source.id}: ${firstLine(post.addedText ?? post.text)}`,
          fetchedAt: context.fetchedAt.toISOString(),
          analyzableText: post.addedText ? `${post.addedText}\n\nQuoted context: ${post.text}` : post.text,
          metadata: {
            postType: post.type ?? "original",
            sourceTarget: source.target
          },
          ...(post.author ? { author: post.author } : {}),
          ...(post.createdAt ? { publishedAt: post.createdAt } : {})
        })
      );
    }
  };
}

export const xFetchAdapter = createXFetchAdapter();

async function readXPosts(target: string, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<XPost[]> {
  const body =
    target.startsWith("http://") || target.startsWith("https://")
      ? await readRemoteTarget(target, fetchImpl, signal)
      : await readFile(target, "utf8");
  const parsed = JSON.parse(body) as unknown;
  const posts = isRecord(parsed) && Array.isArray(parsed.posts) ? parsed.posts : Array.isArray(parsed) ? parsed : undefined;

  if (!posts) {
    throw new Error("X adapter fixture/response must contain a posts list");
  }

  return posts.map(parseXPost);
}

async function readRemoteTarget(target: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<string> {
  if (isXProfileTarget(target)) {
    throw new Error("X live profile fetching requires the X API profile adapter planned in Goal Issue #48");
  }

  const response = await fetchImpl(target, signal ? { signal } : undefined);

  if (!response.ok) {
    throw new Error(`X target returned ${response.status}`);
  }

  return response.text();
}

function isXProfileTarget(target: string): boolean {
  try {
    const url = new URL(target);
    const host = url.hostname.replace(/^www\./, "");
    const segments = url.pathname.split("/").filter(Boolean);

    return (host === "x.com" || host === "twitter.com") && segments.length === 1;
  } catch {
    return false;
  }
}

function parseXPost(value: unknown): XPost {
  if (!isRecord(value)) {
    throw new Error("X post must be an object");
  }

  const id = readString(value, "id");
  const url = readString(value, "url");
  const text = readString(value, "text");
  const type = optionalPostType(value.type);
  const author = optionalString(value.author);
  const createdAt = optionalString(value.createdAt ?? value.created_at);
  const addedText = optionalString(value.addedText ?? value.added_text);

  return {
    id,
    url,
    text,
    ...(type ? { type } : {}),
    ...(author ? { author } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(addedText ? { addedText } : {})
  };
}

function shouldKeepPost(post: XPost): boolean {
  const type = post.type ?? "original";

  if (type === "repost") {
    return false;
  }

  if (type === "quote" || type === "reply") {
    return isFocusRelevant(`${post.addedText ?? ""} ${post.text}`);
  }

  return isFocusRelevant(post.text);
}

function isFocusRelevant(text: string): boolean {
  const normalized = text.toLowerCase();
  const terms = [
    "agent architecture",
    "agent runtime",
    "coding agent",
    "ai coding",
    "tool execution",
    "eval",
    "memory",
    "mcp"
  ];

  return terms.some((term) => normalized.includes(term));
}

function firstLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 96);
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = optionalString(source[key]);

  if (!value) {
    throw new Error(`X post ${key} must be a non-empty string`);
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalPostType(value: unknown): XPostType | undefined {
  if (value === "original" || value === "repost" || value === "quote" || value === "reply") {
    return value;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
