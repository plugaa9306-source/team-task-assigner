import { describe, it, expect, beforeEach } from "vitest";
import { loadDraft, saveDraft, clearDraft } from "./report1Draft.js";

describe("report1 draft", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips the draft and never stores a date", () => {
    saveDraft({ type: "arrival", unit: "מחלקה 1", store: { "arrival|2026-10-02": { "id:1": { status: "arriving", note: "" } } } });
    const d = loadDraft();
    expect(d).toMatchObject({ type: "arrival", unit: "מחלקה 1" });
    expect(d.store["arrival|2026-10-02"]["id:1"].status).toBe("arriving");
    expect(Object.keys(JSON.parse(localStorage.getItem("team_app_report1")))).not.toContain("date");
  });

  it("returns an empty draft when missing or malformed, and clears", () => {
    expect(loadDraft()).toEqual({ type: "", unit: "", store: {} });
    localStorage.setItem("team_app_report1", "{nope");
    expect(loadDraft().store).toEqual({});
    saveDraft({ type: "report1", unit: "x", store: {} });
    clearDraft();
    expect(localStorage.getItem("team_app_report1")).toBeNull();
  });
});
