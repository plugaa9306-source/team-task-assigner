import { reactive, computed } from "vue";
import { loginRequest } from "../services/api.js";
import { STORAGE_KEY } from "./authStorage.js";
import { clearSoldiers } from "./soldiers.js";
import { clearDraft } from "./report1Draft.js";
import { clearReportOptions } from "./reportOptionsCache.js";
import { clearSheetCache } from "./sheetCache.js";

export { STORAGE_KEY };

const state = reactive({ token: "", role: "", canEdit: false, canReport1: false, isLoading: false });

export const isAuthenticated = computed(() => Boolean(state.token));

function readStored() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && typeof data.token === "string" && data.token) return data;
  } catch {
    // unreadable or malformed storage counts as logged out
  }
  return null;
}

function apply({ token = "", role = "", canEdit = false, canReport1 = false } = {}) {
  state.token = token;
  state.role = role;
  state.canEdit = Boolean(canEdit);
  state.canReport1 = Boolean(canReport1);
}

// Restore a saved session (call once on startup).
export function hydrate() {
  apply(readStored() ?? undefined);
}

// Resolves { ok: true } or { ok: false, error }.
export async function login(passcode) {
  state.isLoading = true;
  try {
    const data = await loginRequest(passcode);
    if (!data.success) return { ok: false, error: data.error || data.message || "קוד שגוי" };
    const session = {
      token: data.token,
      role: data.role,
      canEdit: Boolean(data.canEdit),
      canReport1: Boolean(data.canReport1),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // session still works in memory if storage is blocked
    }
    apply(session);
    clearSoldiers(); // a new login always refetches the soldiers list
    clearDraft(); // and never inherits another user's unsaved report
    return { ok: true };
  } finally {
    state.isLoading = false;
  }
}

export function logout() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  apply();
  clearSoldiers();
  clearDraft();
  clearReportOptions(); // options and sheet lists are emptied on logout only (not on login)
  clearSheetCache();
}

export function useAuth() {
  return {
    state,
    isAuthenticated,
    role: computed(() => state.role),
    canEdit: computed(() => state.canEdit),
    canReport1: computed(() => state.canReport1),
    token: computed(() => state.token),
    isLoading: computed(() => state.isLoading),
    login,
    logout,
  };
}
