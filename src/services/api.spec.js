import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiCall, setAuthErrorHandler, API_URL } from "./api.js";
import { STORAGE_KEY } from "../lib/authStorage.js";

const reply = (body) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

describe("apiCall", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { vi.unstubAllGlobals(); setAuthErrorHandler(() => {}); });

  it("sends login without a token, even when none is stored", async () => {
    const fetchMock = reply({ success: true, token: "t" });
    vi.stubGlobal("fetch", fetchMock);
    await apiCall("login", { code: "1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(API_URL);
    expect(init.headers).toEqual({ "Content-Type": "text/plain;charset=utf-8" });
    expect(JSON.parse(init.body)).toEqual({ action: "login", code: "1" });
  });

  it("injects the stored token into protected actions", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "tok" }));
    const fetchMock = reply({ success: true });
    vi.stubGlobal("fetch", fetchMock);
    await apiCall("getSoldiers");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "getSoldiers", token: "tok" });
  });

  it("returns an auth error without a network request when the token is missing", async () => {
    const fetchMock = reply({});
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    expect(await apiCall("getSoldiers")).toEqual({ success: false, error: "Missing token", isAuthError: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledOnce();
  });

  it("triggers the auth handler when the server flags isAuthError on a protected action", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "tok" }));
    vi.stubGlobal("fetch", reply({ success: false, isAuthError: true, error: "expired" }));
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    expect((await apiCall("getSoldiers")).error).toBe("expired");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not trigger the auth handler for a failed login", async () => {
    vi.stubGlobal("fetch", reply({ success: false, isAuthError: true, error: "bad" }));
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    await apiCall("login", { code: "x" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("catches network errors and invalid JSON without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await apiCall("login", { code: "x" })).toMatchObject({ success: false, isNetworkError: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError("bad"); } }));
    expect(await apiCall("login", { code: "x" })).toMatchObject({ success: false, error: "תשובה לא תקינה מהשרת" });
  });
});

describe("apiCall permission-removed errors", () => {
  afterEach(() => { vi.unstubAllGlobals(); setAuthErrorHandler(() => {}); });

  it("treats a 'הוסרו' error as an auth error", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "tok" }));
    vi.stubGlobal("fetch", reply({ success: false, error: "ההרשאות שלך הוסרו" }));
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    expect((await apiCall("getSoldiers")).isAuthError).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });
});
