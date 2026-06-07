import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IFLYTEK_ISE_PROVIDER_NAME, IFLYTEK_ISE_SAMPLE_RATE } from "@/providers/iflytek-ise";

const mkdtemp = vi.fn();
const writeFile = vi.fn();
const readFile = vi.fn();
const rm = vi.fn();
const spawn = vi.fn();

vi.mock("node:fs/promises", () => ({
  mkdtemp,
  writeFile,
  readFile,
  rm,
}));

vi.mock("node:child_process", () => ({
  spawn,
}));

describe("prepareIflytekIse16kPcmAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdtemp.mockResolvedValue("/tmp/talkforge-pronunciation-test");
    writeFile.mockResolvedValue(undefined);
    rm.mockResolvedValue(undefined);
  });

  it("converts uploaded audio to mono PCM at 16 kHz", async () => {
    const pcmOutput = Buffer.alloc(6400);
    readFile.mockResolvedValue(pcmOutput);

    const stderr = new EventEmitter();
    const ffmpegProcess = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
    };
    ffmpegProcess.stderr = stderr;

    spawn.mockImplementation((_cmd, args) => {
      expect(args).toEqual(
        expect.arrayContaining([
          "-ar",
          String(IFLYTEK_ISE_SAMPLE_RATE),
          "-ac",
          "1",
          "-f",
          "s16le",
        ]),
      );

      queueMicrotask(() => {
        ffmpegProcess.emit("close", 0);
      });

      return ffmpegProcess;
    });

    const { prepareIflytekIse16kPcmAudio } = await import(
      "@/server/pronunciation/audio-prepare"
    );

    const result = await prepareIflytekIse16kPcmAudio({
      body: Buffer.from("fake-webm"),
      objectKey: "audio/session/turn.webm",
    });

    expect(result).toBe(pcmOutput);
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/input\.webm$/),
      Buffer.from("fake-webm"),
    );
    expect(readFile).toHaveBeenCalledWith(expect.stringMatching(/output\.pcm$/));
    expect(rm).toHaveBeenCalledWith("/tmp/talkforge-pronunciation-test", {
      recursive: true,
      force: true,
    });
  });

  it("maps missing ffmpeg to a configuration error", async () => {
    const stderr = new EventEmitter();
    const ffmpegProcess = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
    };
    ffmpegProcess.stderr = stderr;

    spawn.mockImplementation(() => {
      queueMicrotask(() => {
        ffmpegProcess.emit("error", Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" }));
      });
      return ffmpegProcess;
    });

    const { prepareIflytekIse16kPcmAudio } = await import(
      "@/server/pronunciation/audio-prepare"
    );

    await expect(
      prepareIflytekIse16kPcmAudio({
        body: Buffer.from("fake-webm"),
        objectKey: "audio/session/turn.webm",
      }),
    ).rejects.toMatchObject({
      provider: IFLYTEK_ISE_PROVIDER_NAME,
      code: "configuration",
      retryable: false,
      message: expect.stringContaining("ffmpeg is required"),
    });

    expect(rm).toHaveBeenCalled();
  });

  it("maps ffmpeg conversion failures to invalid_request errors", async () => {
    const stderr = new EventEmitter();
    const ffmpegProcess = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
    };
    ffmpegProcess.stderr = stderr;

    spawn.mockImplementation(() => {
      queueMicrotask(() => {
        stderr.emit("data", Buffer.from("Invalid data found when processing input"));
        ffmpegProcess.emit("close", 1);
      });
      return ffmpegProcess;
    });

    const { prepareIflytekIse16kPcmAudio } = await import(
      "@/server/pronunciation/audio-prepare"
    );

    await expect(
      prepareIflytekIse16kPcmAudio({
        body: Buffer.from("fake-webm"),
        objectKey: "audio/session/turn.webm",
      }),
    ).rejects.toMatchObject({
      provider: IFLYTEK_ISE_PROVIDER_NAME,
      code: "invalid_request",
      retryable: false,
      message: expect.stringContaining("Invalid data found"),
    });
  });
});
