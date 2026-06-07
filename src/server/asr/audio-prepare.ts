import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createProviderError } from "@/providers/errors";
import {
  DASHSCOPE_PARAFORMER_PROVIDER_NAME,
  PARAFORMER_8K_SAMPLE_RATE,
} from "@/providers/dashscope-paraformer";

export type PrepareParaformerAudioInput = {
  body: Buffer;
  objectKey: string;
};

function resolveInputExtension(objectKey: string): string {
  const match = objectKey.match(/(\.[a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? ".webm";
}

function runFfmpeg(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-ar",
        String(PARAFORMER_8K_SAMPLE_RATE),
        "-ac",
        "1",
        "-f",
        "s16le",
        "-acodec",
        "pcm_s16le",
        outputPath,
      ],
      {
        windowsHide: true,
      },
    );

    let stderr = "";
    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    process.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          createProviderError({
            provider: DASHSCOPE_PARAFORMER_PROVIDER_NAME,
            code: "configuration",
            message:
              "ffmpeg is required to convert turn audio for paraformer-realtime-8k-v2. Install ffmpeg and ensure it is on PATH.",
            retryable: false,
            cause: error,
          }),
        );
        return;
      }

      reject(error);
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        createProviderError({
          provider: DASHSCOPE_PARAFORMER_PROVIDER_NAME,
          code: "invalid_request",
          message:
            stderr.trim() ||
            `ffmpeg failed to convert audio for DashScope Paraformer (exit code ${code ?? "unknown"}).`,
          retryable: false,
        }),
      );
    });
  });
}

export async function prepareParaformer8kPcmAudio(
  input: PrepareParaformerAudioInput,
): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "talkforge-asr-"));
  const extension = resolveInputExtension(input.objectKey);
  const inputPath = path.join(tempDir, `input${extension}`);
  const outputPath = path.join(tempDir, "output.pcm");

  try {
    await writeFile(inputPath, input.body);
    await runFfmpeg(inputPath, outputPath);
    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
