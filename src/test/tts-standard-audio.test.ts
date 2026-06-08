import { describe, expect, it, vi } from "vitest";

import {
  buildTtsCacheKey,
  buildTtsObjectKeyFromCacheKey,
  DEFAULT_TTS_LANGUAGE,
  DEFAULT_TTS_SPEED,
  DEFAULT_TTS_VOICE,
  DASHSCOPE_COSYVOICE_PROVIDER_NAME,
} from "@/providers";
import {
  createDashScopeCosyVoiceTtsProvider,
  DEFAULT_DASHSCOPE_COSYVOICE_MODEL,
  synthesizeDashScopeCosyVoiceAudio,
} from "@/providers/dashscope-cosyvoice";
import { createMockStorageProvider } from "@/providers/mock/storage";
import { createMockTtsProvider } from "@/providers/mock/tts";
import { InMemoryStandardAudioMetadataRepository } from "@/server/tts/metadata-repository";
import { resolveStandardAudio } from "@/server/shadowing/standard-audio";
import { parseWavMetadata } from "@/shared/wav-metadata";

function createMinimalWavBuffer(options?: {
  sampleRate?: number;
  numChannels?: number;
  dataBytes?: number;
}): Buffer {
  const sampleRate = options?.sampleRate ?? 24000;
  const numChannels = options?.numChannels ?? 1;
  const bitsPerSample = 16;
  const dataBytes = options?.dataBytes ?? 4800;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28);
  buffer.writeUInt16LE((numChannels * bitsPerSample) / 8, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);

  return buffer;
}

describe("buildTtsCacheKey", () => {
  it("combines text, voice, speed, provider, and language with defaults", () => {
    expect(
      buildTtsCacheKey({
        text: "Could I get a medium latte?",
        provider: "mock-tts",
      }),
    ).toBe(
      `Could I get a medium latte?|${DEFAULT_TTS_VOICE}|${DEFAULT_TTS_SPEED}|mock-tts|${DEFAULT_TTS_LANGUAGE}`,
    );
  });

  it("uses explicit synthesis metadata when provided", () => {
    expect(
      buildTtsCacheKey({
        text: "That's all, thank you.",
        voice: "en-gb-neutral",
        speed: 0.9,
        language: "en",
        provider: DASHSCOPE_COSYVOICE_PROVIDER_NAME,
      }),
    ).toBe("That's all, thank you.|en-gb-neutral|0.9|cosyvoice|en");
  });

  it("derives stable object keys from cache keys", () => {
    const cacheKey = buildTtsCacheKey({
      text: "Can I have it iced?",
      provider: "mock-tts",
    });

    expect(buildTtsObjectKeyFromCacheKey(cacheKey)).toMatch(/^tts\/[a-z0-9]+\.wav$/);
  });
});

describe("parseWavMetadata", () => {
  it("extracts duration and sample rate from wav headers", () => {
    const wav = createMinimalWavBuffer({ sampleRate: 24000, dataBytes: 4800 });
    const metadata = parseWavMetadata(wav);

    expect(metadata?.sampleRate).toBe(24000);
    expect(metadata?.durationMs).toBe(100);
    expect(metadata?.codec).toBe("pcm_s16le");
  });
});

describe("DashScopeCosyVoiceTtsProvider", () => {
  it("uploads synthesized audio and reuses cached metadata on repeat requests", async () => {
    const metadataRepository = new InMemoryStandardAudioMetadataRepository();
    const storage = createMockStorageProvider();
    const wav = createMinimalWavBuffer();
    const synthesizeAudio = vi.fn(async () => ({
      audioBody: wav,
      format: "wav" as const,
      sampleRate: 24000,
      durationMs: 100,
    }));

    const provider = createDashScopeCosyVoiceTtsProvider({
      apiKey: "test-key",
      metadataRepository,
      objectExists: (objectKey) => storage.objectExists({ objectKey }),
      persistAudio: async ({ objectKey, body, contentType }) => {
        const exists = await storage.objectExists({ objectKey });
        if (!exists) {
          await storage.createUploadTarget({
            objectKey,
            contentType,
            sizeBytes: body.byteLength,
          });
        }
        await storage.writeUploadedObject({ objectKey, body, contentType });
      },
      synthesizeAudio,
    });

    const input = { text: "Could I get a medium latte?" };
    const first = await provider.synthesize(input);
    const second = await provider.synthesize(input);

    expect(synthesizeAudio).toHaveBeenCalledTimes(1);
    expect(first.objectKey).toBe(second.objectKey);
    expect(first.provider).toBe(DASHSCOPE_COSYVOICE_PROVIDER_NAME);
    expect(second.metadata?.cached).toBe(true);
    expect(await storage.objectExists({ objectKey: first.objectKey })).toBe(true);

    const stored = await metadataRepository.findByCacheKey(
      buildTtsCacheKey({
        text: input.text,
        voice: DEFAULT_TTS_VOICE,
        speed: DEFAULT_TTS_SPEED,
        language: DEFAULT_TTS_LANGUAGE,
        provider: DASHSCOPE_COSYVOICE_PROVIDER_NAME,
      }),
    );
    expect(stored?.objectKey).toBe(first.objectKey);
    expect(stored?.voice).toBe(DEFAULT_TTS_VOICE);
    expect(stored?.speed).toBe(DEFAULT_TTS_SPEED);
  });

  it("maps CosyVoice HTTP auth failures to provider errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "InvalidApiKey", message: "bad key" }), {
        status: 401,
      }),
    );

    await expect(
      synthesizeDashScopeCosyVoiceAudio(
        {
          apiKey: "bad",
          apiBaseUrl: "https://dashscope.aliyuncs.com",
          model: DEFAULT_DASHSCOPE_COSYVOICE_MODEL,
          defaultVoice: DEFAULT_TTS_VOICE,
          sampleRate: 24000,
        },
        {
          text: "Hello",
          voice: DEFAULT_TTS_VOICE,
          speed: 1,
          language: "en",
        },
      ),
    ).rejects.toMatchObject({
      code: "authentication",
    });

    fetchMock.mockRestore();
  });
});

describe("resolveStandardAudio", () => {
  it("links standard audio metadata to the TTS cache key", async () => {
    const ttsProvider = createMockTtsProvider();
    const standardAudio = await resolveStandardAudio(
      { text: "Can I have it iced?" },
      { ttsProvider },
    );

    expect(standardAudio.cacheKey).toBe(
      buildTtsCacheKey({
        text: "Can I have it iced?",
        voice: DEFAULT_TTS_VOICE,
        speed: DEFAULT_TTS_SPEED,
        language: DEFAULT_TTS_LANGUAGE,
        provider: "mock-tts",
      }),
    );
    expect(standardAudio.objectKey).toContain("tts/");
    expect(standardAudio.provider).toBe("mock-tts");
    expect(standardAudio.voice).toBe(DEFAULT_TTS_VOICE);
    expect(standardAudio.speed).toBe(DEFAULT_TTS_SPEED);
  });
});
