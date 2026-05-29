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
    async fetch(source: Source, context: FetchContext): Promise<SourceItem[]> {
      const posts = await readXPosts(source.target, options.fetchImpl);

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

async function readXPosts(target: string, fetchImpl: typeof fetch = fetch): Promise<XPost[]> {
  const body =
    target.startsWith("http://") || target.startsWith("https://")
      ? await readRemoteTarget(target, fetchImpl)
      : await readFile(target, "utf8");
  const parsed = JSON.parse(body) as unknown;
  const posts = isRecord(parsed) && Array.isArray(parsed.posts) ? parsed.posts : Array.isArray(parsed) ? parsed : undefined;

  if (!posts) {
    throw new Error("X adapter fixture/response must contain a posts list");
  }

  return posts.map(parseXPost);
}

async function readRemoteTarget(target: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(target);

  if (!response.ok) {
    throw new Error(`X target returned ${response.status}`);
  }

  return response.text();
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
