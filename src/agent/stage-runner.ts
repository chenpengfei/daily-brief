import {
  AgentStageValidationError,
  parseAgentStageOutput,
  type AgentStageName,
  type AgentStageOutput,
  type AgentStageValidationContext
} from "./stage-contracts.js";
import {
  writeAgentRunArtifact,
  type AgentRunArtifact,
  type AgentRunFailure,
  type AgentRunInputRefs,
  type AgentRunStageRecord
} from "../storage/agent-run-artifact.js";

export interface RunAgentStageInput<TOutput extends AgentStageOutput = AgentStageOutput> {
  stage: AgentStageName;
  artifact: AgentRunArtifact;
  date?: Date;
  artifactRoot?: string;
  inputRefs?: AgentRunInputRefs;
  validationContext?: AgentStageValidationContext;
  execute(): Promise<string | unknown>;
}

export interface RunAgentStageResult<TOutput extends AgentStageOutput = AgentStageOutput> {
  output: TOutput;
  record: AgentRunStageRecord;
  artifactPath?: string;
}

export async function runAgentStage<TOutput extends AgentStageOutput = AgentStageOutput>(
  input: RunAgentStageInput<TOutput>
): Promise<RunAgentStageResult<TOutput>> {
  const startedAt = new Date();

  try {
    const rawOutput = await input.execute();
    const output = parseAgentStageOutput(input.stage, rawOutput, input.validationContext) as TOutput;
    const record: AgentRunStageRecord = {
      stage: input.stage,
      status: "succeeded",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      inputRefs: input.inputRefs ?? {},
      output,
      validation: {
        status: "passed",
        issues: []
      }
    };
    input.artifact.stages.push(record);

    return {
      output,
      record,
      ...(await maybeWriteArtifact(input))
    };
  } catch (error) {
    const failure = toAgentRunFailure(error);
    const record: AgentRunStageRecord = {
      stage: input.stage,
      status: "failed",
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      inputRefs: input.inputRefs ?? {},
      validation: {
        status: failure.kind === "validation" ? "failed" : "passed",
        issues: failure.issues ?? []
      },
      failure
    };
    input.artifact.stages.push(record);
    input.artifact.failure = failure;

    await maybeWriteArtifact(input);
    throw error;
  }
}

async function maybeWriteArtifact(input: RunAgentStageInput): Promise<{ artifactPath?: string }> {
  if (!input.date || !input.artifactRoot) {
    return {};
  }

  const written = await writeAgentRunArtifact(input.artifact, input.date, input.artifactRoot);
  return { artifactPath: written.path };
}

function toAgentRunFailure(error: unknown): AgentRunFailure {
  if (error instanceof AgentStageValidationError) {
    return {
      kind: "validation",
      message: error.message,
      issues: error.issues
    };
  }

  return {
    kind: "execution",
    message: error instanceof Error ? error.message : String(error)
  };
}
