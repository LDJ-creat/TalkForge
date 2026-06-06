import type { ProviderIdentity } from "../types";
import type { TtsSynthesizeInput, TtsAudioResult } from "./types";

export interface TtsProvider extends ProviderIdentity {
  synthesize(input: TtsSynthesizeInput): Promise<TtsAudioResult>;
}
