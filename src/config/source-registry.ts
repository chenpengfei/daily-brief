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
    return "No Sources configured.";
  }

  return registry.sources
    .map((source) => {
      const state = source.enabled ? "enabled" : "disabled";
      return `${state.padEnd(8)} ${source.id} ${source.platform}/${source.adapter} ${source.target}`;
    })
    .join("\n");
}
