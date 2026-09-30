import { describe, it, expect } from "vitest";
import { NO_ID, personKey } from "./person.js";

describe("personKey", () => {
  it("keys by id when a real id is present", () => {
    expect(personKey({ id: "123", firstName: "א", lastName: "ב" })).toBe("id:123");
  });

  it("keys by normalized full name when id is NO_ID", () => {
    expect(personKey({ id: NO_ID, firstName: " משה ", lastName: " לוי " })).toBe("name:משה|לוי");
  });

  it("treats an empty id the same as NO_ID (falls back to name)", () => {
    expect(personKey({ id: "", firstName: "דוד", lastName: "כהן" })).toBe("name:דוד|כהן");
  });

  it("lowercases and trims both name parts independently", () => {
    const a = personKey({ id: NO_ID, firstName: "ABC", lastName: "XYZ" });
    const b = personKey({ id: NO_ID, firstName: "abc", lastName: "xyz" });
    expect(a).toBe(b);
  });
});
