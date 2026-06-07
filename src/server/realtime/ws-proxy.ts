import { createServer, type IncomingMessage } from "http";
import { parse as parseUrl } from "url";

import WebSocket, { WebSocketServer } from "ws";

import {
  buildQwenOmniRealtimeEndpoint,
  resolveQwenOmniEndpoints,
} from "@/providers/qwen-omni";

const DEFAULT_PROXY_PORT = 3002;

function sanitizeWebSocketCloseCode(code: number): number {
  // 1005/1006 are reserved and must not be sent in a close frame.
  if (code === 1005 || code === 1006 || code < 1000 || code > 4999) {
    return 1000;
  }

  return code;
}

type ProxyRuntime = {
  server: ReturnType<typeof createServer>;
  wss: WebSocketServer;
  port: number;
};

let proxyRuntime: ProxyRuntime | undefined;

function parseBearerTokenFromProtocols(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }

  const parts = headerValue.split(",").map((part) => part.trim());
  const bearerIndex = parts.findIndex((part) => part === "Bearer");
  if (bearerIndex === -1) {
    return null;
  }

  return parts[bearerIndex + 1] ?? null;
}

function resolveUpstreamRealtimeUrl(model: string): string {
  const apiBaseUrl =
    process.env.REALTIME_BASE_URL?.trim() || "https://dashscope.aliyuncs.com";
  const endpoints = resolveQwenOmniEndpoints(apiBaseUrl);
  return buildQwenOmniRealtimeEndpoint(endpoints, model);
}

function handleProxyConnection(clientWs: WebSocket, request: IncomingMessage): void {
  const requestUrl = parseUrl(request.url ?? "", true);
  const model = typeof requestUrl.query.model === "string" ? requestUrl.query.model : null;

  if (!model) {
    console.warn("[talkforge:realtime-proxy] rejected connection without model query param");
    clientWs.close(1008, "model query parameter is required");
    return;
  }

  const token = parseBearerTokenFromProtocols(request.headers["sec-websocket-protocol"]);
  if (!token) {
    console.warn("[talkforge:realtime-proxy] rejected connection without bearer token");
    clientWs.close(1008, "bearer token is required");
    return;
  }

  const upstreamUrl = resolveUpstreamRealtimeUrl(model);
  console.info(
    `[talkforge:realtime-proxy] client connected model=${model} upstream=${upstreamUrl}`,
  );

  const pendingClientMessages: Array<{ data: WebSocket.RawData; isBinary: boolean }> = [];
  let upstreamReady = false;

  const upstreamWs = new WebSocket(upstreamUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const forwardClientToUpstream = (data: WebSocket.RawData, isBinary: boolean) => {
    if (upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.send(data, { binary: isBinary });
    }
  };

  clientWs.on("message", (data, isBinary) => {
    if (!upstreamReady) {
      pendingClientMessages.push({ data, isBinary });
      return;
    }

    forwardClientToUpstream(data, isBinary);
  });

  upstreamWs.on("open", () => {
    console.info(`[talkforge:realtime-proxy] upstream open model=${model}`);
    upstreamReady = true;

    for (const message of pendingClientMessages) {
      forwardClientToUpstream(message.data, message.isBinary);
    }
    pendingClientMessages.length = 0;
  });

  upstreamWs.on("message", (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });

  clientWs.on("close", (code, reason) => {
    console.info(
      `[talkforge:realtime-proxy] client closed model=${model} code=${code} reason=${reason.toString()}`,
    );
    if (upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.close(sanitizeWebSocketCloseCode(code), reason.toString());
    }
  });

  upstreamWs.on("close", (code, reason) => {
    console.info(
      `[talkforge:realtime-proxy] upstream closed model=${model} code=${code} reason=${reason.toString()}`,
    );
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(sanitizeWebSocketCloseCode(code), reason.toString());
    }
  });

  clientWs.on("error", (error) => {
    console.warn(
      `[talkforge:realtime-proxy] client error model=${model}:`,
      error instanceof Error ? error.message : error,
    );
    upstreamWs.close(1011, "client socket error");
  });

  upstreamWs.on("error", (error) => {
    console.warn(
      `[talkforge:realtime-proxy] upstream handshake failed model=${model}:`,
      error instanceof Error ? error.message : error,
    );
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, "upstream handshake failed");
    }
  });
}

export function shouldStartRealtimeWebSocketProxy(): boolean {
  const provider = process.env.REALTIME_PROVIDER?.trim() ?? "mock";
  if (provider !== "qwen-omni") {
    return false;
  }

  return process.env.REALTIME_PROXY_ENABLED !== "false";
}

export function resolveRealtimeProxyPort(): number {
  const raw = process.env.REALTIME_PROXY_PORT?.trim();
  if (!raw) {
    return DEFAULT_PROXY_PORT;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PROXY_PORT;
}

export function maybeStartRealtimeWebSocketProxy(): ProxyRuntime | undefined {
  if (!shouldStartRealtimeWebSocketProxy()) {
    return undefined;
  }

  if (proxyRuntime) {
    return proxyRuntime;
  }

  const port = resolveRealtimeProxyPort();
  const server = createServer((_request, response) => {
    response.writeHead(426, { "Content-Type": "text/plain" });
    response.end("TalkForge realtime proxy expects a WebSocket upgrade.");
  });

  const wss = new WebSocketServer({ server, path: "/realtime" });
  wss.on("connection", handleProxyConnection);

  server.listen(port, () => {
    console.info(
      `[talkforge:realtime-proxy] listening on ws://localhost:${port}/realtime`,
    );
  });

  server.on("error", (error) => {
    const errno = (error as NodeJS.ErrnoException).code;
    if (errno === "EADDRINUSE") {
      console.info(
        `[talkforge:realtime-proxy] port ${port} is already in use; assuming another proxy instance is running.`,
      );
      return;
    }

    console.error("[talkforge:realtime-proxy] server error:", error);
  });

  proxyRuntime = { server, wss, port };
  return proxyRuntime;
}

export function stopRealtimeWebSocketProxyForTests(): void {
  if (!proxyRuntime) {
    return;
  }

  proxyRuntime.wss.close();
  proxyRuntime.server.close();
  proxyRuntime = undefined;
}
