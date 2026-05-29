import { createHash } from "node:crypto";
import type { SourcePlatform } from "./source.js";

export interface SourceItem {
  id: string;
  sourceId: string;
  platform: SourcePlatform;
  url: string;
  title: string;
  author?: string;
  publishedAt?: string;
  fetchedAt: string;
  analyzableText: string;
  metadata?: Record<string, unknown>;
  contentHash: string;
}

export interface SourceItemInput {
  id: string;
  sourceId: string;
  platform: SourcePlatform;
  url: string;
  title: string;
  author?: string;
  publishedAt?: string;
  fetchedAt: string;
  analyzableText: string;
  metadata?: Record<string, unknown>;
}

export function createSourceItem(input: SourceItemInput): SourceItem {
  return {
    ...input,
    contentHash: hashSourceItemContent(input)
  };
}

export function hashSourceItemContent(input: Omit<SourceItemInput, "fetchedAt">): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        sourceId: input.sourceId,
        platform: input.platform,
        url: input.url,
        title: input.title,
        author: input.author,
        publishedAt: input.publishedAt,
        analyzableText: input.analyzableText,
        metadata: input.metadata
      })
    )
    .digest("hex");
}
