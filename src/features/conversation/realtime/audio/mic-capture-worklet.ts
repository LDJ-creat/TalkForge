/** Inline AudioWorklet module — batches frames before posting to the main thread. */
export const MIC_CAPTURE_WORKLET_SOURCE = `
class TalkForgeMicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frameSize = 4096;
    this._buffer = new Float32Array(this._frameSize);
    this._offset = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input || input.length === 0) {
      return true;
    }

    for (let index = 0; index < input.length; index += 1) {
      this._buffer[this._offset] = input[index];
      this._offset += 1;

      if (this._offset >= this._frameSize) {
        this.port.postMessage(this._buffer.slice(0, this._frameSize));
        this._offset = 0;
      }
    }

    return true;
  }
}
registerProcessor("talkforge-mic-processor", TalkForgeMicProcessor);
`;
