import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createSourceItem, type Source, type SourceItem } from "../domain/index.js";
import type { FetchAdapter, FetchContext } from "./types.js";

export interface GitHubTrendingFetchAdapterOptions {
  fetchImpl?: typeof fetch;
}

interface GitHubRepoCandidate {
  fullName: string;
  url: string;
  description?: string;
  owner?: string;
  stars?: number;
  forks?: number;
  watchers?: number;
  starsToday?: number;
  previousStars?: number;
  pushedAt?: string;
}

export function createGitHubTrendingFetchAdapter(options: GitHubTrendingFetchAdapterOptions = {}): FetchAdapter {
  return {
    name: "github-trending",
    async fetch(source: Source, context: FetchContext): Promise<SourceItem[]> {
      const candidates = await readGitHubCandidates(source.target, options.fetchImpl);
      const observedForDate = (context.collectionDate ?? context.fetchedAt).toISOString().slice(0, 10);
      const trendingRange = readTrendingRange(source.target);

      return candidates.map((candidate) => {
        const input = {
          id: `${source.id}:${stableRepoId(candidate, observedForDate)}`,
          sourceId: source.id,
          platform: source.platform,
          url: candidate.url,
          title: candidate.fullName,
          fetchedAt: context.fetchedAt.toISOString(),
          analyzableText: buildAnalyzableText(candidate),
          metadata: {
            repoName: candidate.fullName,
            ...(candidate.description ? { description: candidate.description } : {}),
            stars: candidate.stars,
            forks: candidate.forks,
            watchers: candidate.watchers,
            starsToday: candidate.starsToday,
            previousStars: candidate.previousStars,
            observedForDate,
            ...(trendingRange ? { trendingRange } : {})
          },
          ...(candidate.owner ? { author: candidate.owner } : {}),
          ...(candidate.pushedAt ? { publishedAt: candidate.pushedAt } : {})
        };

        return createSourceItem(input);
      });
    }
  };
}

export const githubTrendingFetchAdapter = createGitHubTrendingFetchAdapter();

async function readGitHubCandidates(
  target: string,
  fetchImpl: typeof fetch = fetch
): Promise<GitHubRepoCandidate[]> {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    const response = await fetchImpl(target);

    if (!response.ok) {
      throw new Error(`GitHub target returned ${response.status}`);
    }

    const body = await response.text();
    return target.includes("github.com/trending") ? parseTrendingHtml(body) : parseGitHubJson(body);
  }

  return parseGitHubJson(await readFile(target, "utf8"));
}

function parseGitHubJson(body: string): GitHubRepoCandidate[] {
  const parsed = JSON.parse(body) as unknown;
  const items = isRecord(parsed) && Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : undefined;

  if (!items) {
    throw new Error("GitHub fixture/API response must contain an items list");
  }

  return items.map(parseGitHubRepoCandidate);
}

function parseGitHubRepoCandidate(value: unknown): GitHubRepoCandidate {
  if (!isRecord(value)) {
    throw new Error("GitHub repository candidate must be an object");
  }

  const fullName = readString(value, "full_name", "fullName");
  const url = readString(value, "html_url", "url");
  const owner = isRecord(value.owner) ? optionalString(value.owner.login) : optionalString(value.owner);
  const description = optionalString(value.description);
  const stars = optionalNumber(value.stargazers_count ?? value.stars);
  const forks = optionalNumber(value.forks_count ?? value.forks);
  const watchers = optionalNumber(value.watchers_count ?? value.watchers);
  const starsToday = optionalNumber(value.stars_today ?? value.starsToday);
  const previousStars = optionalNumber(value.previous_stargazers_count ?? value.previousStars);
  const pushedAt = optionalString(value.pushed_at ?? value.pushedAt);

  return {
    fullName,
    url,
    ...(description ? { description } : {}),
    ...(owner ? { owner } : {}),
    ...(stars !== undefined ? { stars } : {}),
    ...(forks !== undefined ? { forks } : {}),
    ...(watchers !== undefined ? { watchers } : {}),
    ...(starsToday !== undefined ? { starsToday } : {}),
    ...(previousStars !== undefined ? { previousStars } : {}),
    ...(pushedAt ? { pushedAt } : {})
  };
}

function parseTrendingHtml(body: string): GitHubRepoCandidate[] {
  const articlePattern = /<article[\s\S]*?<\/article>/g;
  const articles = body.match(articlePattern) ?? [];

  return articles.flatMap((article) => {
    const repoMatch = article.match(/<h2[\s\S]*?href="\/([^/"]+\/[^/"]+)"/);

    if (!repoMatch?.[1]) {
      return [];
    }

    const fullName = repoMatch[1].replace(/\s+/g, "");
    const description = stripMarkup(article.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? "");
    const stars = numberFromText(article.match(/aria-label="([\d,]+) stars"/)?.[1]);
    const forks = numberFromText(article.match(/aria-label="([\d,]+) forks"/)?.[1]);
    const starsToday = numberFromText(article.match(/([\d,]+)\s+stars today/)?.[1]);

    return [
      {
        fullName,
        url: `https://github.com/${fullName}`,
        ...(fullName.split("/")[0] ? { owner: fullName.split("/")[0] } : {}),
        ...(description ? { description } : {}),
        ...(stars !== undefined ? { stars } : {}),
        ...(forks !== undefined ? { forks } : {}),
        ...(stars !== undefined ? { watchers: stars } : {}),
        ...(starsToday !== undefined ? { starsToday } : {})
      }
    ];
  });
}

function buildAnalyzableText(candidate: GitHubRepoCandidate): string {
  const metrics = [
    candidate.stars !== undefined ? `${candidate.stars} stars` : undefined,
    candidate.forks !== undefined ? `${candidate.forks} forks` : undefined,
    candidate.watchers !== undefined ? `${candidate.watchers} watchers` : undefined
  ].filter(Boolean);
  const momentum = candidate.starsToday
    ? `Momentum: +${candidate.starsToday} stars today.`
    : candidate.previousStars !== undefined && candidate.stars !== undefined
      ? `Momentum: ${candidate.stars - candidate.previousStars >= 0 ? "+" : ""}${candidate.stars - candidate.previousStars} stars since previous collection.`
      : "Momentum: no recent star delta available.";

  return [
    candidate.description ?? "GitHub repository candidate.",
    metrics.length > 0 ? `Metrics: ${metrics.join(", ")}.` : undefined,
    momentum,
    "Ordinary commits are not treated as Source Items by this adapter."
  ]
    .filter(Boolean)
    .join(" ");
}

function stableRepoId(candidate: GitHubRepoCandidate, observedForDate: string): string {
  return createHash("sha256").update(`${candidate.url}|${observedForDate}`).digest("hex").slice(0, 16);
}

function readTrendingRange(target: string): string | undefined {
  try {
    const url = new URL(target);

    if (!url.hostname.endsWith("github.com") || url.pathname !== "/trending") {
      return undefined;
    }

    return url.searchParams.get("since") ?? "daily";
  } catch {
    return undefined;
  }
}

function readString(source: Record<string, unknown>, primary: string, fallback: string): string {
  const value = optionalString(source[primary] ?? source[fallback]);

  if (!value) {
    throw new Error(`GitHub repository candidate requires ${primary}`);
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

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    return numberFromText(value);
  }

  return undefined;
}

function numberFromText(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
