import { describe, expect, it, vi } from "vitest";

import { DEFAULT_TTS_VOICE } from "@/providers/tts/cache-key";
import {
  buildDashScopeCosyVoiceSynthesisUrl,
  synthesizeDashScopeCosyVoiceAudio,
} from "@/providers/dashscope-cosyvoice";
import { parseWavMetadata } from "@/shared/wav-metadata";

function createMinimalWavBuffer(options?: {
  sampleRate?: number;
  dataBytes?: number;
}): Buffer {
  const sampleRate = options?.sampleRate ?? 24000;
  const dataBytes = options?.dataBytes ?? 4800;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);

  return buffer;
}

describe("buildDashScopeCosyVoiceSynthesisUrl", () => {
  it("targets the CosyVoice HTTP SpeechSynthesizer endpoint", () => {
    expect(buildDashScopeCosyVoiceSynthesisUrl("https://dashscope.aliyuncs.com")).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer",
    );
  });
});

describe("synthesizeDashScopeCosyVoiceAudio", () => {
  it("posts non-streaming CosyVoice requests and downloads wav audio", async () => {
    const wav = createMinimalWavBuffer();
    const audioUrl = "https://example.com/cosyvoice.wav";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

      if (url === audioUrl) {
        return new Response(wav, { status: 200 });
      }

      expect(url).toBe(
        "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer",
      );
      expect(init?.method).toBe("POST");

      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        model: "cosyvoice-v3-flash",
        input: {
          text: "Could I get a medium latte?",
          voice: "longanyang",
          format: "wav",
          sample_rate: 24000,
          rate: 1,
          language_hints: ["en"],
        },
      });

      return new Response(
        JSON.stringify({
          output: {
            finish_reason: "stop",
            audio: {
              url: audioUrl,
            },
          },
        }),
        { status: 200 },
      );
    });

    const result = await synthesizeDashScopeCosyVoiceAudio(
      {
        apiKey: "test-key",
        apiBaseUrl: "https://dashscope.aliyuncs.com",
        model: "cosyvoice-v3-flash",
        defaultVoice: DEFAULT_TTS_VOICE,
        sampleRate: 24000,
      },
      {
        text: "Could I get a medium latte?",
        voice: "longanyang",
        speed: 1,
        language: "en",
      },
    );

    expect(result.format).toBe("wav");
    expect(result.sampleRate).toBe(24000);
    expect(parseWavMetadata(result.audioBody)?.sampleRate).toBe(24000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockRestore();
  });

  it("maps HTTP auth failures to provider errors", async () => {
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
          model: "cosyvoice-v3-flash",
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
