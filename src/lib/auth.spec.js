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
    expect(fetchMock).toHaveBeenCalledWith(AUTH_URL, expect.objectContaining({ method: "POST", body: '{"action":"login","code":"1234"}' }));
    const auth = useAuth();
    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.role.value).toBe("Viewer");
    expect(auth.canEdit.value).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({ token: "abc", role: "Viewer", canEdit: false, canReport1: false });
  });

  it("returns the server error and stays logged out on failure", async () => {
    vi.stubGlobal("fetch", reply({ success: false, error: "Invalid passcode" }));
    expect(await login("x")).toEqual({ ok: false, error: "Invalid passcode" });
    expect(useAuth().isAuthenticated.value).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("reports a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
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

describe("soldiers cache and auth", () => {
  it("login and logout both clear the cached soldiers list", async () => {
    localStorage.setItem("team_app_soldiers", "[]");
    vi.stubGlobal("fetch", reply({ success: true, token: "t", role: "Viewer", canEdit: false }));
    await login("1");
    expect(localStorage.getItem("team_app_soldiers")).toBeNull();
    localStorage.setItem("team_app_soldiers", "[]");
    logout();
    expect(localStorage.getItem("team_app_soldiers")).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("canReport1", () => {
  beforeEach(() => { localStorage.clear(); logout(); });
  afterEach(() => vi.unstubAllGlobals());

  it("stores canReport1 with the session and hydrates it", async () => {
    vi.stubGlobal("fetch", reply({ success: true, token: "t", role: "Manager", canEdit: true, canReport1: true }));
    await login("1");
    expect(useAuth().canReport1.value).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).canReport1).toBe(true);
    logout();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", canReport1: true }));
    hydrate();
    expect(useAuth().canReport1.value).toBe(true);
  });
});

describe("report options cache and auth", () => {
  it("logout clears the cached report options, login keeps them", async () => {
    localStorage.setItem("team_app_report_options", "{}");
    localStorage.setItem("team_app_missions", '["a"]');
    localStorage.setItem("team_app_roles", '["b"]');
    vi.stubGlobal("fetch", reply({ success: true, token: "t", role: "Viewer", canEdit: false }));
    await login("1");
    expect(localStorage.getItem("team_app_report_options")).toBe("{}");
    expect(localStorage.getItem("team_app_missions")).toBe('["a"]');
    logout();
    expect(localStorage.getItem("team_app_report_options")).toBeNull();
    expect(localStorage.getItem("team_app_missions")).toBeNull();
    expect(localStorage.getItem("team_app_roles")).toBeNull();
    vi.unstubAllGlobals();
  });
});
