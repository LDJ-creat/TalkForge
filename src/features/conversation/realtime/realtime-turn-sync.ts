import { getClientTurnAudioCacheAdapter } from "@/lib/audio-cache/client-adapter";
import { uploadTurnAudioFromCacheEntry } from "@/lib/audio-cache/handoff";
import { resolveClientRequestUserId } from "@/shared/request-user";

import { QWEN_OMNI_OPENING_USER_TEXT } from "@/providers/qwen-omni/session-config";

import { createTurnOnServer } from "../create-turn-api";
import { skipTurnEvaluationOnServer } from "../skip-turn-evaluation-api";
import type { TranscriptEntry } from "../types";

import {
  startSharedTurnCapture,
  stopSharedTurnCapture,
} from "./realtime-audio-bridge";

type RealtimeTurnSyncOptions = {
  sessionId: string;
  userId?: string;
  onUserTurnPersisted?: (input: {
    clientEntryId: string;
    serverTurnId: string;
  }) => void;
};

type PendingUserTurn = {
  localTurnId: string;
};

export class RealtimeTurnSync {
  private readonly sessionId: string;
  private readonly userId: string;
  private readonly onUserTurnPersisted?: RealtimeTurnSyncOptions["onUserTurnPersisted"];
  private pendingUserTurn: PendingUserTurn | null = null;
  private persistedTranscriptIds = new Set<string>();

  constructor(options: RealtimeTurnSyncOptions) {
    this.sessionId = options.sessionId;
    this.userId = resolveClientRequestUserId(options.userId);
    this.onUserTurnPersisted = options.onUserTurnPersisted;
  }

  async onUserSpeechStarted(): Promise<void> {
    const localTurnId = crypto.randomUUID();
    this.pendingUserTurn = { localTurnId };
    await startSharedTurnCapture(this.sessionId, localTurnId);
  }

  async onUserSpeechStopped(): Promise<void> {
    await stopSharedTurnCapture();
  }

  async onTranscriptFinal(entry: TranscriptEntry): Promise<void> {
    if (entry.status !== "final" || this.persistedTranscriptIds.has(entry.id)) {
      return;
    }

    if (entry.role === "user" && entry.text.trim() === QWEN_OMNI_OPENING_USER_TEXT) {
      this.persistedTranscriptIds.add(entry.id);
      this.pendingUserTurn = null;
      return;
    }

    this.persistedTranscriptIds.add(entry.id);

    if (entry.role === "user") {
      await this.persistUserTurn(entry);
      return;
    }

    if (entry.role === "assistant") {
      await this.persistAssistantTurn(entry);
    }
  }

  private async persistUserTurn(entry: TranscriptEntry): Promise<void> {
    const { turn } = await createTurnOnServer({
      sessionId: this.sessionId,
      role: "user",
      transcriptText: entry.text,
      userId: this.userId,
    });

    this.onUserTurnPersisted?.({
      clientEntryId: entry.id,
      serverTurnId: turn.id,
    });

    const pendingTurnId = this.pendingUserTurn?.localTurnId;
    this.pendingUserTurn = null;

    if (!pendingTurnId) {
      return;
    }

    const adapter = getClientTurnAudioCacheAdapter();
    const cached = await adapter.get(pendingTurnId);

    if (!cached) {
      try {
        await skipTurnEvaluationOnServer(this.sessionId, turn.id, this.userId);
      } catch {
        // Best-effort: mark evaluation skipped when no audio was captured.
      }
      return;
    }

    await adapter.save({
      turnId: turn.id,
      sessionId: this.sessionId,
      blob: cached.blob,
      durationMs: cached.durationMs,
    });
    await adapter.remove(pendingTurnId);

    await uploadTurnAudioFromCacheEntry(adapter, {
      userId: this.userId,
      turnId: turn.id,
      sessionId: this.sessionId,
      durationMs: cached.durationMs,
    });
  }

  private async persistAssistantTurn(entry: TranscriptEntry): Promise<void> {
    await createTurnOnServer({
      sessionId: this.sessionId,
      role: "assistant",
      transcriptText: entry.text,
      userId: this.userId,
    });
  }
}
