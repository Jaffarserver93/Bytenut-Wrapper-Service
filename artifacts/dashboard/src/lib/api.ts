export const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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
