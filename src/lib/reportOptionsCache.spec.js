import { describe, it, expect, beforeEach } from "vitest";
import { loadReportOptions, saveReportOptions, clearReportOptions } from "./reportOptionsCache.js";

const OPTS = {
  report1: [{ key: "מ", label: "במוצב", color: "ירוק" }],
  arrivalForecast: [{ key: "מ", label: "מגיע", color: "צהוב" }],
};

describe("report options cache", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips and clears", () => {
    expect(loadReportOptions()).toBeNull();
    saveReportOptions(OPTS);
    expect(loadReportOptions()).toEqual(OPTS);
    clearReportOptions();
    expect(loadReportOptions()).toBeNull();
  });

  it("ignores malformed or empty cache contents", () => {
    localStorage.setItem("team_app_report_options", "{nope");
    expect(loadReportOptions()).toBeNull();
    localStorage.setItem("team_app_report_options", JSON.stringify({ report1: [], arrivalForecast: [] }));
    expect(loadReportOptions()).toBeNull();
    localStorage.setItem("team_app_report_options", JSON.stringify({ report1: [{ nope: 1 }], arrivalForecast: [] }));
    expect(loadReportOptions()).toBeNull();
  });
});
