import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { formatDateKey, resolveDailyBriefPaths } from "../config/index.js";
import type { SourceItem } from "../domain/index.js";

export interface AppendSourceItemsResult {
  path: string;
  written: SourceItem[];
  skipped: SourceItem[];
}

export function sourceItemStorePath(date: Date, root = resolveDailyBriefPaths().sourceItemRoot, dateKey?: string): string {
  const datePart = dateKey ?? formatDateKey(date);
  const [year, month] = datePart.split("-");

  if (!year || !month) {
    throw new Error(`Invalid Source Item Store date: ${datePart}`);
  }

  return join(root, year, month, `${datePart}.jsonl`);
}

export async function appendSourceItems(
  items: SourceItem[],
  date: Date,
  root = resolveDailyBriefPaths().sourceItemRoot,
  dateKey?: string
): Promise<AppendSourceItemsResult> {
  const path = sourceItemStorePath(date, root, dateKey);
  const existing = await readSourceItems(date, root, dateKey);
  const seenIds = new Set(existing.map((item) => item.id));
  const seenHashes = new Set(existing.map((item) => item.contentHash));
  const written: SourceItem[] = [];
  const skipped: SourceItem[] = [];

  for (const item of items) {
    if (seenIds.has(item.id) || seenHashes.has(item.contentHash)) {
      skipped.push(item);
      continue;
    }

    seenIds.add(item.id);
    seenHashes.add(item.contentHash);
    written.push(item);
  }

  if (written.length > 0) {
    await mkdir(dirname(path), { recursive: true });
    const next = [...existing, ...written].map((item) => JSON.stringify(item)).join("\n");
    await writeFile(path, `${next}\n`, "utf8");
  }

  return { path, written, skipped };
}

export async function readSourceItems(date: Date, root = resolveDailyBriefPaths().sourceItemRoot, dateKey?: string): Promise<SourceItem[]> {
  const path = sourceItemStorePath(date, root, dateKey);
  let contents: string;

  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return contents
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) => parseSourceItemLine(line, path, index + 1));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function parseSourceItemLine(line: string, path: string, lineNumber: number): SourceItem {
  try {
    return JSON.parse(line) as SourceItem;
  } catch (error) {
    const cause = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`${path} line ${lineNumber} contains malformed Source Item JSON${cause}`);
  }
}
