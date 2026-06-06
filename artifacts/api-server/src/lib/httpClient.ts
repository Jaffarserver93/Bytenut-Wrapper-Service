import https from "node:https";
import axios, { type AxiosInstance } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

const BYTENUT_BASE_URL = "https://www.bytenut.com";

/**
 * Headers that Bytenut's game-panel API requires.
 * Without Origin/Referer the server returns 403 (treats request as cross-origin/non-browser).
 */
export const BYTENUT_BROWSER_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Origin: BYTENUT_BASE_URL,
  Referer: `${BYTENUT_BASE_URL}/`,
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
};

function buildClient(): AxiosInstance {
  const host = process.env["PROXY_HOST"];
  const port = Number(process.env["PROXY_PORT"]);
  const username = process.env["PROXY_USERNAME"];
  const password = process.env["PROXY_PASSWORD"];
  const protocol = process.env["PROXY_PROTOCOL"] ?? "http";

  const hasProxy = !!host && !!port;

  if (hasProxy) {
    const auth =
      username && password
        ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
        : "";
    const proxyUrl = `${protocol}://${auth}${host}:${port}`;
    const agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });

    return axios.create({
      httpsAgent: agent,
      proxy: false,
      timeout: 30000,
    });
  }

  return axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 30000,
  });
}

export const httpClient: AxiosInstance = buildClient();
