import { reactive, computed } from "vue";
import { getSoldiers } from "../services/api.js";
import { NO_ID } from "./person.js";

const CACHE_KEY = "team_app_soldiers";

function readCache() {
  try {
    const rows = JSON.parse(localStorage.getItem(CACHE_KEY));
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

function writeCache(rows) {
  try {
    if (rows) localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // storage blocked or full: the in-memory copy still works
  }
}

const cached = readCache();
const state = reactive({ list: cached ?? [], isLoading: false, error: "", loaded: Boolean(cached) });
let inFlight = null;

// Server schema -> the shape the UI uses (personalId becomes `id`).
export function normalizeSoldier(s) {
  return {
    id: String(s.personalId ?? "").trim() || NO_ID,
    firstName: String(s.firstName ?? "").trim(),
    lastName: String(s.lastName ?? "").trim(),
    idNum: String(s.idNum ?? "").trim(),
    phone: String(s.phone ?? "").trim(),
    unit: String(s.unit ?? "").trim(),
    tabName: String(s.tabName ?? "").trim(),
  };
}

// Accepts a bare array or an object holding it under `soldiers` / `data`.
export function extractSoldiers(data) {
  const rows = Array.isArray(data) ? data : data?.soldiers ?? data?.data;
  if (!Array.isArray(rows)) throw new Error(data?.error || data?.message || "תשובה לא צפויה מהשרת");
  return rows.map(normalizeSoldier).filter((s) => s.firstName || s.lastName);
}

export const unitOf = (s) => s.unit || s.tabName;

// The list is persisted in localStorage and only re-fetched after login/logout
// (both call clearSoldiers) or when { force: true } is passed.
export function loadSoldiers({ force = false } = {}) {
  if (inFlight) return inFlight;
  if (state.loaded && !force) return Promise.resolve();
  state.isLoading = true;
  state.error = "";
  inFlight = getSoldiers()
    .then((data) => {
      if (data?.success === false) throw new Error(data.error || data.message || "שגיאה בטעינת רשימת החיילים");
      state.list = extractSoldiers(data);
      state.loaded = true;
      writeCache(state.list);
    })
    .catch((err) => {
      state.error = err.message || "שגיאה בטעינת רשימת החיילים";
    })
    .finally(() => {
      state.isLoading = false;
      inFlight = null;
    });
  return inFlight;
}

export function clearSoldiers() {
  state.list = [];
  state.loaded = false;
  state.error = "";
  writeCache(null);
}

export function useSoldiers() {
  return {
    soldiersList: computed(() => state.list),
    isLoading: computed(() => state.isLoading),
    error: computed(() => state.error),
    units: computed(() => [...new Set(state.list.map(unitOf).filter(Boolean))]),
    load: loadSoldiers,
  };
}
