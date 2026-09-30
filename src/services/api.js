import { STORAGE_KEY } from "../lib/authStorage.js";

export const API_URL =
  "https://script.google.com/macros/s/AKfycbzsSSfbdpmpQZS_bK3wHsN3eIB1l4KJreRxky7v6zCqwDOGYvEsbP317m3ONFMJ09r5/exec";

// Actions that run without a session token.
const PUBLIC_ACTIONS = new Set(["login"]);

let onAuthError = () => {};

// Called when a protected action is rejected (missing, expired or revoked token).
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

// Always resolves to { success, ... } and never throws.
// Protected actions get the stored token injected; with no token they fail locally (no network request).
export async function apiCall(action, params = {}) {
  const payload = { action, ...params };

  if (!PUBLIC_ACTIONS.has(action)) {
    const token = getStoredToken();
    if (!token) return authFailure({ success: false, error: "Missing token", isAuthError: true });
    payload.token = token;
  }

  let data;
  try {
    // text/plain keeps this a "simple" CORS request (no preflight), which Apps Script requires.
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { success: false, error: `שגיאת שרת (${res.status})`, isNetworkError: true };
    data = await res.json();
  } catch (err) {
    const parseError = err instanceof SyntaxError;
    return {
      success: false,
      error: parseError ? "תשובה לא תקינה מהשרת" : "שגיאת רשת, נסו שוב",
      isNetworkError: !parseError,
    };
  }

  if (!data || typeof data !== "object") return { success: false, error: "תשובה לא תקינה מהשרת" };
  return data.isAuthError && !PUBLIC_ACTIONS.has(action) ? authFailure(data) : data;
}

function authFailure(result) {
  onAuthError(result);
  return result;
}

export const loginRequest = (code) => apiCall("login", { code });
export const getSoldiers = () => apiCall("getSoldiers");
