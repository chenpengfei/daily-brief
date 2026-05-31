import type { DailyBrief } from "../brief/index.js";
import type { SourceItem } from "../domain/index.js";
import type { AgentRunArtifact } from "../storage/index.js";
import { runAgentStage } from "./stage-runner.js";
import type { AuditStageOutput } from "./stage-contracts.js";

export class AnalysisFailureError extends Error {
  readonly findings: AuditStageOutput["findings"];

  constructor(message: string, findings: AuditStageOutput["findings"]) {
    super(message);
    this.name = "AnalysisFailureError";
    this.findings = findings;
  }
}

export async function runSourceGroundingAuditStage(input: {
  brief: DailyBrief;
  sourceItems: SourceItem[];
  artifact: AgentRunArtifact;
  allowRepair?: boolean;
}): Promise<{ brief: DailyBrief; audit: AuditStageOutput; repairAttempts: number }> {
  const first = await recordAudit(input.brief, input.sourceItems, input.artifact);

  if (first.status === "passed") {
    return { brief: input.brief, audit: first, repairAttempts: 0 };
  }

  if (!input.allowRepair) {
    throw new AnalysisFailureError("Source-grounding audit failed", first.findings);
  }

  const repaired = repairBrief(input.brief);
  const second = await recordAudit(repaired, input.sourceItems, input.artifact);

  if (second.status === "failed") {
    throw new AnalysisFailureError("Source-grounding audit failed after repair", second.findings);
  }

  return { brief: repaired, audit: second, repairAttempts: 1 };
}

async function recordAudit(brief: DailyBrief, sourceItems: SourceItem[], artifact: AgentRunArtifact): Promise<AuditStageOutput> {
  const sourceItemIds = sourceItems.map((item) => item.id);
  const signalIds = brief.signals.map((signal) => signal.id);
  const output = buildAuditOutput(brief, sourceItems);
  const result = await runAgentStage<AuditStageOutput>({
    stage: "audit",
    artifact,
    inputRefs: { sourceItemIds, signalIds },
    validationContext: { sourceItemIds, signalIds },
    execute: async () => output
  });

  return result.output;
}

function buildAuditOutput(brief: DailyBrief, sourceItems: SourceItem[]): AuditStageOutput {
  const sourceItemIds = new Set(sourceItems.map((item) => item.id));
  const findings: AuditStageOutput["findings"] = [];

  if (brief.sourceCoverage.partialFailures.length > 0 && /全部|完整|all sources|complete/i.test(brief.executiveSummary)) {
    findings.push({ issue: "Executive Summary overstates collection completeness despite partial failures." });
  }

  for (const signal of brief.signals) {
    if (signal.citations.length === 0) {
      findings.push({ signalId: signal.id, issue: "Signal has no citations." });
    }

    if (!signal.focusAreas || signal.focusAreas.length === 0) {
      findings.push({ signalId: signal.id, issue: "Signal lens focusAreas are missing." });
    }

    if (!signal.directions || signal.directions.length === 0) {
      findings.push({ signalId: signal.id, issue: "Signal lens directions are missing." });
    }

    for (const citation of signal.citations) {
      if (!sourceItemIds.has(citation.sourceItemId)) {
        findings.push({
          signalId: signal.id,
          issue: `Citation references unknown Source Item: ${citation.sourceItemId}`
        });
      }
    }

    const narrative = `${signal.summary.whatItIs} ${signal.summary.whatItIsNot} ${signal.summary.minimalExample} ${signal.whyItMatters}`;
    if (/market leader|guaranteed|best in class|widely adopted/i.test(narrative)) {
      findings.push({ signalId: signal.id, issue: "Narrative contains unsupported overconfident claim." });
    }
  }

  return {
    stage: "audit",
    status: findings.length === 0 ? "passed" : "failed",
    findings
  };
}

function repairBrief(brief: DailyBrief): DailyBrief {
  return {
    ...brief,
    executiveSummary:
      brief.sourceCoverage.partialFailures.length > 0
        ? `${brief.executiveSummary} 部分 Source 采集失败，Coverage 以 Source Coverage 为准。`
        : brief.executiveSummary,
    signals: brief.signals.map((signal) => ({
      ...signal,
      focusAreas: signal.focusAreas && signal.focusAreas.length > 0 ? signal.focusAreas : ["Agent 架构"],
      directions: signal.directions && signal.directions.length > 0 ? signal.directions : ["先进工具"]
    }))
  };
}
