import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiRequest, setAuthErrorHandler, API_URL } from "./api.js";
import { STORAGE_KEY } from "../lib/authStorage.js";

const reply = (body) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

describe("apiRequest", () => {
  beforeEach(() => localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "tok" })));
  afterEach(() => { vi.unstubAllGlobals(); setAuthErrorHandler(() => {}); });

  it("posts text/plain JSON with the stored token injected", async () => {
    const fetchMock = reply({ success: true });
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest("saveAssignment", { id: 1 }, { isWriteAction: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(API_URL);
    expect(init.headers["Content-Type"]).toBe("text/plain;charset=utf-8");
    expect(JSON.parse(init.body)).toEqual({ action: "saveAssignment", token: "tok", isWriteAction: true, id: 1 });
  });

  it("calls the auth-error handler and throws when the server flags isAuthError", async () => {
    vi.stubGlobal("fetch", reply({ success: false, isAuthError: true, message: "expired" }));
    const handler = vi.fn();
    setAuthErrorHandler(handler);
    await expect(apiRequest("x")).rejects.toThrow("expired");
    expect(handler).toHaveBeenCalledOnce();
  });
});
