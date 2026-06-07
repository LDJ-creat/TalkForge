import { pcm16ToFloat32 } from "./pcm-utils";

export class PcmPlayer {
  private readonly sampleRate: number;
  private audioContext: AudioContext | null = null;
  private nextStartTime = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  async init(): Promise<void> {
    if (this.audioContext) {
      return;
    }

    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    this.nextStartTime = this.audioContext.currentTime;
  }

  getMsUntilPlaybackIdle(): number {
    if (!this.audioContext) {
      return 0;
    }

    return Math.max(0, (this.nextStartTime - this.audioContext.currentTime) * 1000);
  }

  enqueue(pcm16: Int16Array): void {
    if (!this.audioContext || pcm16.length === 0) {
      return;
    }

    const float32 = pcm16ToFloat32(pcm16);
    const channel = new Float32Array(float32);
    const buffer = this.audioContext.createBuffer(1, channel.length, this.sampleRate);
    buffer.copyToChannel(channel, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const startAt = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
  }

  async interrupt(): Promise<void> {
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.nextStartTime = 0;
    await this.init();
  }

  async dispose(): Promise<void> {
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.nextStartTime = 0;
  }
}
