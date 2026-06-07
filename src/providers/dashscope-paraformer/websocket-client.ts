import { randomUUID } from "node:crypto";

import WebSocket from "ws";

import { createProviderError } from "@/providers/errors";
import type { ProviderCallContext } from "@/providers/runtime";

import {
  buildDashScopeInferenceWebSocketUrl,
  DASHSCOPE_PARAFORMER_PROVIDER_NAME,
  PARAFORMER_8K_SAMPLE_RATE,
  PARAFORMER_PCM_CHUNK_BYTES,
  type DashScopeParaformerProviderConfig,
} from "./config";
import type {
  DashScopeParaformerResultGeneratedEvent,
  DashScopeParaformerServerEvent,
  DashScopeParaformerSentence,
  DashScopeParaformerTranscriptionResult,
} from "./types";

export type TranscribeDashScopeParaformerAudioInput = {
  pcmAudio: Buffer;
  language?: "en";
  wordTimestamps?: boolean;
  context?: ProviderCallContext;
};

function mapDashScopeErrorCode(errorCode?: string, errorMessage?: string) {
  const message = errorMessage?.toLowerCase() ?? "";
  const code = errorCode?.toLowerCase() ?? "";

  if (code.includes("auth") || message.includes("api key") || message.includes("unauthorized")) {
    return "authentication" as const;
  }
  if (message.includes("timeout")) {
    return "timeout" as const;
  }
  if (message.includes("rate") || message.includes("throttl")) {
    return "rate_limited" as const;
  }
  if (message.includes("invalid")) {
    return "invalid_request" as const;
  }
  return "provider_unavailable" as const;
}

function parseServerEvent(raw: WebSocket.RawData): DashScopeParaformerServerEvent | null {
  const text = typeof raw === "string" ? raw : raw.toString("utf8");

  try {
    return JSON.parse(text) as DashScopeParaformerServerEvent;
  } catch {
    return null;
  }
}

function buildRunTaskMessage(taskId: string, model: string) {
  return {
    header: {
      action: "run-task",
      task_id: taskId,
      streaming: "duplex",
    },
    payload: {
      task_group: "audio",
      task: "asr",
      function: "recognition",
      model,
      parameters: {
        format: "pcm",
        sample_rate: PARAFORMER_8K_SAMPLE_RATE,
        semantic_punctuation_enabled: false,
      },
      input: {},
    },
  };
}

function buildFinishTaskMessage(taskId: string) {
  return {
    header: {
      action: "finish-task",
      task_id: taskId,
      streaming: "duplex",
    },
    payload: {
      input: {},
    },
  };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new Error("Aborted"));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Aborted"));
      },
      { once: true },
    );
  });
}

async function streamPcmAudio(
  socket: WebSocket,
  pcmAudio: Buffer,
  signal?: AbortSignal,
): Promise<void> {
  for (let offset = 0; offset < pcmAudio.length; offset += PARAFORMER_PCM_CHUNK_BYTES) {
    if (signal?.aborted) {
      throw signal.reason ?? new Error("Aborted");
    }

    const chunk = pcmAudio.subarray(offset, offset + PARAFORMER_PCM_CHUNK_BYTES);
    socket.send(chunk);
    await wait(100, signal);
  }
}

export async function transcribeDashScopeParaformerAudio(
  config: DashScopeParaformerProviderConfig,
  input: TranscribeDashScopeParaformerAudioInput,
): Promise<DashScopeParaformerTranscriptionResult> {
  const taskId = randomUUID();
  const websocketUrl = buildDashScopeInferenceWebSocketUrl(config.apiBaseUrl);
  const sentences: DashScopeParaformerSentence[] = [];
  let durationSec: number | undefined;

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(websocketUrl, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "X-DashScope-DataInspection": "enable",
      },
    });

    let taskStarted = false;
    let finished = false;

    const cleanup = (error?: unknown) => {
      if (finished) {
        return;
      }
      finished = true;
      input.context?.signal?.removeEventListener("abort", onAbort);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      if (error) {
        reject(error);
      }
    };

    const onAbort = () => {
      cleanup(
        createProviderError({
          provider: DASHSCOPE_PARAFORMER_PROVIDER_NAME,
          code: "timeout",
          message: "DashScope Paraformer transcription was aborted.",
        }),
      );
    };

    input.context?.signal?.addEventListener("abort", onAbort, { once: true });

    socket.on("error", (error) => {
      cleanup(
        createProviderError({
          provider: DASHSCOPE_PARAFORMER_PROVIDER_NAME,
          code: "provider_unavailable",
          message: error.message || "DashScope Paraformer WebSocket connection failed.",
          cause: error,
        }),
      );
    });

    socket.on("message", async (raw) => {
      const event = parseServerEvent(raw);
      if (!event) {
        return;
      }

      switch (event.header.event) {
        case "task-started":
          if (taskStarted) {
            return;
          }
          taskStarted = true;
          try {
            await streamPcmAudio(socket, input.pcmAudio, input.context?.signal);
            socket.send(JSON.stringify(buildFinishTaskMessage(taskId)));
          } catch (error) {
            cleanup(error);
          }
          return;
        case "result-generated": {
          const generated = event as DashScopeParaformerResultGeneratedEvent;
          sentences.push(generated.payload.output.sentence);
          if (generated.payload.usage?.duration !== undefined) {
            durationSec = generated.payload.usage.duration;
          }
          return;
        }
        case "task-failed":
          cleanup(
            createProviderError({
              provider: DASHSCOPE_PARAFORMER_PROVIDER_NAME,
              code: mapDashScopeErrorCode(
                event.header.error_code,
                event.header.error_message,
              ),
              message:
                event.header.error_message ??
                "DashScope Paraformer transcription task failed.",
              metadata: {
                errorCode: event.header.error_code,
              },
            }),
          );
          return;
        case "task-finished":
          finished = true;
          input.context?.signal?.removeEventListener("abort", onAbort);
          socket.close();
          resolve({
            sentences,
            durationSec,
          });
          return;
        default:
          return;
      }
    });

    socket.on("open", () => {
      socket.send(JSON.stringify(buildRunTaskMessage(taskId, config.model)));
    });

    socket.on("close", () => {
      if (!finished) {
        cleanup(
          createProviderError({
            provider: DASHSCOPE_PARAFORMER_PROVIDER_NAME,
            code: "provider_unavailable",
            message: "DashScope Paraformer WebSocket closed before the task finished.",
          }),
        );
      }
    });
  });
}
