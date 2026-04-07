import { BACKEND_URL } from "../constants";
import { logger } from "../utils/logger";

const STORAGE_KEY = "barricade_auth";

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.accessToken) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {string} path - e.g. "/api/orders/"
 * @param {{ method?: string, body?: object, token?: string }} opts
 */
export async function apiFetch(path, opts = {}) {
  const { method = "GET", body, token } = opts;
  const auth = token ?? getStoredAuth()?.accessToken;
  if (!BACKEND_URL) {
    throw new Error("VITE_BACKEND_URL is not set");
  }
  const url = `${BACKEND_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth) {
    headers.Authorization = `Bearer ${auth}`;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) {
    return null;
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }
  if (res.status === 401 && auth) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("barricade:session-expired"));
    logger.warn("apiFetch 401 — session cleared");
  }
  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      (Array.isArray(data?.detail) ? data.detail.map((d) => d.msg || d).join(", ") : null) ||
      res.statusText;
    logger.warn("apiFetch failed", res.status, msg);
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}
