import { describe, it, expect } from "vitest";
import { selectedNumbers, formatNumbers } from "./bulk.js";

describe("selectedNumbers", () => {
  it("converts Israeli numbers to international format without dashes, spaces or leading zeros", () => {
    expect(selectedNumbers([{ phone: "050-1234567" }])).toEqual(["972501234567"]);
    expect(selectedNumbers([{ phone: "054 397 5349" }, { phone: "+972 52-111-2222" }, { phone: "0097254 3333333" }])).toEqual([
      "972543975349", "972521112222", "972543333333",
    ]);
  });

  it("skips missing/too-short numbers and removes duplicates", () => {
    expect(selectedNumbers([{ phone: "" }, { phone: undefined }, { phone: "123" }, { phone: "0501234567" }, { phone: "050-1234567" }])).toEqual(["972501234567"]);
  });
});

describe("formatting", () => {
  it("puts one number per line", () => {
    expect(formatNumbers(["972501234567", "972521112222"])).toBe("972501234567\n972521112222");
  });
});
