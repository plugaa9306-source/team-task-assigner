import { describe, it, expect } from "vitest";
import { diffSoldier, buildUpdateMessage, whatsappTextUrl, whatsappChatUrl, telUrl, formatPhone, editableValues } from "./soldierUpdate.js";

const s = { id: "7158852", idNum: "0123", firstName: "שלמה", lastName: "קליסקי", phone: "0501234567", unit: "מחלקה 1", tabName: "" };

describe("diffSoldier", () => {
  it("lists only changed fields", () => {
    const edited = { ...editableValues(s), phone: "0521111111", unit: "חפ\"ק" };
    expect(diffSoldier(s, edited)).toEqual([
      { key: "phone", label: "טלפון", from: "0501234567", to: "0521111111" },
      { key: "unit", label: "יחידה / מחלקה", from: "מחלקה 1", to: "חפ\"ק" },
    ]);
  });

  it("returns [] when nothing changed (whitespace ignored)", () => {
    expect(diffSoldier(s, { ...editableValues(s), phone: " 0501234567 " })).toEqual([]);
  });
});

describe("message and urls", () => {
  it("builds the message with old ⬅️ new lines", () => {
    const msg = buildUpdateMessage(s, [{ label: "טלפון", from: "0501234567", to: "0521111111" }]);
    expect(msg).toContain("חייל: שלמה קליסקי (מ\"א: 7158852)");
    expect(msg).toContain("• טלפון: 0501234567 ⬅️ 0521111111");
  });

  it("encodes the text into the wa.me url", () => {
    expect(whatsappTextUrl("א ב\n")).toBe("https://wa.me/?text=" + encodeURIComponent("א ב\n"));
  });

  it("formats phone links and display", () => {
    expect(whatsappChatUrl("050-123-4567")).toBe("https://wa.me/972501234567");
    expect(whatsappChatUrl("")).toBe("");
    expect(telUrl("050 123 4567")).toBe("tel:0501234567");
    expect(formatPhone("0501234567")).toBe("050-123-4567");
    expect(formatPhone("abc")).toBe("abc");
  });
});
