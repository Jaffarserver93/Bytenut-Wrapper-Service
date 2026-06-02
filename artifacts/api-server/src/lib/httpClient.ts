import https from "node:https";
import axios, { type AxiosInstance } from "axios";

function buildClient(): AxiosInstance {
  const host = process.env["PROXY_HOST"];
  const port = Number(process.env["PROXY_PORT"]);
  const username = process.env["PROXY_USERNAME"];
  const password = process.env["PROXY_PASSWORD"];

  const hasProxy = !!host && !!port;

  return axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    ...(hasProxy
      ? {
          proxy: {
            protocol: "https",
            host,
            port,
            ...(username && password
              ? { auth: { username, password } }
              : {}),
          },
        }
      : {}),
    timeout: 30000,
  });
}

export const httpClient: AxiosInstance = buildClient();
