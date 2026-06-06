import type { ProviderIdentity } from "../types";
import type {
  CreateRealtimeSessionInput,
  RealtimeSessionCredentials,
  RevokeRealtimeSessionInput,
} from "./types";

export interface RealtimeProvider extends ProviderIdentity {
  createSession(input: CreateRealtimeSessionInput): Promise<RealtimeSessionCredentials>;
  revokeSession?(input: RevokeRealtimeSessionInput): Promise<void>;
}
