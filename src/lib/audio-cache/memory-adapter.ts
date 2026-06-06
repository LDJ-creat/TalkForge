import type {
  SaveTurnAudioCacheInput,
  TurnAudioCacheAdapter,
  TurnAudioCacheEntry,
} from "./types";

export function createMemoryTurnAudioCacheAdapter(): TurnAudioCacheAdapter {
  const entries = new Map<string, TurnAudioCacheEntry>();

  return {
    async save(input: SaveTurnAudioCacheInput) {
      const entry: TurnAudioCacheEntry = {
        turnId: input.turnId,
        sessionId: input.sessionId,
        blob: input.blob,
        durationMs: input.durationMs,
        uploadStatus: "pending",
        updatedAt: new Date().toISOString(),
      };
      entries.set(input.turnId, entry);
      return entry;
    },
    async get(turnId) {
      return entries.get(turnId) ?? null;
    },
    async listPending() {
      return [...entries.values()].filter((entry) => entry.uploadStatus === "pending");
    },
    async markUploaded(turnId, objectKey) {
      const entry = entries.get(turnId);
      if (!entry) {
        return null;
      }
      const updated: TurnAudioCacheEntry = {
        ...entry,
        uploadStatus: "uploaded",
        objectKey,
        updatedAt: new Date().toISOString(),
      };
      entries.set(turnId, updated);
      return updated;
    },
    async markFailed(turnId, message) {
      const entry = entries.get(turnId);
      if (!entry) {
        return null;
      }
      const updated: TurnAudioCacheEntry = {
        ...entry,
        uploadStatus: "failed",
        lastError: message,
        updatedAt: new Date().toISOString(),
      };
      entries.set(turnId, updated);
      return updated;
    },
    async remove(turnId) {
      entries.delete(turnId);
    },
  };
}
