import https from "node:https";
import axios, { type AxiosInstance } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

function buildClient(): AxiosInstance {
  const host = process.env["PROXY_HOST"];
  const port = Number(process.env["PROXY_PORT"]);
  const username = process.env["PROXY_USERNAME"];
  const password = process.env["PROXY_PASSWORD"];
  const protocol = process.env["PROXY_PROTOCOL"] ?? "http";

  const hasProxy = !!host && !!port;

  if (hasProxy) {
    // Use HttpsProxyAgent directly — mirrors the working axios example exactly.
    // proxy: false tells axios not to intercept; the agent handles the CONNECT tunnel.
    // rejectUnauthorized: false matches the user's httpsAgent({ rejectUnauthorized: false }).
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
