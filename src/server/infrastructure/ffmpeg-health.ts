import { spawn } from "node:child_process";

import type { InfrastructureCheckResult } from "./health";

export type FfmpegHealthResult = InfrastructureCheckResult & {
  skipped?: boolean;
};

export type FfmpegHealthProbe = {
  version(): Promise<void>;
};

const DEFAULT_FFMPEG_TIMEOUT_MS = 5_000;
const DEFAULT_FFMPEG_COMMAND = "ffmpeg";

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} health check timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function createFfmpegHealthProbe(
  command: string = DEFAULT_FFMPEG_COMMAND,
): FfmpegHealthProbe {
  return {
    version() {
      return new Promise((resolve, reject) => {
        const child = spawn(command, ["-version"], { windowsHide: true });
        let settled = false;

        const finish = (callback: () => void) => {
          if (!settled) {
            settled = true;
            callback();
          }
        };

        child.on("error", (error) => {
          finish(() => reject(error));
        });

        child.on("close", (code) => {
          if (code === 0) {
            finish(() => resolve());
            return;
          }

          finish(() =>
            reject(new Error(`ffmpeg exited with code ${code ?? "unknown"}.`)),
          );
        });
      });
    },
  };
}

export async function checkFfmpegHealth(options?: {
  required?: boolean;
  probe?: FfmpegHealthProbe;
  timeoutMs?: number;
}): Promise<FfmpegHealthResult> {
  const required = options?.required ?? false;

  if (!required) {
    return {
      ok: true,
      skipped: true,
      message: "ffmpeg is not required for the current ASR configuration.",
    };
  }

  const startedAt = Date.now();
  const probe = options?.probe ?? createFfmpegHealthProbe();

  try {
    await withTimeout(
      probe.version(),
      options?.timeoutMs ?? DEFAULT_FFMPEG_TIMEOUT_MS,
      "ffmpeg",
    );

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "ffmpeg health check failed. Install ffmpeg and ensure it is on PATH.",
      latencyMs: Date.now() - startedAt,
    };
  }
}
