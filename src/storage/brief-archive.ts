import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { formatDateKey, resolveDailyBriefPaths } from "../config/index.js";

export interface ArchivedBrief {
  path: string;
}

export async function writeBriefArchive(
  markdown: string,
  date: Date,
  root = resolveDailyBriefPaths().briefArchiveRoot,
  dateKey?: string
): Promise<ArchivedBrief> {
  const path = briefArchivePath(date, root, dateKey);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, markdown, "utf8");

  return { path };
}

export function briefArchivePath(date: Date, root = resolveDailyBriefPaths().briefArchiveRoot, dateKey?: string): string {
  const datePart = dateKey ?? formatDateKey(date);
  const [year, month] = datePart.split("-");

  if (!year || !month) {
    throw new Error(`Invalid archive date: ${datePart}`);
  }

  return join(root, year, month, `${datePart}.md`);
}
