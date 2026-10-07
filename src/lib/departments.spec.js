import { describe, it, expect } from "vitest";
import { normalizeDepartment, updatableUnits } from "./departments.js";

const units = ["מחלקה 1", "מחלקה 2", "מחלקה 11", 'חפ"ק'];

describe("normalizeDepartment", () => {
  it("ignores spaces, quote styles and case but keeps different numbers apart", () => {
    expect(normalizeDepartment("מחלקה1")).toBe(normalizeDepartment(" מחלקה   1 "));
    expect(normalizeDepartment('חפ"ק')).toBe(normalizeDepartment("חפ״ק"));
    expect(normalizeDepartment("Alpha")).toBe(normalizeDepartment("ALPHA"));
    expect(normalizeDepartment("מחלקה 1")).not.toBe(normalizeDepartment("מחלקה 11"));
  });
});

describe("updatableUnits", () => {
  it("null (TRUE in the sheet) or no info leaves every unit", () => {
    expect(updatableUnits(units, { canUpdate1: true, updateDepartments: null })).toEqual(units);
    expect(updatableUnits(units)).toEqual(units);
  });

  it("a list keeps only the listed units, matched loosely", () => {
    expect(updatableUnits(units, { canUpdate1: true, updateDepartments: ["מחלקה1"] })).toEqual(["מחלקה 1"]);
    expect(updatableUnits(units, { canUpdate1: true, updateDepartments: ["מחלקה 2", "חפ״ק"] })).toEqual(["מחלקה 2", 'חפ"ק']);
    expect(updatableUnits(units, { canUpdate1: true, updateDepartments: ["אחר"] })).toEqual([]);
  });

  it("no update access (FALSE / empty) leaves nothing", () => {
    expect(updatableUnits(units, { canUpdate1: false, updateDepartments: [] })).toEqual([]);
    expect(updatableUnits(units, { canUpdate1: false, updateDepartments: null })).toEqual([]);
  });
});
