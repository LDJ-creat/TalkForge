import type { ProviderIdentity } from "../types";
import type {
  PronunciationEvaluateInput,
  PronunciationEvaluationResult,
} from "./types";

export interface PronunciationEvaluationProvider extends ProviderIdentity {
  evaluate(input: PronunciationEvaluateInput): Promise<PronunciationEvaluationResult>;
}
