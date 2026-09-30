import { reactive, computed } from "vue";
import { post } from "../services/api.js";
import { STORAGE_KEY } from "./authStorage.js";

export { STORAGE_KEY };

const state = reactive({ token: "", role: "", canEdit: false, isLoading: false });

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

function apply({ token = "", role = "", canEdit = false } = {}) {
  state.token = token;
  state.role = role;
  state.canEdit = Boolean(canEdit);
}

// Restore a saved session (call once on startup).
export function hydrate() {
  apply(readStored() ?? undefined);
}

// Resolves { ok: true } or { ok: false, error }.
export async function login(passcode) {
  state.isLoading = true;
  try {
    const data = await post({ code: passcode });
    if (!data.success) return { ok: false, error: data.error || data.message || "קוד שגוי" };
    const session = { token: data.token, role: data.role, canEdit: Boolean(data.canEdit) };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // session still works in memory if storage is blocked
    }
    apply(session);
    return { ok: true };
  } catch {
    return { ok: false, error: "שגיאת רשת, נסו שוב" };
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
}

export function useAuth() {
  return {
    state,
    isAuthenticated,
    role: computed(() => state.role),
    canEdit: computed(() => state.canEdit),
    token: computed(() => state.token),
    isLoading: computed(() => state.isLoading),
    login,
    logout,
  };
}
