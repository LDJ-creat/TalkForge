export type ParsedWavMetadata = {
  sampleRate: number;
  durationMs: number;
  codec: "pcm_s16le";
};

export function parseWavMetadata(buffer: Buffer): ParsedWavMetadata | undefined {
  if (buffer.length < 44) {
    return undefined;
  }

  if (buffer.toString("ascii", 0, 4) !== "RIFF") {
    return undefined;
  }

  if (buffer.toString("ascii", 8, 12) !== "WAVE") {
    return undefined;
  }

  const numChannels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);

  if (
    numChannels <= 0 ||
    sampleRate <= 0 ||
    bitsPerSample <= 0 ||
    bitsPerSample % 8 !== 0
  ) {
    return undefined;
  }

  const dataSize = findWavDataChunkSize(buffer);
  if (dataSize === undefined) {
    return undefined;
  }

  const bytesPerSample = (bitsPerSample / 8) * numChannels;
  const durationMs = Math.round((dataSize / bytesPerSample / sampleRate) * 1000);

  return {
    sampleRate,
    durationMs: Math.max(durationMs, 1),
    codec: "pcm_s16le",
  };
}

function findWavDataChunkSize(buffer: Buffer): number | undefined {
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkId === "data") {
      return chunkSize;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  return undefined;
}
