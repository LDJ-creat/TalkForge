import type { CefrLevel } from "@/domain/enums";
import type { Turn } from "@/domain/turn";
import type { Transcript } from "@/domain/transcript";
import type {
  CorrectionAnalyzeInput,
  CorrectionContextTurn,
} from "@/providers/llm/types";
import {
  ASR_UNCERTAIN_CONFIDENCE_THRESHOLD,
  RECENT_CONTEXT_TURN_LIMIT,
  isLowConfidenceTranscript,
} from "@/providers/llm/correction-policy";

const LEVEL_GUIDANCE: Record<CefrLevel, string> = {
  A1: "Expect very simple sentences. Prefer gentle, concrete suggestions.",
  A2: "Expect short conversational sentences. Avoid advanced idioms in suggestions.",
  B1: "Expect clear conversational English with moderate complexity.",
  B2: "Expect natural situational English with some nuance.",
  C1: "Expect fluent English. Focus on precision and naturalness rather than basics.",
};

export type CorrectionPromptInput = {
  turnId: string;
  transcriptText: string;
  transcriptConfidence?: number;
  recentContext: CorrectionContextTurn[];
  scenarioLevel: CefrLevel;
  scenarioConstraints?: string[];
};

export type CorrectionPrompt = {
  system: string;
  user: string;
  outputSchema: string;
};

export function buildRecentContextTurns(
  sessionTurns: Turn[],
  currentTurnId: string,
  transcriptsByTurnId: Map<string, Transcript | null> = new Map(),
  limit = RECENT_CONTEXT_TURN_LIMIT,
): CorrectionContextTurn[] {
  const ordered = [...sessionTurns].sort(
    (left, right) =>
      new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime(),
  );
  const currentIndex = ordered.findIndex((turn) => turn.id === currentTurnId);
  if (currentIndex <= 0) {
    return [];
  }

  const priorTurns = ordered.slice(Math.max(0, currentIndex - limit), currentIndex);

  return priorTurns.flatMap((turn) => {
    const transcript = transcriptsByTurnId.get(turn.id);
    const text = transcript?.text.trim() ?? turn.transcriptText?.trim();
    if (!text) {
      return [];
    }

    return [
      {
        role: turn.role,
        text,
        confidence: transcript?.confidence,
      },
    ];
  });
}

export function buildCorrectionAnalyzeInput(options: {
  turnId: string;
  transcript: Transcript;
  recentContext: CorrectionContextTurn[];
  scenarioLevel: CefrLevel;
  scenarioConstraints?: string[];
}): CorrectionAnalyzeInput {
  return {
    turnId: options.turnId,
    transcriptText: options.transcript.text,
    transcriptConfidence: options.transcript.confidence,
    recentContext: options.recentContext,
    scenarioLevel: options.scenarioLevel,
    scenarioConstraints: options.scenarioConstraints,
  };
}

function formatRecentContext(context: CorrectionContextTurn[]): string {
  if (context.length === 0) {
    return "No prior transcript context is available.";
  }

  return context
    .map(
      (turn, index) =>
        `${index + 1}. ${turn.role}: ${turn.text}${
          turn.confidence !== undefined
            ? ` (ASR confidence: ${turn.confidence.toFixed(2)})`
            : ""
        }`,
    )
    .join("\n");
}

function formatConstraints(constraints: string[] | undefined): string {
  if (!constraints?.length) {
    return "None provided.";
  }

  return constraints.map((constraint) => `- ${constraint}`).join("\n");
}

export function buildCorrectionPromptFromAnalyzeInput(
  input: CorrectionAnalyzeInput,
): CorrectionPrompt {
  return buildCorrectionPrompt({
    turnId: input.turnId,
    transcriptText: input.transcriptText,
    transcriptConfidence: input.transcriptConfidence,
    recentContext: input.recentContext,
    scenarioLevel: input.scenarioLevel,
    scenarioConstraints: input.scenarioConstraints,
  });
}

export function buildCorrectionPrompt(input: CorrectionPromptInput): CorrectionPrompt {
  const confidenceLabel =
    input.transcriptConfidence !== undefined
      ? input.transcriptConfidence.toFixed(2)
      : "unknown";
  const lowConfidence = isLowConfidenceTranscript(input.transcriptConfidence);

  const outputSchema = `{
  "corrections": [
    {
      "type": "grammar" | "expression" | "vocabulary" | "clarity" | "asr_uncertain",
      "originalText": "string",
      "correctedText": "string | null",
      "explanation": "string",
      "confidence": 0.0
    }
  ]
}`;

  const system = [
    "You analyze English learner speech transcripts from an ASR pipeline.",
    "Identify grammar, expression, vocabulary, and clarity issues in the learner's latest turn.",
    "Do not treat obvious ASR misrecognitions as learner grammar errors.",
    "When transcript confidence is low or wording looks like a recognition artifact, prefer type asr_uncertain.",
    "Return JSON only. Do not wrap the JSON in markdown fences.",
    `Learner level: ${input.scenarioLevel}. ${LEVEL_GUIDANCE[input.scenarioLevel]}`,
    `Low-confidence transcript threshold: ${ASR_UNCERTAIN_CONFIDENCE_THRESHOLD}.`,
  ].join("\n");

  const user = [
    "Recent conversation context:",
    formatRecentContext(input.recentContext),
    "",
    "Scenario constraints:",
    formatConstraints(input.scenarioConstraints),
    "",
    "Current learner transcript:",
    input.transcriptText,
    "",
    `Overall ASR confidence: ${confidenceLabel}${
      lowConfidence ? " (low — avoid over-correction)" : ""
    }`,
    "",
    "Respond with JSON matching this schema:",
    outputSchema,
  ].join("\n");

  return { system, user, outputSchema };
}
