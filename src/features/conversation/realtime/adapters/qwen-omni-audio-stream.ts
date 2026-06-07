import { INPUT_APPEND_INTERVAL_MS, OUTPUT_SAMPLE_RATE } from "../audio/constants";
import { recordAudioAppend } from "../audio/audio-diagnostics";
import { BargeInDetector } from "../audio/barge-in";
import { startMicCapture } from "../audio/mic-capture";
import { passesNoiseGate, resolveNoiseGatePeak } from "../audio/noise-gate";
import { PcmPlayer } from "../audio/pcm-player";
import { base64ToPcm16, mergePcm16Chunks, pcm16ToBase64 } from "../audio/pcm-utils";
import { getBoundSharedMediaStream } from "../realtime-audio-bridge";

export type QwenOmniAudioStreamOptions = {
  sendProviderMessage: (message: unknown) => void;
  onBargeIn?: () => void;
  existingStream?: MediaStream;
};

export class QwenOmniAudioStream {
  private readonly sendProviderMessage: (message: unknown) => void;
  private readonly player: PcmPlayer;
  private pcmBuffer: Int16Array[] = [];
  private appendTimer: ReturnType<typeof setInterval> | null = null;
  private micHandle: Awaited<ReturnType<typeof startMicCapture>> | null = null;
  private sharedStream: MediaStream | null = null;
  private uplinkEnabled = true;
  private readonly noiseGatePeak = resolveNoiseGatePeak();
  private readonly bargeInDetector: BargeInDetector | null;

  constructor(options: QwenOmniAudioStreamOptions) {
    this.sendProviderMessage = options.sendProviderMessage;
    this.player = new PcmPlayer(OUTPUT_SAMPLE_RATE);
    this.sharedStream = options.existingStream ?? null;
    this.bargeInDetector = options.onBargeIn
      ? new BargeInDetector(options.onBargeIn)
      : null;
  }

  async start(existingStream?: MediaStream): Promise<MediaStream> {
    await this.player.init();

    this.micHandle = await startMicCapture({
      existingStream:
        existingStream ?? this.sharedStream ?? getBoundSharedMediaStream() ?? undefined,
      onPcmChunk: (chunk) => {
        if (!this.uplinkEnabled) {
          this.bargeInDetector?.observePcm16(chunk);
          return;
        }

        this.pcmBuffer.push(chunk);
      },
    });

    this.sharedStream = this.micHandle.stream;
    this.appendTimer = setInterval(() => {
      this.flushBuffer();
    }, INPUT_APPEND_INTERVAL_MS);

    return this.micHandle.stream;
  }

  getSharedStream(): MediaStream | null {
    return this.sharedStream;
  }

  handleAudioDelta(base64Pcm: string): void {
    const pcm = base64ToPcm16(base64Pcm);
    this.player.enqueue(pcm);
  }

  setUplinkEnabled(enabled: boolean): void {
    this.uplinkEnabled = enabled;
    if (!enabled) {
      this.discardUplinkBuffer();
      this.bargeInDetector?.reset();
      return;
    }

    this.bargeInDetector?.reset();
  }

  isUplinkEnabled(): boolean {
    return this.uplinkEnabled;
  }

  discardUplinkBuffer(): void {
    this.pcmBuffer = [];
  }

  getPlaybackIdleDelayMs(): number {
    return this.player.getMsUntilPlaybackIdle();
  }

  async interrupt(): Promise<void> {
    await this.player.interrupt();
    this.setUplinkEnabled(true);
  }

  async stop(): Promise<void> {
    if (this.appendTimer) {
      clearInterval(this.appendTimer);
      this.appendTimer = null;
    }

    this.flushBuffer();

    if (this.micHandle) {
      await this.micHandle.stop();
      this.micHandle = null;
    }

    await this.player.dispose();
    this.pcmBuffer = [];
    this.sharedStream = null;
  }

  private flushBuffer(): void {
    if (!this.uplinkEnabled) {
      this.discardUplinkBuffer();
      return;
    }

    if (this.pcmBuffer.length === 0) {
      return;
    }

    const merged = mergePcm16Chunks(this.pcmBuffer);
    this.pcmBuffer = [];

    if (!passesNoiseGate(merged, this.noiseGatePeak)) {
      return;
    }

    const audio = pcm16ToBase64(merged);
    recordAudioAppend(merged.byteLength);
    this.sendProviderMessage({
      type: "input_audio_buffer.append",
      audio,
    });
  }
}
