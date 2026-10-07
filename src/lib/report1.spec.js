import { describe, it, expect } from "vitest";
import {
  computeStats, buildSummary, buildSyncPayload, formatSyncDate, rowKey, todayISO, formatDate, normalizeOptions, statusesFromData, statusLabel, REPORT_TYPES,
} from "./report1.js";

const A = { id: "1", firstName: "דוד", lastName: "כהן", unit: "מחלקה 1", tabName: "" };
const B = { id: "2", firstName: "משה", lastName: "לוי", unit: "מחלקה 1", tabName: "" };
const C = { id: "3", firstName: "יוסי", lastName: "בר", unit: "מחלקה 1", tabName: "" };
const all = [A, B, C];

const DATA = {
  report1: [
    { name: "שוחרר", code: "ש", color: "אפור" }, { name: "נפקד", code: "נ", color: "אדום" }, { name: "במוצב", code: "מ", color: "ירוק" },
    { name: "בבית", code: "ב", color: "כתום" }, { name: 'בחו"ל', code: "ח", color: "בורדו" },
  ],
  arrivalForecast: [
    { name: "שוחרר", code: "ש" }, { name: "נפקד", code: "נ" }, { name: "מגיע", code: "מ" }, { name: "בבדיקה", code: "ב" },
  ],
};
const R1 = statusesFromData(DATA, "report1");
const ARR = statusesFromData(DATA, "arrival");

describe("options from the server", () => {
  it("maps each report type to its own list, code as key and name as label", () => {
    expect(REPORT_TYPES.map((t) => t.label)).toEqual(['דו"ח 1', "צפי הגעה"]);
    expect(R1.map((s) => s.label)).toEqual(["שוחרר", "נפקד", "במוצב", "בבית", 'בחו"ל']);
    expect(ARR.map((s) => s.label)).toEqual(["שוחרר", "נפקד", "מגיע", "בבדיקה"]);
    expect(R1[2]).toEqual({ key: "מ", label: "במוצב", color: "ירוק" });
    expect(R1[4].color).toBe("בורדו");
    expect(statusLabel(ARR, "מ")).toBe("מגיע");
    expect(statusLabel(R1, "מ")).toBe("במוצב");
  });

  it("accepts alternative field names, plain strings and other payload shapes", () => {
    expect(normalizeOptions([{ label: "א", value: "1" }, "ב"])).toEqual([{ key: "1", label: "א", color: "" }, { key: "ב", label: "ב", color: "" }]);
    expect(statusesFromData({ options: { report1: [{ name: "א", code: "1" }] } }, "report1")).toEqual([{ key: "1", label: "א", color: "" }]);
    expect(statusesFromData({ arrival_forecast: [{ name: "ב", code: "2" }] }, "arrival")).toEqual([{ key: "2", label: "ב", color: "" }]);
  });

  it("drops blank names and duplicate codes, uses the name when there is no code, and tolerates missing data", () => {
    expect(normalizeOptions([{ name: "א", code: "a" }, { name: "ב", code: "a" }, { name: "", code: "c" }, { name: "ד" }, null])).toEqual([{ key: "a", label: "א", color: "" }, { key: "ד", label: "ד", color: "" }]);
    expect(statusesFromData(undefined, "report1")).toEqual([]);
    expect(normalizeOptions("nope")).toEqual([]);
  });
});

describe("computeStats", () => {
  it("counts per option and treats missing entries as unreported", () => {
    const entries = { [rowKey(A)]: { status: "מ", note: "" }, [rowKey(B)]: { status: "ב", note: "" } };
    const s = computeStats(all, entries, R1);
    expect(s).toMatchObject({ total: 3, unreported: 1 });
    expect(s.byStatus).toEqual({ ש: 0, נ: 0, מ: 1, ב: 1, ח: 0 });
  });

  it("a code that is not among this report's options counts as unreported", () => {
    expect(computeStats([A], { [rowKey(A)]: { status: "ח", note: "" } }, ARR).unreported).toBe(1);
  });
});

describe("buildSummary", () => {
  it("lists a line per soldier, then the general status", () => {
    const entries = {
      [rowKey(A)]: { status: "מ", note: "" },
      [rowKey(B)]: { status: "ב", note: "חוזר ביום ב" },
    };
    const lines = buildSummary(all, entries, "report1", "2026-10-01", "מחלקה 1", R1).split("\n");
    expect(lines[0]).toBe('📋 *דו"ח 1 – מחלקה 1 – 01.10.2026*');
    expect(lines).toContain("• דוד כהן - במוצב");
    expect(lines).toContain("• משה לוי - בבית (חוזר ביום ב)");
    expect(lines).toContain("• יוסי בר - לא דווח");
    const at = lines.indexOf("*סיכום כללי*");
    expect(at).toBeGreaterThan(lines.indexOf("• יוסי בר - לא דווח"));
    expect(lines.slice(at + 1)).toEqual(['סה"כ: 3', "• במוצב: 1", "• בבית: 1", "• לא דווח: 1"]);
  });

  it("uses the arrival options and title", () => {
    const text = buildSummary([A], { [rowKey(A)]: { status: "מ", note: "08:30" } }, "arrival", "2026-10-02", "מחלקה 1", ARR);
    expect(text).toContain("צפי הגעה – מחלקה 1 – 02.10.2026");
    expect(text).toContain("• דוד כהן - מגיע (08:30)");
    expect(text).toContain("• מגיע: 1");
  });
});

describe("dates", () => {
  it("formats dates", () => {
    expect(todayISO(new Date(2026, 9, 1))).toBe("2026-10-01");
    expect(formatDate("2026-10-01")).toBe("01.10.2026");
  });
});

describe("buildSyncPayload", () => {
  it("builds the sheet payload with option codes, the dd/mm/yyyy date and only reported soldiers", () => {
    const entries = { [rowKey(A)]: { status: "מ", note: "x" }, [rowKey(B)]: { status: "ב", note: "" } };
    expect(buildSyncPayload(all, entries, "report1", "2026-10-03", "מחלקה 1")).toEqual({
      reportType: "דוח 1",
      department: "מחלקה 1",
      date: "03/10/2026",
      reports: [
        { firstName: "דוד", lastName: "כהן", status: "מ", note: "x" },   // the note travels with the report
        { firstName: "משה", lastName: "לוי", status: "ב", note: "" },    // an empty note is sent too (it clears the old one)
      ],
    });
  });

  it("uses the arrival forecast name and formats dates", () => {
    expect(buildSyncPayload([A], { [rowKey(A)]: { status: "ש", note: "" } }, "arrival", "2026-12-01", "מחלקה 1").reportType).toBe("צפי הגעה");
    expect(formatSyncDate("2026-10-03")).toBe("03/10/2026");
  });
});
