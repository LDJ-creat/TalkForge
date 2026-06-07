import { INPUT_SAMPLE_RATE } from "./constants";
import {
  computePeakLevel,
  recordCaptureSampleRate,
  recordMicChunk,
  recordMicContextState,
  recordMicTrack,
} from "./audio-diagnostics";
import {
  applyMicInputGain,
  resolveMicInputGain,
  resolveMicProcessingConstraints,
} from "./mic-processing";
import { float32ToPcm16, resampleLinear } from "./pcm-utils";
import { MIC_CAPTURE_WORKLET_SOURCE } from "./mic-capture-worklet";

export type MicCaptureOptions = {
  onPcmChunk: (pcm16: Int16Array) => void;
  existingStream?: MediaStream;
};

export type MicCaptureHandle = {
  stream: MediaStream;
  stop: () => Promise<void>;
};

async function ensureAudioContextRunning(audioContext: AudioContext): Promise<void> {
  recordMicContextState(audioContext.state);
  if (audioContext.state === "suspended") {
    await audioContext.resume();
    recordMicContextState(audioContext.state);
  }
}

function supportsAudioWorklet(audioContext: AudioContext): boolean {
  return typeof audioContext.audioWorklet?.addModule === "function";
}

async function registerMicWorklet(audioContext: AudioContext): Promise<void> {
  const url = URL.createObjectURL(
    new Blob([MIC_CAPTURE_WORKLET_SOURCE], { type: "application/javascript" }),
  );

  try {
    await audioContext.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function processFloatChunk(
  input: Float32Array,
  inputRate: number,
  inputGain: number,
  onPcmChunk: (pcm16: Int16Array) => void,
): void {
  const resampled =
    inputRate === INPUT_SAMPLE_RATE
      ? input
      : resampleLinear(input, inputRate, INPUT_SAMPLE_RATE);
  const boosted = applyMicInputGain(resampled, inputGain);

  recordMicChunk(computePeakLevel(boosted));
  onPcmChunk(float32ToPcm16(boosted));
}

async function startWorkletCapture(
  audioContext: AudioContext,
  stream: MediaStream,
  inputGain: number,
  onPcmChunk: (pcm16: Int16Array) => void,
): Promise<{ stopNodes: () => void }> {
  await registerMicWorklet(audioContext);

  const source = audioContext.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(audioContext, "talkforge-mic-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
    if (!(event.data instanceof Float32Array) || event.data.length === 0) {
      return;
    }

    processFloatChunk(event.data, audioContext.sampleRate, inputGain, onPcmChunk);
  };

  source.connect(workletNode);
  workletNode.connect(silentGain);
  silentGain.connect(audioContext.destination);

  return {
    stopNodes: () => {
      workletNode.port.onmessage = null;
      workletNode.disconnect();
      source.disconnect();
      silentGain.disconnect();
    },
  };
}

function startScriptProcessorCapture(
  audioContext: AudioContext,
  stream: MediaStream,
  inputGain: number,
  onPcmChunk: (pcm16: Int16Array) => void,
): { stopNodes: () => void } {
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(2048, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    processFloatChunk(input, audioContext.sampleRate, inputGain, onPcmChunk);
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  return {
    stopNodes: () => {
      processor.onaudioprocess = null;
      processor.disconnect();
      source.disconnect();
      silentGain.disconnect();
    },
  };
}

export async function startMicCapture(options: MicCaptureOptions): Promise<MicCaptureHandle> {
  const ownsStream = !options.existingStream;
  const processing = resolveMicProcessingConstraints();
  const inputGain = resolveMicInputGain();
  const stream =
    options.existingStream ??
    (await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        ...processing,
      },
    }));

  const track = stream.getAudioTracks()[0];
  if (track) {
    recordMicTrack(track, inputGain);
  }

  const audioContext = new AudioContext();
  await ensureAudioContextRunning(audioContext);
  recordCaptureSampleRate(audioContext.sampleRate);

  const capture = supportsAudioWorklet(audioContext)
    ? await startWorkletCapture(audioContext, stream, inputGain, options.onPcmChunk)
    : startScriptProcessorCapture(audioContext, stream, inputGain, options.onPcmChunk);

  if (supportsAudioWorklet(audioContext)) {
    recordMicContextState("worklet");
  }

  return {
    stream,
    stop: async () => {
      capture.stopNodes();
      await audioContext.close();

      if (ownsStream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    },
  };
}
