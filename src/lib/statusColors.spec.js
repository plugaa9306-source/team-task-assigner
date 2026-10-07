import { describe, it, expect } from "vitest";
import { mapHebrewColorToCss, statusStyle } from "./statusColors.js";

describe("mapHebrewColorToCss", () => {
  it("maps the Hebrew color names", () => {
    expect(mapHebrewColorToCss("אדום")).toEqual({ bg: "#FEE2E2", text: "#991B1B", border: "#DC2626" });
    expect(mapHebrewColorToCss("בורדו")).toMatchObject({ text: "#7A0019", border: "#9B1C31" });
    expect(mapHebrewColorToCss(" ירוק ").bg).toBe("#DCFCE7");
    for (const c of ["צהוב", "תכלת", "כחול", "כתום", "אפור"]) expect(mapHebrewColorToCss(c).bg).toMatch(/^#/);
  });

  it("falls back to a neutral color for unknown or missing names", () => {
    const neutral = { bg: "#F3F4F6", text: "#1F2937", border: "#E5E7EB" };
    expect(mapHebrewColorToCss("סגול")).toEqual(neutral);
    expect(mapHebrewColorToCss(undefined)).toEqual(neutral);
    expect(mapHebrewColorToCss("")).toEqual(neutral);
  });

  it("builds an inline style", () => {
    expect(statusStyle("אדום")).toEqual({ color: "#991B1B", borderColor: "#DC2626" });
  });
});
