import WebSocket from "ws";

import { createProviderError } from "@/providers/errors";
import type { ProviderCallContext } from "@/providers/runtime";

import { buildIflytekIseAuthUrl } from "./auth";
import {
  IFLYTEK_ISE_PCM_CHUNK_BYTES,
  IFLYTEK_ISE_PROVIDER_NAME,
  type IflytekIseProviderConfig,
} from "./config";
import { buildIflytekIseReferenceText } from "./normalize";
import type { IflytekIseEvaluationResponse } from "./types";

export type EvaluateIflytekIseShadowingInput = {
  pcmAudio: Buffer;
  referenceText: string;
  context?: ProviderCallContext;
};

function sendJson(socket: WebSocket, payload: unknown) {
  socket.send(JSON.stringify(payload));
}

export async function evaluateIflytekIseShadowingAudio(
  config: IflytekIseProviderConfig,
  input: EvaluateIflytekIseShadowingInput,
): Promise<IflytekIseEvaluationResponse> {
  if (!input.referenceText.trim()) {
    throw createProviderError({
      provider: IFLYTEK_ISE_PROVIDER_NAME,
      code: "invalid_request",
      message: "Shadowing evaluation requires referenceText.",
      retryable: false,
    });
  }

  if (input.pcmAudio.length === 0) {
    throw createProviderError({
      provider: IFLYTEK_ISE_PROVIDER_NAME,
      code: "invalid_request",
      message: "Shadowing evaluation requires non-empty audio.",
      retryable: false,
    });
  }

  const authUrl = buildIflytekIseAuthUrl({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    wsBaseUrl: config.wsBaseUrl,
  });

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(authUrl);
    let settled = false;

    const finish = (error?: unknown, response?: IflytekIseEvaluationResponse) => {
      if (settled) {
        return;
      }
      settled = true;

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }

      if (error) {
        reject(error);
        return;
      }

      if (!response) {
        reject(
          createProviderError({
            provider: IFLYTEK_ISE_PROVIDER_NAME,
            code: "provider_unavailable",
            message: "iFlytek ISE closed before returning an evaluation result.",
            retryable: true,
          }),
        );
        return;
      }

      resolve(response);
    };

    const abortHandler = () => {
      finish(
        createProviderError({
          provider: IFLYTEK_ISE_PROVIDER_NAME,
          code: "timeout",
          message: "iFlytek ISE evaluation was aborted.",
          retryable: true,
        }),
      );
    };

    if (input.context?.signal) {
      if (input.context.signal.aborted) {
        abortHandler();
        return;
      }
      input.context.signal.addEventListener("abort", abortHandler, { once: true });
    }

    socket.on("error", (error) => {
      finish(
        createProviderError({
          provider: IFLYTEK_ISE_PROVIDER_NAME,
          code: "provider_unavailable",
          message:
            error instanceof Error
              ? error.message
              : "iFlytek ISE WebSocket connection failed.",
          retryable: true,
          cause: error,
        }),
      );
    });

    socket.on("message", (raw) => {
      let parsed: IflytekIseEvaluationResponse;
      try {
        parsed = JSON.parse(raw.toString()) as IflytekIseEvaluationResponse;
      } catch (error) {
        finish(
          createProviderError({
            provider: IFLYTEK_ISE_PROVIDER_NAME,
            code: "provider_unavailable",
            message: "iFlytek ISE returned malformed JSON.",
            retryable: false,
            cause: error,
          }),
        );
        return;
      }

      if (parsed.code !== 0) {
        finish(
          createProviderError({
            provider: IFLYTEK_ISE_PROVIDER_NAME,
            code: "provider_unavailable",
            message: parsed.message || "iFlytek ISE evaluation failed.",
            retryable: parsed.code === 10114 || parsed.code === 10160,
            metadata: {
              providerCode: parsed.code,
              sid: parsed.sid,
            },
          }),
        );
        return;
      }

      if (parsed.data?.status === 2) {
        finish(undefined, parsed);
      }
    });

    socket.on("open", () => {
      sendJson(socket, {
        common: {
          app_id: config.appId,
        },
        business: {
          sub: "ise",
          ent: "en_vip",
          category: "read_sentence",
          cmd: "ssb",
          text: buildIflytekIseReferenceText(input.referenceText),
          tte: "utf-8",
          ttp_skip: true,
          rst: "entirety",
          ise_unite: "1",
          extra_ability: "multi_dimension",
          aue: "raw",
        },
        data: {
          status: 0,
          encoding: "raw",
        },
      });

      let offset = 0;
      let sentAny = false;
      while (offset < input.pcmAudio.length) {
        const chunk = input.pcmAudio.subarray(
          offset,
          offset + IFLYTEK_ISE_PCM_CHUNK_BYTES,
        );
        offset += chunk.length;
        const isFirst = !sentAny;
        sentAny = true;
        const isLast = offset >= input.pcmAudio.length;

        sendJson(socket, {
          business: {
            cmd: "auw",
            aus: isFirst ? 1 : isLast ? 4 : 2,
          },
          data: {
            status: isLast ? 2 : 1,
            encoding: "raw",
            data_type: 1,
            data: chunk.toString("base64"),
          },
        });
      }
    });

    socket.on("close", () => {
      if (!settled) {
        finish(
          createProviderError({
            provider: IFLYTEK_ISE_PROVIDER_NAME,
            code: "provider_unavailable",
            message: "iFlytek ISE WebSocket closed before evaluation completed.",
            retryable: true,
          }),
        );
      }
    });
  });
}
