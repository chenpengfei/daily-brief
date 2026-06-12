import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createSourceItem, type Source, type SourceItem } from "../domain/index.js";
import type { FetchAdapter, FetchContext } from "./types.js";

export interface AnthropicNewsFetchAdapterOptions {
  fetchImpl?: typeof fetch;
}

interface AnthropicArticle {
  url: string;
  title: string;
  category?: string;
  description?: string;
  publishedAt?: string;
}

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12"
};

export function createAnthropicNewsFetchAdapter(options: AnthropicNewsFetchAdapterOptions = {}): FetchAdapter {
  return {
    name: "anthropic-news",
    readiness: "live-capable",
    async fetch(source: Source, context: FetchContext): Promise<SourceItem[]> {
      const html = await readAnthropicTarget(source.target, options.fetchImpl, context.signal);
      const sourceKind = source.target.includes("/engineering") ? "Engineering" : "News";

      return parseAnthropicArticles(html, source.target).map((article) =>
        createSourceItem({
          id: `${source.id}:${stableArticleId(article)}`,
          sourceId: source.id,
          platform: source.platform,
          url: article.url,
          title: article.title,
          author: "Anthropic",
          fetchedAt: context.fetchedAt.toISOString(),
          analyzableText: buildAnalyzableText(article, sourceKind),
          metadata: {
            sourcePage: source.target,
            sourceKind,
            ...(article.category ? { articleCategory: article.category } : {})
          },
          ...(article.publishedAt ? { publishedAt: article.publishedAt } : {})
        })
      );
    }
  };
}

export const anthropicNewsFetchAdapter = createAnthropicNewsFetchAdapter();

async function readAnthropicTarget(target: string, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<string> {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    const init: RequestInit = {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "daily-brief/0.1 (+https://github.com/chenpengfei/daily-brief)"
      }
    };
    if (signal) {
      init.signal = signal;
    }
    const response = await fetchImpl(target, init);

    if (!response.ok) {
      throw new Error(`Anthropic target returned ${response.status}`);
    }

    return response.text();
  }

  return readFile(target, "utf8");
}

function parseAnthropicArticles(html: string, target: string): AnthropicArticle[] {
  const targetUrl = target.startsWith("http://") || target.startsWith("https://") ? new URL(target) : new URL("https://www.anthropic.com/news");
  const prefix = targetUrl.pathname.includes("/engineering") ? "/engineering/" : "/news/";
  const articles = new Map<string, AnthropicArticle>();
  const linkPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const attributes = match[1] ?? "";
    const href = attributeValue(attributes, "href");

    if (!href || !isArticleHref(href, prefix)) {
      continue;
    }

    const article = parseArticleBlock(match[2] ?? "", absolutizeAnthropicUrl(href));

    if (article && !articles.has(article.url)) {
      articles.set(article.url, article);
    }
  }

  return [...articles.values()];
}

function parseArticleBlock(block: string, url: string): AnthropicArticle | undefined {
  const title = decodeHtmlEntities(
    firstMatch(block, /<(?:h2|h3|h4)[^>]*>([\s\S]*?)<\/(?:h2|h3|h4)>/i) ??
      firstMatch(block, /<span[^>]*title[^>]*>([\s\S]*?)<\/span>/i) ??
      firstMatch(block, /<img[^>]*\balt=(["'])(.*?)\1/i, 2) ??
      ""
  );
  const cleanedTitle = stripMarkup(title);

  if (!cleanedTitle || cleanedTitle.length < 3 || cleanedTitle.startsWith("Image:")) {
    return undefined;
  }

  const rawText = decodeHtmlEntities(stripMarkup(block));
  const category = firstMatch(rawText, /\b(Announcements|Company|Engineering|Policy|Product|Research|Societal Impacts)\b/);
  const date = firstMatch(rawText, /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\b/, 0);
  const description = decodeHtmlEntities(stripMarkup(firstMatch(block, /<p[^>]*>([\s\S]*?)<\/p>/i) ?? ""));
  const publishedAt = date ? normalizeShortDate(date) : undefined;

  return {
    url,
    title: cleanedTitle,
    ...(category ? { category } : {}),
    ...(description ? { description } : {}),
    ...(publishedAt ? { publishedAt } : {})
  };
}

function buildAnalyzableText(article: AnthropicArticle, sourceKind: string): string {
  return [
    `Official Anthropic ${sourceKind} article: ${article.title}.`,
    article.description,
    article.category ? `Article category: ${article.category}.` : undefined
  ]
    .filter(Boolean)
    .join(" ");
}

function isArticleHref(href: string, prefix: string): boolean {
  try {
    const url = new URL(href, "https://www.anthropic.com");
    const path = url.pathname.replace(/\/$/, "");
    return path.startsWith(prefix) && path !== prefix.slice(0, -1) && path.split("/").length > 2;
  } catch {
    return false;
  }
}

function stableArticleId(article: AnthropicArticle): string {
  return createHash("sha256").update(article.url).digest("hex").slice(0, 16);
}

function normalizeShortDate(value: string): string | undefined {
  const match = value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\b/);
  const month = match?.[1];
  const day = match?.[2];
  const year = match?.[3];

  return month && day && year ? `${year}-${MONTHS[month]}-${day.padStart(2, "0")}T00:00:00.000Z` : undefined;
}

function firstMatch(value: string, pattern: RegExp, group = 1): string | undefined {
  return value.match(pattern)?.[group];
}

function attributeValue(attributes: string, name: string): string | undefined {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2];
}

function absolutizeAnthropicUrl(href: string): string {
  return new URL(href, "https://www.anthropic.com").toString();
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}
