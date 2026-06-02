export const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function getExtensionInfo(username: string, password: string, serverId: string) {
  const res = await fetch(`${API_BASE}/api/v1/user/extension-info/${serverId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Failed to fetch extension info");
  return res.json();
}

export async function extendServer(username: string, password: string, serverId: string) {
  const res = await fetch(`${API_BASE}/api/v1/user/extend/${serverId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Failed to extend server");
  return res.json();
}

export async function getAutoExtendConfig(username: string, password: string, serverId: string) {
  const res = await fetch(`${API_BASE}/api/v1/user/auto-extend/${serverId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Failed to get auto-extend config");
  return res.json();
}

export async function setAutoExtendConfig(
  username: string,
  password: string,
  serverId: string,
  enabled: boolean,
  thresholdMinutes: number,
) {
  const res = await fetch(`${API_BASE}/api/v1/user/auto-extend/${serverId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, enabled, thresholdMinutes }),
  });
  if (!res.ok) throw new Error("Failed to set auto-extend config");
  return res.json();
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

export async function getProfile(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/v1/user/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function getServers(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/v1/user/servers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Failed to fetch servers");
  return res.json();
}
