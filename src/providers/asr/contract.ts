import type { ProviderIdentity } from "../types";
import type { AsrTranscribeInput, AsrTranscriptionResult } from "./types";

export interface AsrProvider extends ProviderIdentity {
  transcribe(input: AsrTranscribeInput): Promise<AsrTranscriptionResult>;
}
