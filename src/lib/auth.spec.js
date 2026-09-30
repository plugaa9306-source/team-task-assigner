import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAuth, hydrate, login, logout, STORAGE_KEY } from "./auth.js";
import { API_URL as AUTH_URL } from "../services/api.js";

const reply = (body, ok = true) => vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });

describe("auth", () => {
  beforeEach(() => { localStorage.clear(); logout(); });
  afterEach(() => vi.unstubAllGlobals());

  it("posts the passcode as JSON and stores the session on success", async () => {
    const fetchMock = reply({ success: true, token: "abc", role: "Viewer", canEdit: false });
    vi.stubGlobal("fetch", fetchMock);
    expect(await login("1234")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(AUTH_URL, expect.objectContaining({ method: "POST", body: '{"code":"1234"}' }));
    const auth = useAuth();
    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.role.value).toBe("Viewer");
    expect(auth.canEdit.value).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({ token: "abc", role: "Viewer", canEdit: false });
  });

  it("returns the server error and stays logged out on failure", async () => {
    vi.stubGlobal("fetch", reply({ success: false, error: "Invalid passcode" }));
    expect(await login("x")).toEqual({ ok: false, error: "Invalid passcode" });
    expect(useAuth().isAuthenticated.value).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("reports a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const r = await login("x");
    expect(r.ok).toBe(false);
    expect(useAuth().isLoading.value).toBe(false);
  });

  it("hydrates from localStorage and ignores malformed data", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", role: "Manager", canEdit: true }));
    hydrate();
    expect(useAuth().canEdit.value).toBe(true);
    localStorage.setItem(STORAGE_KEY, "{not json");
    hydrate();
    expect(useAuth().isAuthenticated.value).toBe(false);
  });

  it("logout clears storage and state", async () => {
    vi.stubGlobal("fetch", reply({ success: true, token: "abc", role: "Manager", canEdit: true }));
    await login("1");
    logout();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    const auth = useAuth();
    expect([auth.isAuthenticated.value, auth.role.value, auth.canEdit.value]).toEqual([false, "", false]);
  });
});
