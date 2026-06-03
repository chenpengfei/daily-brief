import { readFile, writeFile } from "node:fs/promises";
import { isMap, isSeq, parse, parseDocument } from "yaml";
import { parseSourceRegistry, type SourceRegistry } from "../domain/index.js";
import { resolveDailyBriefPaths } from "./paths.js";

export async function loadSourceRegistry(path = resolveDailyBriefPaths().sourceRegistryPath): Promise<SourceRegistry> {
  const contents = await readFile(path, "utf8");
  return parseSourceRegistry(parse(contents));
}

export async function validateSourceRegistry(path = resolveDailyBriefPaths().sourceRegistryPath): Promise<SourceRegistry> {
  return loadSourceRegistry(path);
}

export async function setSourceEnabled(
  id: string,
  enabled: boolean,
  path = resolveDailyBriefPaths().sourceRegistryPath
): Promise<SourceRegistry> {
  const contents = await readFile(path, "utf8");
  const document = parseDocument(contents);
  const sources = document.get("sources", true);

  if (!isSeq(sources)) {
    throw new Error("Source Registry must contain a sources list");
  }

  let found = false;

  for (const source of sources.items) {
    if (!isMap(source)) {
      continue;
    }

    if (source.get("id") === id) {
      source.set("enabled", enabled);
      found = true;
      break;
    }
  }

  if (!found) {
    throw new Error(`Source not found: ${id}`);
  }

  const nextContents = String(document);
  const registry = parseSourceRegistry(parse(nextContents));

  await writeFile(path, nextContents, "utf8");

  return registry;
}

export function formatSourceRegistry(registry: SourceRegistry): string {
  if (registry.sources.length === 0) {
    return [
      "No Sources configured.",
      "",
      "Add Sources by editing the Source Registry, then run:",
      "  daily-brief sources edit",
      "  daily-brief sources validate"
    ].join("\n");
  }

  const rows = registry.sources.map((source) => ({
    sourceId: source.id,
    status: source.enabled ? "enabled" : "disabled",
    platform: source.platform,
    adapter: source.adapter,
    target: source.target
  }));
  const widths = {
    sourceId: Math.max("SOURCE ID".length, ...rows.map((row) => row.sourceId.length)),
    status: Math.max("STATUS".length, ...rows.map((row) => row.status.length)),
    platform: Math.max("PLATFORM".length, ...rows.map((row) => row.platform.length)),
    adapter: Math.max("ADAPTER".length, ...rows.map((row) => row.adapter.length))
  };
  const firstSourceId = rows[0]?.sourceId ?? "<source-id>";
  const lines = [
    `${"SOURCE ID".padEnd(widths.sourceId)}  ${"STATUS".padEnd(widths.status)}  ${"PLATFORM".padEnd(widths.platform)}  ${"ADAPTER".padEnd(widths.adapter)}  TARGET`,
    ...rows.map(
      (row) =>
        `${row.sourceId.padEnd(widths.sourceId)}  ${row.status.padEnd(widths.status)}  ${row.platform.padEnd(widths.platform)}  ${row.adapter.padEnd(widths.adapter)}  ${row.target}`
    ),
    "",
    "Use SOURCE ID with:",
    `  daily-brief sources enable ${firstSourceId}`,
    `  daily-brief sources disable ${firstSourceId}`
  ];

  return lines.join("\n");
}
