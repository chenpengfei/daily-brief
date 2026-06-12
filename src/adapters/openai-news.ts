import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import { createSourceItem, type Source, type SourceItem } from "../domain/index.js";
import type { FetchAdapter, FetchContext } from "./types.js";

export interface OpenAiNewsFetchAdapterOptions {
  fetchImpl?: typeof fetch;
}

interface OpenAiNewsArticle {
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

const NEWS_CATEGORIES = new Set([
  "AI Adoption",
  "Company",
  "Engineering",
  "Global Affairs",
  "Product",
  "Research",
  "Safety",
  "Security"
]);

export function createOpenAiNewsFetchAdapter(options: OpenAiNewsFetchAdapterOptions = {}): FetchAdapter {
  return {
    name: "openai-news",
    readiness: "live-capable",
    async fetch(source: Source, context: FetchContext): Promise<SourceItem[]> {
      const html = await readNewsTarget(source.target, options.fetchImpl, context.signal);
      const pageCategory = openAiNewsPageCategory(source.target);
      const articleCategory = openAiArticleCategory(pageCategory);
      const articles = isXmlFeed(html)
        ? parseOpenAiNewsRssArticles(html).filter((article) => !articleCategory || article.category === articleCategory)
        : parseOpenAiNewsArticles(html, source.target);

      return articles.map((article) =>
        createSourceItem({
          id: `${source.id}:${stableArticleId(article)}`,
          sourceId: source.id,
          platform: source.platform,
          url: article.url,
          title: article.title,
          author: "OpenAI",
          fetchedAt: context.fetchedAt.toISOString(),
          analyzableText: buildAnalyzableText(article, pageCategory),
          metadata: {
            sourcePage: source.target,
            ...(pageCategory ? { pageCategory } : {}),
            ...(article.category ? { articleCategory: article.category } : {})
          },
          ...(article.publishedAt ? { publishedAt: article.publishedAt } : {})
        })
      );
    }
  };
}

export const openAiNewsFetchAdapter = createOpenAiNewsFetchAdapter();

async function readNewsTarget(target: string, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<string> {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    const init: RequestInit = {
      headers: {
        Accept: "text/html,application/rss+xml,application/xml,application/xhtml+xml",
        "User-Agent": "daily-brief/0.1 (+https://github.com/chenpengfei/daily-brief)"
      }
    };
    if (signal) {
      init.signal = signal;
    }
    const response = await fetchImpl(target, {
      ...init
    });

    if (!response.ok) {
      if (response.status === 403 && isOpenAiNewsPage(target)) {
        return readNewsTarget("https://openai.com/news/rss.xml", fetchImpl, signal);
      }

      throw new Error(`OpenAI News target returned ${response.status}`);
    }

    return response.text();
  }

  return readFile(target, "utf8");
}

function parseOpenAiNewsRssArticles(feed: string): OpenAiNewsArticle[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text"
  });
  const parsed = parser.parse(feed) as unknown;

  if (!isRecord(parsed) || !isRecord(parsed.rss) || !isRecord(parsed.rss.channel)) {
    throw new Error("OpenAI News RSS feed missing channel");
  }

  return toArray(parsed.rss.channel.item).map((item) => {
    if (!isRecord(item)) {
      throw new Error("OpenAI News RSS item must be an object");
    }

    const title = requiredText(item.title, "OpenAI News RSS item title");
    const url = requiredText(item.link ?? item.guid, "OpenAI News RSS item link");
    const description = optionalText(item.description);
    const category = optionalText(item.category);
    const publishedAt = normalizeDate(optionalText(item.pubDate));

    return {
      title,
      url,
      ...(description ? { description: stripMarkup(description) } : {}),
      ...(category ? { category } : {}),
      ...(publishedAt ? { publishedAt } : {})
    };
  });
}

function parseOpenAiNewsArticles(html: string, target: string): OpenAiNewsArticle[] {
  const targetUrl = target.startsWith("http://") || target.startsWith("https://") ? new URL(target) : new URL("https://openai.com/news/");
  const targetPath = targetUrl.pathname.replace(/\/$/, "");
  const articles = new Map<string, OpenAiNewsArticle>();
  const linkPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const attributes = match[1] ?? "";
    const href = attributeValue(attributes, "href");

    if (!href || !isOpenAiNewsArticleHref(href, targetPath)) {
      continue;
    }

    const label = attributeValue(attributes, "aria-label") ?? attributeValue(attributes, "title") ?? stripMarkup(match[2] ?? "");
    const article = parseArticleLabel(label, absolutizeOpenAiUrl(href));

    if (article && !articles.has(article.url)) {
      articles.set(article.url, article);
    }
  }

  return [...articles.values()];
}

function isOpenAiNewsArticleHref(href: string, targetPath: string): boolean {
  const url = absolutizeOpenAiUrl(href);
  const path = new URL(url).pathname.replace(/\/$/, "");

  return (
    (path.startsWith("/news/") || path.startsWith("/index/")) &&
    path !== "/news" &&
    path !== targetPath &&
    path.split("/").length > 2
  );
}

function parseArticleLabel(label: string, url: string): OpenAiNewsArticle | undefined {
  const text = decodeHtmlEntities(label).replace(/\s+/g, " ").trim();

  if (!text || text.startsWith("Image:")) {
    return undefined;
  }

  const dateMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\b/);
  const dateStart = dateMatch?.index;
  const beforeDate = dateStart === undefined ? text : text.slice(0, dateStart).trim();
  const category = readTrailingCategory(beforeDate);
  const title = category ? beforeDate.slice(0, -category.length).trim() : beforeDate;

  if (!title || title.length < 3) {
    return undefined;
  }

  const month = dateMatch?.[1];
  const day = dateMatch?.[2];
  const year = dateMatch?.[3];

  return {
    url,
    title,
    ...(category ? { category } : {}),
    ...(month && day && year ? { publishedAt: `${year}-${MONTHS[month]}-${day.padStart(2, "0")}T00:00:00.000Z` } : {})
  };
}

function readTrailingCategory(text: string): string | undefined {
  return [...NEWS_CATEGORIES].find((category) => text.endsWith(` ${category}`));
}

function buildAnalyzableText(article: OpenAiNewsArticle, pageCategory: string | undefined): string {
  return [
    `Official OpenAI News article: ${article.title}.`,
    article.description,
    pageCategory ? `Listed on the OpenAI ${pageCategory} News page.` : "Listed on an OpenAI News page.",
    article.category ? `Article category: ${article.category}.` : undefined
  ]
    .filter(Boolean)
    .join(" ");
}

function stableArticleId(article: OpenAiNewsArticle): string {
  return createHash("sha256").update(article.url).digest("hex").slice(0, 16);
}

function openAiNewsPageCategory(target: string): string | undefined {
  try {
    const path = new URL(target).pathname.replace(/\/$/, "");
    const slug = path.split("/").pop();

    if (!slug) {
      return undefined;
    }

    return slug
      .split("-")
      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return undefined;
  }
}

function openAiArticleCategory(pageCategory: string | undefined): string | undefined {
  if (pageCategory === "Product Releases") {
    return "Product";
  }

  return pageCategory && NEWS_CATEGORIES.has(pageCategory) ? pageCategory : undefined;
}

function isOpenAiNewsPage(target: string): boolean {
  try {
    const url = new URL(target);
    return url.hostname === "openai.com" && url.pathname.startsWith("/news/");
  } catch {
    return false;
  }
}

function isXmlFeed(value: string): boolean {
  return /^\s*<\?xml\b/.test(value) || /^\s*<rss\b/.test(value);
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function requiredText(value: unknown, label: string): string {
  const text = optionalText(value);

  if (!text) {
    throw new Error(`${label} must be present`);
  }

  return text;
}

function optionalText(value: unknown): string | undefined {
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

function attributeValue(attributes: string, name: string): string | undefined {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2];
}

function absolutizeOpenAiUrl(href: string): string {
  return new URL(href, "https://openai.com").toString();
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
    .replace(/&#39;/g, "'");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
