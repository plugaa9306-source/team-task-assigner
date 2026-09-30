import { describe, it, expect, vi, afterEach } from "vitest";
import { parseCsv, parseMissions, parseRoles, fetchMissions, fetchRoles, ROLES_CSV_URL } from "./missions.js";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas and CRLF", () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n1,2,3\n')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseMissions", () => {
  it("reads the משימה column and skips blank rows", () => {
    const csv = "#,משימה,הערות\n1,סיור בוקר,\n2,סיור לילה,x\n3,,\n";
    expect(parseMissions(csv)).toEqual(["סיור בוקר", "סיור לילה"]);
  });

  it("finds the column wherever it is and ignores a BOM", () => {
    expect(parseMissions("﻿משימה,#\nא,1\nב,2")).toEqual(["א", "ב"]);
  });
});

describe("fetchMissions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches and parses the sheet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "#,משימה\n1,א" }));
    expect(await fetchMissions("u")).toEqual(["א"]);
  });

  it("throws on a failed response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchMissions("u")).rejects.toThrow("404");
  });
});

describe("roles", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parseRoles reads the תפקיד column", () => {
    expect(parseRoles("#,תפקיד,הערות\n1,נהג,\n2,מפקד,\n3,,")).toEqual(["נהג", "מפקד"]);
  });

  it("fetchRoles hits the roles tab by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "#,תפקיד\n1,נהג" });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchRoles()).toEqual(["נהג"]);
    expect(fetchMock).toHaveBeenCalledWith(ROLES_CSV_URL);
    expect(ROLES_CSV_URL).toContain("gid=433000815");
  });
});
