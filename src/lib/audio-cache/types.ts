export type TurnAudioUploadStatus = "pending" | "uploaded" | "failed";

export type TurnAudioCacheEntry = {
  turnId: string;
  sessionId: string;
  blob: Blob;
  durationMs: number;
  uploadStatus: TurnAudioUploadStatus;
  objectKey?: string;
  lastError?: string;
  updatedAt: string;
};

export type SaveTurnAudioCacheInput = {
  turnId: string;
  sessionId: string;
  blob: Blob;
  durationMs: number;
};

export type TurnAudioCacheAdapter = {
  save(input: SaveTurnAudioCacheInput): Promise<TurnAudioCacheEntry>;
  get(turnId: string): Promise<TurnAudioCacheEntry | null>;
  listPending(): Promise<TurnAudioCacheEntry[]>;
  markUploaded(turnId: string, objectKey: string): Promise<TurnAudioCacheEntry | null>;
  markFailed(turnId: string, message: string): Promise<TurnAudioCacheEntry | null>;
  remove(turnId: string): Promise<void>;
};
