import { describe, it, expect } from "vitest";
import { normalizeText, searchSoldiers } from "./soldierSearch.js";

const list = [
  { id: "7158852", idNum: "012345678", firstName: "שלמה", lastName: "קליסקי", unit: "מחלקה 1", tabName: "" },
  { id: "1111111", idNum: "", firstName: "דוד", lastName: "כהן", unit: "", tabName: "חפ\"ק" },
  { id: 'ללא מ"א', idNum: "", firstName: "משה", lastName: "לוי", unit: "", tabName: "" },
];

describe("normalizeText", () => {
  it("folds final letters, quotes and whitespace", () => {
    expect(normalizeText("  שלומך   ")).toBe("שלומכ");
    expect(normalizeText('מ"א')).toBe("מא");
  });
});

describe("searchSoldiers", () => {
  it("finds by name in either word order and ignores final-letter typing", () => {
    expect(searchSoldiers(list, "שלמה קליסקי")).toHaveLength(1);
    expect(searchSoldiers(list, "קליסקי שלמה")).toHaveLength(1);
    expect(searchSoldiers(list, "כהן")[0].firstName).toBe("דוד");
    expect(searchSoldiers(list, "שלמה קליסקי").length).toBe(1);
  });

  it("finds by personal ID and national ID", () => {
    expect(searchSoldiers(list, "7158852")[0].lastName).toBe("קליסקי");
    expect(searchSoldiers(list, "012345678")[0].lastName).toBe("קליסקי");
    expect(searchSoldiers(list, "1111")[0].lastName).toBe("כהן");
  });

  it("never matches the placeholder id and returns [] for empty or unknown queries", () => {
    expect(searchSoldiers(list, "")).toEqual([]);
    expect(searchSoldiers(list, "9999999")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(searchSoldiers(list, "ל", 1)).toHaveLength(1);
  });
});
