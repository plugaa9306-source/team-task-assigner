import { STORAGE_KEY } from "../lib/authStorage.js";

export const API_URL =
  "https://script.google.com/macros/s/AKfycbzsSSfbdpmpQZS_bK3wHsN3eIB1l4KJreRxky7v6zCqwDOGYvEsbP317m3ONFMJ09r5/exec";

let onAuthError = () => {};

// Called when the server rejects the session (expired, revoked, or no edit rights).
export function setAuthErrorHandler(handler) {
  onAuthError = handler;
}

export function getStoredToken() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY))?.token || "";
  } catch {
    return "";
  }
}

// text/plain keeps this a "simple" CORS request (no preflight), which Apps Script requires.
export async function post(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Authenticated call: injects the stored token and handles auth failures globally.
// Pass isWriteAction: true for operations that modify data (the server requires canEdit for them).
export async function apiRequest(action, params = {}, { isWriteAction = false } = {}) {
  const data = await post({ action, token: getStoredToken(), isWriteAction, ...params });
  if (data?.isAuthError) {
    onAuthError(data);
    throw new Error(data.message || "Not authorized");
  }
  return data;
}
