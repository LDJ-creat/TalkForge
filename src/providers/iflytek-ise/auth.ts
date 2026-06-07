import { createHmac } from "node:crypto";

export function buildIflytekIseAuthUrl(options: {
  apiKey: string;
  apiSecret: string;
  wsBaseUrl: string;
}): string {
  const url = new URL(options.wsBaseUrl);
  const host = url.host;
  const path = url.pathname || "/v2/ise";
  const date = new Date().toUTCString();

  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = createHmac("sha256", options.apiSecret)
    .update(signatureOrigin)
    .digest("base64");

  const authorizationOrigin =
    `api_key="${options.apiKey}", algorithm="hmac-sha256", ` +
    `headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin, "utf8").toString("base64");

  url.searchParams.set("authorization", authorization);
  url.searchParams.set("date", date);
  url.searchParams.set("host", host);

  return url.toString();
}
