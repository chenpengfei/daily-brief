import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createSourceItem, type Source, type SourceItem } from "../domain/index.js";
import type { FetchAdapter, FetchContext } from "./types.js";

export interface ClaudePlatformReleaseNotesFetchAdapterOptions {
  fetchImpl?: typeof fetch;
}

interface ClaudePlatformReleaseNote {
  url: string;
  title: string;
  dateLabel: string;
  publishedAt?: string;
  analyzableText: string;
}

const MONTHS: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12"
};

export function createClaudePlatformReleaseNotesFetchAdapter(
  options: ClaudePlatformReleaseNotesFetchAdapterOptions = {}
): FetchAdapter {
  return {
    name: "claude-platform-release-notes",
    readiness: "live-capable",
    async fetch(source: Source, context: FetchContext): Promise<SourceItem[]> {
      const html = await readReleaseNotesTarget(source.target, options.fetchImpl, context.signal);

      return parseReleaseNotes(html, source.target).map((note) =>
        createSourceItem({
          id: `${source.id}:${stableNoteId(note)}`,
          sourceId: source.id,
          platform: source.platform,
          url: note.url,
          title: note.title,
          author: "Anthropic",
          fetchedAt: context.fetchedAt.toISOString(),
          analyzableText: note.analyzableText,
          metadata: {
            sourcePage: source.target,
            releaseDate: note.dateLabel
          },
          ...(note.publishedAt ? { publishedAt: note.publishedAt } : {})
        })
      );
    }
  };
}

export const claudePlatformReleaseNotesFetchAdapter = createClaudePlatformReleaseNotesFetchAdapter();

async function readReleaseNotesTarget(
  target: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<string> {
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
      throw new Error(`Claude Platform release notes target returned ${response.status}`);
    }

    return response.text();
  }

  return readFile(target, "utf8");
}

function parseReleaseNotes(html: string, target: string): ClaudePlatformReleaseNote[] {
  const targetUrl = target.startsWith("http://") || target.startsWith("https://") ? target : "https://platform.claude.com/docs/en/release-notes/overview";
  const notes: ClaudePlatformReleaseNote[] = [];
  const sectionPattern =
    /(<h3\b[\s\S]*?<div>[A-Z][a-z]+\s+\d{1,2},\s+\d{4}<\/div>[\s\S]*?<\/h3>)([\s\S]*?)(?=<h3\b|$)/g;
  let match: RegExpExecArray | null;

  while ((match = sectionPattern.exec(html)) !== null) {
    const header = match[1] ?? "";
    const id = header.match(/\bid="([^"]+)"/)?.[1];
    const dateLabel = decodeHtmlEntities(header.match(/<div>([A-Z][a-z]+\s+\d{1,2},\s+\d{4})<\/div>/)?.[1] ?? "").trim();
    const body = match[2] ?? "";
    const bullets = [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
      .map((bullet) => decodeHtmlEntities(stripMarkup(bullet[1] ?? "")))
      .filter(Boolean);

    if (!dateLabel || bullets.length === 0) {
      continue;
    }

    const publishedAt = normalizeLongDate(dateLabel);

    notes.push({
      url: id ? `${targetUrl}#${id}` : targetUrl,
      title: `Claude Platform release notes: ${dateLabel}`,
      dateLabel,
      analyzableText: [`Official Claude Platform release notes for ${dateLabel}.`, ...bullets].join(" "),
      ...(publishedAt ? { publishedAt } : {})
    });
  }

  return notes;
}

function stableNoteId(note: ClaudePlatformReleaseNote): string {
  return createHash("sha256").update(`${note.url}|${note.dateLabel}`).digest("hex").slice(0, 16);
}

function normalizeLongDate(value: string): string | undefined {
  const match = value.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/);
  const month = match?.[1];
  const day = match?.[2];
  const year = match?.[3];

  return month && day && year ? `${year}-${MONTHS[month]}-${day.padStart(2, "0")}T00:00:00.000Z` : undefined;
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
