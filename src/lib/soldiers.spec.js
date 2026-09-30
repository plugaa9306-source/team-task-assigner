import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/api.js", () => ({ getSoldiers: vi.fn() }));
import { getSoldiers } from "../services/api.js";
import { extractSoldiers, normalizeSoldier, loadSoldiers, clearSoldiers, useSoldiers, unitOf } from "./soldiers.js";

const row = { personalId: 123, firstName: "דוד", lastName: "כהן", phone: "050", unit: "מחלקה 1", tabName: "t1" };

describe("normalizeSoldier / extractSoldiers", () => {
  it("maps personalId to id and falls back to NO_ID", () => {
    expect(normalizeSoldier(row).id).toBe("123");
    expect(normalizeSoldier({ firstName: "א", lastName: "ב" }).id).toBe('ללא מ"א');
  });

  it("accepts an array, {soldiers} or {data} and drops nameless rows", () => {
    expect(extractSoldiers([row, {}])).toHaveLength(1);
    expect(extractSoldiers({ soldiers: [row] })).toHaveLength(1);
    expect(extractSoldiers({ data: [row] })).toHaveLength(1);
  });

  it("throws the server message on an unexpected payload", () => {
    expect(() => extractSoldiers({ success: false, message: "nope" })).toThrow("nope");
  });

  it("unitOf prefers unit over tabName", () => {
    expect(unitOf({ unit: "u", tabName: "t" })).toBe("u");
    expect(unitOf({ unit: "", tabName: "t" })).toBe("t");
  });
});

describe("loadSoldiers", () => {
  beforeEach(() => { clearSoldiers(); getSoldiers.mockReset(); });

  it("loads, caches, and exposes units", async () => {
    getSoldiers.mockResolvedValue({ soldiers: [row, { ...row, personalId: 2, unit: "מחלקה 2" }] });
    await loadSoldiers();
    await loadSoldiers();
    expect(getSoldiers).toHaveBeenCalledTimes(1);
    const s = useSoldiers();
    expect(s.soldiersList.value).toHaveLength(2);
    expect(s.units.value).toEqual(["מחלקה 1", "מחלקה 2"]);
    await loadSoldiers({ force: true });
    expect(getSoldiers).toHaveBeenCalledTimes(2);
  });

  it("surfaces a { success: false } reply as the error message", async () => {
    getSoldiers.mockResolvedValue({ success: false, error: "Missing token", isAuthError: true });
    await loadSoldiers();
    expect(useSoldiers().error.value).toBe("Missing token");
  });

  it("captures errors without throwing", async () => {
    getSoldiers.mockRejectedValue(new Error("expired"));
    await loadSoldiers();
    const s = useSoldiers();
    expect(s.error.value).toBe("expired");
    expect(s.isLoading.value).toBe(false);
  });
});

describe("persistent cache", () => {
  beforeEach(() => { clearSoldiers(); getSoldiers.mockReset(); });

  it("writes the list to localStorage and clearSoldiers removes it", async () => {
    getSoldiers.mockResolvedValue([row]);
    await loadSoldiers();
    expect(JSON.parse(localStorage.getItem("team_app_soldiers"))).toHaveLength(1);
    clearSoldiers();
    expect(localStorage.getItem("team_app_soldiers")).toBeNull();
  });

  it("a fresh module load reuses the stored list without fetching", async () => {
    localStorage.setItem("team_app_soldiers", JSON.stringify([normalizeSoldier(row)]));
    vi.resetModules();
    const fresh = await import("./soldiers.js");
    await fresh.loadSoldiers();
    expect(getSoldiers).not.toHaveBeenCalled();
    expect(fresh.useSoldiers().soldiersList.value).toHaveLength(1);
  });
});
