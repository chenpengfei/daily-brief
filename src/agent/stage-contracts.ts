export const AGENT_STAGE_NAMES = ["understanding", "selection", "ranking", "narrative", "audit", "repair"] as const;

export type AgentStageName = (typeof AGENT_STAGE_NAMES)[number];

export type AgentStageOutput =
  | UnderstandingStageOutput
  | SelectionStageOutput
  | RankingStageOutput
  | NarrativeStageOutput
  | AuditStageOutput
  | RepairStageOutput;

export interface UnderstandingStageOutput {
  stage: "understanding";
  sourceItemAnnotations: Array<{
    sourceItemId: string;
    claims: string[];
    summary: string;
    focusAreaRelevance: "strong" | "partial" | "weak" | "none";
    evidenceBoundary: string;
    relevance: "relevant" | "not_relevant" | "uncertain";
    evidence: string[];
    weakItemHints: string[];
  }>;
}

export interface SelectionStageOutput {
  stage: "selection";
  candidateSignals: Array<{
    signalId: string;
    title: string;
    signalType?: "architecture" | "ai-coding" | "tool-repo" | "risk";
    strength: "strong" | "weak";
    sourceItemIds: string[];
    reason: string;
  }>;
  excludedSourceItems?: Array<{
    sourceItemId: string;
    reason: string;
  }>;
}

export interface RankingStageOutput {
  stage: "ranking";
  rankedSignals: Array<{
    signalId: string;
    rank: number;
    reason: string;
  }>;
}

export interface NarrativeStageOutput {
  stage: "narrative";
  executiveSummary?: string;
  signalNarratives: Array<{
    signalId: string;
    focusAreas: string[];
    directions: string[];
    whatItIs: string;
    whatItIsNot: string;
    minimalExample: string;
    whyItMatters: string;
  }>;
}

export interface AuditStageOutput {
  stage: "audit";
  status: "passed" | "failed";
  findings: Array<{
    signalId?: string;
    sourceItemId?: string;
    issue: string;
  }>;
}

export interface RepairStageOutput {
  stage: "repair";
  executiveSummary?: string;
  signalNarratives: Array<{
    signalId: string;
    focusAreas: string[];
    directions: string[];
    whatItIs: string;
    whatItIsNot: string;
    minimalExample: string;
    whyItMatters: string;
  }>;
}

export interface AgentStageValidationContext {
  sourceItemIds?: string[];
  signalIds?: string[];
}

export class AgentStageValidationError extends Error {
  readonly stage: AgentStageName;
  readonly issues: string[];

  constructor(stage: AgentStageName, issues: string[]) {
    super(`Invalid ${stage} stage output:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "AgentStageValidationError";
    this.stage = stage;
    this.issues = issues;
  }
}

export function parseAgentStageOutput(
  stage: AgentStageName,
  value: string | unknown,
  context: AgentStageValidationContext = {}
): AgentStageOutput {
  let parsed: unknown;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AgentStageValidationError(stage, [`output must be valid JSON: ${message}`]);
    }
  } else {
    parsed = value;
  }

  return validateAgentStageOutput(stage, parsed, context);
}

export function validateAgentStageOutput(
  stage: AgentStageName,
  value: unknown,
  context: AgentStageValidationContext = {}
): AgentStageOutput {
  const issues: string[] = [];

  if (!isRecord(value)) {
    throw new AgentStageValidationError(stage, ["output must be an object"]);
  }

  if (value.stage !== stage) {
    issues.push(`stage must be ${stage}`);
  }

  if (stage === "understanding") {
    validateUnderstanding(value, context, issues);
  } else if (stage === "selection") {
    validateSelection(value, context, issues);
  } else if (stage === "ranking") {
    validateRanking(value, context, issues);
  } else if (stage === "narrative" || stage === "repair") {
    validateNarrative(value, context, issues);
  } else if (stage === "audit") {
    validateAudit(value, context, issues);
  }

  if (issues.length > 0) {
    throw new AgentStageValidationError(stage, issues);
  }

  return value as unknown as AgentStageOutput;
}

function validateUnderstanding(
  value: Record<string, unknown>,
  context: AgentStageValidationContext,
  issues: string[]
): void {
  const annotations = readArray(value.sourceItemAnnotations, "sourceItemAnnotations", issues);

  for (const [index, annotation] of annotations.entries()) {
    if (!isRecord(annotation)) {
      issues.push(`sourceItemAnnotations[${index}] must be an object`);
      continue;
    }

    const sourceItemId = readString(annotation.sourceItemId, `sourceItemAnnotations[${index}].sourceItemId`, issues);
    validateStringArray(annotation.claims, `sourceItemAnnotations[${index}].claims`, issues);
    readString(annotation.summary, `sourceItemAnnotations[${index}].summary`, issues);
    readString(annotation.evidenceBoundary, `sourceItemAnnotations[${index}].evidenceBoundary`, issues);

    if (!["relevant", "not_relevant", "uncertain"].includes(String(annotation.relevance))) {
      issues.push(`sourceItemAnnotations[${index}].relevance must be relevant, not_relevant, or uncertain`);
    }

    if (!["strong", "partial", "weak", "none"].includes(String(annotation.focusAreaRelevance))) {
      issues.push(`sourceItemAnnotations[${index}].focusAreaRelevance must be strong, partial, weak, or none`);
    }

    validateStringArray(annotation.evidence, `sourceItemAnnotations[${index}].evidence`, issues);
    validateStringArray(annotation.weakItemHints, `sourceItemAnnotations[${index}].weakItemHints`, issues);
    validateKnownRef("sourceItemId", sourceItemId, context.sourceItemIds, issues);
  }
}

function validateSelection(value: Record<string, unknown>, context: AgentStageValidationContext, issues: string[]): void {
  const signals = readArray(value.candidateSignals, "candidateSignals", issues);

  for (const [index, signal] of signals.entries()) {
    if (!isRecord(signal)) {
      issues.push(`candidateSignals[${index}] must be an object`);
      continue;
    }

    readString(signal.signalId, `candidateSignals[${index}].signalId`, issues);
    readString(signal.title, `candidateSignals[${index}].title`, issues);
    readString(signal.reason, `candidateSignals[${index}].reason`, issues);
    if (signal.strength !== "strong" && signal.strength !== "weak") {
      issues.push(`candidateSignals[${index}].strength must be strong or weak`);
    }
    if (
      signal.signalType !== undefined &&
      !["architecture", "ai-coding", "tool-repo", "risk"].includes(String(signal.signalType))
    ) {
      issues.push(`candidateSignals[${index}].signalType must be architecture, ai-coding, tool-repo, or risk`);
    }

    for (const sourceItemId of validateStringArray(signal.sourceItemIds, `candidateSignals[${index}].sourceItemIds`, issues)) {
      validateKnownRef("sourceItemId", sourceItemId, context.sourceItemIds, issues);
    }
  }

  if (value.excludedSourceItems !== undefined) {
    const excluded = readArray(value.excludedSourceItems, "excludedSourceItems", issues);

    for (const [index, exclusion] of excluded.entries()) {
      if (!isRecord(exclusion)) {
        issues.push(`excludedSourceItems[${index}] must be an object`);
        continue;
      }

      const sourceItemId = readString(exclusion.sourceItemId, `excludedSourceItems[${index}].sourceItemId`, issues);
      readString(exclusion.reason, `excludedSourceItems[${index}].reason`, issues);
      validateKnownRef("sourceItemId", sourceItemId, context.sourceItemIds, issues);
    }
  }
}

function validateRanking(value: Record<string, unknown>, context: AgentStageValidationContext, issues: string[]): void {
  const signals = readArray(value.rankedSignals, "rankedSignals", issues);

  for (const [index, signal] of signals.entries()) {
    if (!isRecord(signal)) {
      issues.push(`rankedSignals[${index}] must be an object`);
      continue;
    }

    const signalId = readString(signal.signalId, `rankedSignals[${index}].signalId`, issues);
    readString(signal.reason, `rankedSignals[${index}].reason`, issues);

    if (!Number.isInteger(signal.rank) || Number(signal.rank) < 1) {
      issues.push(`rankedSignals[${index}].rank must be a positive integer`);
    }

    validateKnownRef("signalId", signalId, context.signalIds, issues);
  }
}

function validateNarrative(value: Record<string, unknown>, context: AgentStageValidationContext, issues: string[]): void {
  if (value.executiveSummary !== undefined) {
    readString(value.executiveSummary, "executiveSummary", issues);
  }

  const narratives = readArray(value.signalNarratives, "signalNarratives", issues);

  for (const [index, narrative] of narratives.entries()) {
    if (!isRecord(narrative)) {
      issues.push(`signalNarratives[${index}] must be an object`);
      continue;
    }

    const signalId = readString(narrative.signalId, `signalNarratives[${index}].signalId`, issues);
    validateStringArray(narrative.focusAreas, `signalNarratives[${index}].focusAreas`, issues);
    validateStringArray(narrative.directions, `signalNarratives[${index}].directions`, issues);
    readString(narrative.whatItIs, `signalNarratives[${index}].whatItIs`, issues);
    readString(narrative.whatItIsNot, `signalNarratives[${index}].whatItIsNot`, issues);
    readString(narrative.minimalExample, `signalNarratives[${index}].minimalExample`, issues);
    readString(narrative.whyItMatters, `signalNarratives[${index}].whyItMatters`, issues);
    validateKnownRef("signalId", signalId, context.signalIds, issues);
  }
}

function validateAudit(value: Record<string, unknown>, context: AgentStageValidationContext, issues: string[]): void {
  if (value.status !== "passed" && value.status !== "failed") {
    issues.push("status must be passed or failed");
  }

  const findings = readArray(value.findings, "findings", issues);

  for (const [index, finding] of findings.entries()) {
    if (!isRecord(finding)) {
      issues.push(`findings[${index}] must be an object`);
      continue;
    }

    if (finding.signalId !== undefined) {
      const signalId = readString(finding.signalId, `findings[${index}].signalId`, issues);
      validateKnownRef("signalId", signalId, context.signalIds, issues);
    }

    if (finding.sourceItemId !== undefined) {
      const sourceItemId = readString(finding.sourceItemId, `findings[${index}].sourceItemId`, issues);
      validateKnownRef("sourceItemId", sourceItemId, context.sourceItemIds, issues);
    }

    readString(finding.issue, `findings[${index}].issue`, issues);
  }
}

function readArray(value: unknown, field: string, issues: string[]): unknown[] {
  if (!Array.isArray(value)) {
    issues.push(`${field} must be an array`);
    return [];
  }

  return value;
}

function validateStringArray(value: unknown, field: string, issues: string[]): string[] {
  const entries = readArray(value, field, issues);
  const strings: string[] = [];

  for (const [index, entry] of entries.entries()) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      issues.push(`${field}[${index}] must be a non-empty string`);
    } else {
      strings.push(entry.trim());
    }
  }

  return strings;
}

function readString(value: unknown, field: string, issues: string[]): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${field} must be a non-empty string`);
    return "";
  }

  return value.trim();
}

function validateKnownRef(kind: string, value: string, known: string[] | undefined, issues: string[]): void {
  if (!value || !known) {
    return;
  }

  if (!known.includes(value)) {
    issues.push(`${kind} references unknown id: ${value}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
