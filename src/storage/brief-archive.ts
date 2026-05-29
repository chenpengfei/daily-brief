import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface ArchivedBrief {
  path: string;
}

export async function writeBriefArchive(markdown: string, date: Date, root = "briefs"): Promise<ArchivedBrief> {
  const path = briefArchivePath(date, root);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, markdown, "utf8");

  return { path };
}

export function briefArchivePath(date: Date, root = "briefs"): string {
  const datePart = date.toISOString().slice(0, 10);
  const [year, month] = datePart.split("-");

  if (!year || !month) {
    throw new Error(`Invalid archive date: ${datePart}`);
  }

  return join(root, year, month, `${datePart}.md`);
}
