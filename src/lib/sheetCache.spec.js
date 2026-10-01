import { describe, it, expect, vi, beforeEach } from "vitest";
import { cachedSheetList, clearSheetCache } from "./sheetCache.js";

describe("sheet list cache", () => {
  beforeEach(() => localStorage.clear());

  it("fetches once, stores the list, then serves it from localStorage", async () => {
    const fetcher = vi.fn().mockResolvedValue(["סיור בוקר", "כרמל"]);
    expect(await cachedSheetList("missions", fetcher)).toEqual(["סיור בוקר", "כרמל"]);
    expect(JSON.parse(localStorage.getItem("team_app_missions"))).toEqual(["סיור בוקר", "כרמל"]);
    expect(await cachedSheetList("missions", fetcher)).toEqual(["סיור בוקר", "כרמל"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps missions and roles separate", async () => {
    await cachedSheetList("missions", async () => ["m"]);
    expect(await cachedSheetList("roles", async () => ["r"])).toEqual(["r"]);
  });

  it("does not cache an empty list and lets fetch errors through", async () => {
    await cachedSheetList("roles", async () => []);
    expect(localStorage.getItem("team_app_roles")).toBeNull();
    await expect(cachedSheetList("roles", async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  });

  it("ignores malformed cache contents and clears on request", async () => {
    localStorage.setItem("team_app_missions", "{nope");
    expect(await cachedSheetList("missions", async () => ["x"])).toEqual(["x"]);
    clearSheetCache();
    expect(localStorage.getItem("team_app_missions")).toBeNull();
  });
});
