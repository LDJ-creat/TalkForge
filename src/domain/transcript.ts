export type TranscriptWord = {
  word: string;
  startMs: number;
  endMs: number;
  confidence?: number;
};

export type TranscriptSegment = {
  startMs: number;
  endMs: number;
  text: string;
  words?: TranscriptWord[];
};

export type Transcript = {
  id: string;
  turnId: string;
  provider: string;
  text: string;
  confidence?: number;
  segments: TranscriptSegment[];
};

export type CreateTranscriptInput = {
  turnId: string;
  provider: string;
  text: string;
  confidence?: number;
  segments: TranscriptSegment[];
};
