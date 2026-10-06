// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import vm from "node:vm";

// Loads the Apps Script source into a sandbox with mocks of the Google services it uses.

const toSigned = (buf) => [...buf].map((b) => (b > 127 ? b - 256 : b));
const toBuffer = (bytes) => Buffer.from(bytes.map((b) => (b + 256) % 256));
const webSafe = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

class MockRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  _read(display) {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const v = this.sheet.get(this.r + i, this.c + j);
        row.push(display ? (v == null ? "" : String(v)) : v == null ? "" : v);
      }
      out.push(row);
    }
    return out;
  }
  getValues() { return this._read(false); }
  getDisplayValues() { return this._read(true); }
  setValues(values) {
    values.forEach((row, i) => row.forEach((v, j) => this.sheet.set(this.r + i, this.c + j, v)));
    return this;
  }
  setValue(v) { this.sheet.set(this.r, this.c, v); return this; }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
}

class MockSheet {
  constructor(name, rows = []) { this.name = name; this.cells = rows.map((r) => [...r]); this.hidden = false; }
  get(r, c) { return (this.cells[r - 1] || [])[c - 1]; }
  set(r, c, v) {
    while (this.cells.length < r) this.cells.push([]);
    const row = this.cells[r - 1];
    while (row.length < c) row.push("");
    row[c - 1] = v;
  }
  getName() { return this.name; }
  isSheetHidden() { return this.hidden; }
  getLastRow() { let last = 0; this.cells.forEach((row, i) => { if (row.some((v) => v !== "" && v != null)) last = i + 1; }); return last; }
  getLastColumn() { return this.cells.reduce((m, row) => { let l = 0; row.forEach((v, i) => { if (v !== "" && v != null) l = i + 1; }); return Math.max(m, l); }, 0); }
  getDataRange() { return new MockRange(this, 1, 1, this.getLastRow(), this.getLastColumn()); }
  getRange(a, b, c, d) {
    if (typeof a === "string") { // A1:E30
      const m = a.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      const col = (s) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
      return new MockRange(this, +m[2], col(m[1]), +m[4] - +m[2] + 1, col(m[3]) - col(m[1]) + 1);
    }
    return new MockRange(this, a, b, c ?? 1, d ?? 1);
  }
  appendRow(row) { this.cells.push([...row]); }
  insertColumnBefore(col) {
    this.cells.forEach((row) => { while (row.length < col - 1) row.push(""); row.splice(col - 1, 0, ""); });
  }
}

class MockSpreadsheet {
  constructor(id, sheets) { this.id = id; this.sheets = sheets; }
  getSheets() { return this.sheets; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new MockSheet(n); this.sheets.push(s); return s; }
  getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}/edit`; }
}

function createEnv() {
  const clock = { now: 1_800_000_000_000 };
  const cacheStore = new Map();
  const props = new Map();
  const lockState = { available: true, acquired: 0, released: 0 };
  const triggers = [];

  const spreadsheets = {
    PERM: new MockSpreadsheet("PERM", [
      new MockSheet("גיליון1", [
        ["קוד", "תפקיד", "עריכה", "דוח 1", "עדכון דוח 1", "צפייה בדוח 1"],
        ["1111", "מנהל", "TRUE", "TRUE", "TRUE", "TRUE"],
        ["2222", "דיווח", "FALSE", "TRUE", "FALSE", "FALSE"],
        ["3333", "צופה", "FALSE", "FALSE", "FALSE", ""],
        [4444, "מספר", true, "true", "כן", "כן"],
        ["6666", "מחלקה אחת", "FALSE", "TRUE", "מחלקה 1", "מחלקה 1"],
        ["7777", "שתי מחלקות", "FALSE", "TRUE", "מחלקה 1, מחלקה 2", "מחלקה 1, מחלקה 2"],
        ["8888", "ריק", "FALSE", "TRUE", "", ""],
        ["3434", "ללא רווח", "FALSE", "TRUE", "מחלקה1"],
        ["1212", "מרכאות", "FALSE", "TRUE", 'חפ"ק; alpha'],
      ]),
    ]),
    SOLD: new MockSpreadsheet("SOLD", [
      new MockSheet("מחלקה 1", [
        ["", "", "", "", "", "", "", "", ""],
        ["", "מסגרת", "", "", "מספר אישי", "תעודת זהות", "שם משפחה", "שם פרטי", "טלפון עיקרי"],
        ["", "מחלקה 1", "", "", 7158852, "012345678", "קליסקי", "שלמה", "0501234567"],
        ["", "", "", "", "", "", "", "", ""],
      ]),
      new MockSheet("סיכום", [["x"], ["x"], ["x"]]),
    ]),
    OPT: new MockSpreadsheet("OPT", [
      new MockSheet("דוח 1", [
        ["", "אפשרות", "קוד", "צבע", ""],
        ["", "שוחרר", "ש", "אפור", ""],
        ["", "נפקד", "נ", "אדום", ""],
        ["", "במוצב", "מ", "ירוק", ""],
      ]),
      new MockSheet('צפי הגעה', [
        ["", "אפשרות", "קוד", "צבע", ""],
        ["", "מגיע", "מ", "ירוק", ""],
        ["", "בבדיקה", "ב", "תכלת", ""],
      ]),
    ]),
    R1: new MockSpreadsheet("R1", []),
    ARR: new MockSpreadsheet("ARR", []),
  };

  const sandbox = {
    console,
    Date: class extends Date {
      static now() { return clock.now; }
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (s) => ({ getContent: () => s, setMimeType() { return this; } }),
    },
    Utilities: {
      Charset: { UTF_8: "UTF_8" },
      DigestAlgorithm: { SHA_256: "SHA_256" },
      getUuid: () => randomUUID(),
      computeDigest: (_a, value) => toSigned(createHash("sha256").update(value, "utf8").digest()),
      computeHmacSha256Signature: (value, key) => toSigned(createHmac("sha256", key).update(value, "utf8").digest()),
      base64EncodeWebSafe: (v) => webSafe(Array.isArray(v) ? toBuffer(v) : Buffer.from(String(v), "utf8")),
      base64DecodeWebSafe: (s) => toSigned(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")),
      newBlob: (bytes) => ({ getDataAsString: () => toBuffer(bytes).toString("utf8") }),
      formatDate: (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
    },
    Session: { getScriptTimeZone: () => "Asia/Jerusalem" },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => { const e = cacheStore.get(k); return e && e.exp > clock.now ? e.v : null; },
        put: (k, v, sec) => cacheStore.set(k, { v, exp: clock.now + sec * 1000 }),
        removeAll: (keys) => keys.forEach((k) => cacheStore.delete(k)),
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => props.get(k) ?? null,
        setProperty: (k, v) => props.set(k, v),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { if (!lockState.available) return false; lockState.acquired++; return true; },
        releaseLock: () => { lockState.released++; },
      }),
    },
    ScriptApp: {
      getProjectTriggers: () => [...triggers],
      deleteTrigger: (t) => { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger: (fn) => {
        const t = { fn, id: null, getHandlerFunction: () => fn };
        const builder = {
          forSpreadsheet: (id) => { t.id = id; return builder; },
          onEdit: () => builder,
          create: () => { triggers.push(t); return t; },
        };
        return builder;
      },
    },
    SpreadsheetApp: {
      flush() {},
      openById: (id) => {
        const key = { "1aAf9EWKG7BoCX9_zG6X3naXSApMlMKWrhAg23ltm7gU": "PERM", "1YWmqukCrSYmDy40rD0LuOeumnOfYzypaSZd08-6Iyx4": "SOLD", "1f8UFNxGHjIabhkH5oW56J722bsj6fesNgyseY1sDXvw": "OPT", "1eN3M6Onp9egtpJdj58jlcLkvL5_Ce5SYC1Z5UZFm9vE": "R1", "1W0IhDjhsoOa77dO-diLfVL9Jp2q-CxDSJct5K7D9v6Q": "ARR" }[id];
        if (!key) throw new Error(`unknown spreadsheet ${id}`);
        return spreadsheets[key];
      },
    },
    Logger: { log() {} },
  };

  const ctx = vm.createContext(sandbox);
  const src = readFileSync(resolve(process.cwd(), "src/serverCode/AppsScriptCode"), "utf8");
  const api = vm.runInContext(`${src}\n;({ doPost, doGet, clearCaches, setupTokenSecret, installCacheTriggers, onSheetEdited, parseUpdateAccess, parseViewAccess })`, ctx);

  const post = (body) => JSON.parse(api.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } }).getContent());
  const login = (code) => post({ action: "login", code });
  return { api, post, login, clock, spreadsheets, cacheStore, props, lockState, triggers };
}

describe("Apps Script server", () => {
  let env;
  beforeEach(() => { env = createEnv(); });

  describe("login and tokens", () => {
    it("logs in with a valid code and returns a signed token plus all permission flags", () => {
      const r = env.login("1111");
      expect(r).toMatchObject({ success: true, role: "מנהל", canEdit: true, canReport1: true, canUpdate1: true });
      expect(r.token.split(".")).toHaveLength(2);
      expect(Buffer.from(r.token.split(".")[0], "base64").toString()).not.toContain("1111"); // the code is not in the token
    });

    it("understands TRUE/true/כן/boolean true cells and numeric codes", () => {
      expect(env.login("4444")).toMatchObject({ success: true, canEdit: true, canReport1: true, canUpdate1: true });
    });

    it("rejects a wrong or empty code", () => {
      expect(env.login("9999")).toMatchObject({ success: false, error: "קוד גישה שגוי" });
      expect(env.login("")).toMatchObject({ success: false });
    });

    it("locks logins after too many failures and recovers when the window passes", () => {
      for (let i = 0; i < 20; i++) env.login("bad");
      expect(env.login("1111").error).toContain("ניסיונות רבים");
      env.clock.now += 6 * 60 * 1000;
      expect(env.login("1111").success).toBe(true);
    });

    it("accepts the token it issued and rejects forged, tampered and legacy tokens", () => {
      const { token } = env.login("1111");
      expect(env.post({ action: "getSoldiers", token }).success).toBe(true);

      const legacy = Buffer.from(`1111:${env.clock.now}`).toString("base64"); // the old base64(code:timestamp) format
      for (const bad of [legacy, "abc", token + "x", token.replace(/^./, "A") , "." , `${token.split(".")[0]}.`]) {
        const r = env.post({ action: "getSoldiers", token: bad });
        expect(r).toMatchObject({ success: false, isAuthError: true });
      }
    });

    it("rejects an expired token and a missing token", () => {
      const { token } = env.login("1111");
      env.clock.now += 31 * 24 * 60 * 60 * 1000;
      expect(env.post({ action: "getSoldiers", token })).toMatchObject({ isAuthError: true, error: expect.stringContaining("פג") });
      expect(env.post({ action: "getSoldiers" })).toMatchObject({ isAuthError: true });
    });

    it("revokes access once the user is removed from the sheet (after the short cache)", () => {
      const { token } = env.login("2222");
      expect(env.post({ action: "getSoldiers", token }).success).toBe(true);
      const sheet = env.spreadsheets.PERM.sheets[0];
      sheet.cells = sheet.cells.filter((row) => row[0] !== "2222");
      expect(env.post({ action: "getSoldiers", token }).success).toBe(true); // still cached for up to 60s
      env.clock.now += 61 * 1000;
      expect(env.post({ action: "getSoldiers", token })).toMatchObject({ success: false, isAuthError: true });
    });

    it("tokens from before a secret rotation stop working", () => {
      const { token } = env.login("1111");
      env.api.setupTokenSecret();
      expect(env.post({ action: "getSoldiers", token }).isAuthError).toBe(true);
    });
  });

  describe("permissions", () => {
    const tokenFor = (code) => env.login(code).token;

    it("getSoldiers is open to any signed-in user and keeps leading zeros", () => {
      const r = env.post({ action: "getSoldiers", token: tokenFor("3333") });
      expect(r.success).toBe(true);
      expect(r.data).toEqual([
        { id: "7158852", personalId: "7158852", idNum: "012345678", firstName: "שלמה", lastName: "קליסקי", phone: "0501234567", unit: "מחלקה 1", tabName: "מחלקה 1" },
      ]);
    });

    it("getReportOptions needs canReport1, and a denial is a permission error (not an auth error)", () => {
      const denied = env.post({ action: "getReportOptions", token: tokenFor("3333") });
      expect(denied).toMatchObject({ success: false, isPermissionError: true, missingPermissions: ["canReport1"] });
      expect(denied.isAuthError).toBeUndefined();
      expect(denied.error).not.toContain("הוסרו"); // the app treats that word as a logout trigger

      const ok = env.post({ action: "getReportOptions", token: tokenFor("2222") });
      expect(ok.success).toBe(true);
      expect(ok.data.report1.map((o) => o.code)).toEqual(["ש", "נ", "מ"]);
      expect(ok.data.arrivalForecast[0]).toEqual({ name: "מגיע", code: "מ", color: "ירוק" });
    });

    const report = (token, extra = {}) => ({
      action: "submitMatzalReport",
      token,
      reportType: "דוח 1",
      department: "מחלקה 1",
      date: "03/10/2026",
      reports: [{ firstName: "שלמה", lastName: "קליסקי", status: "מ" }],
      ...extra,
    });

    it("updating either report needs canReport1 AND canUpdate1 (canReport1 alone is not enough)", () => {
      for (const reportType of ["דוח 1", "צפי הגעה"]) {
        const r = env.post(report(tokenFor("2222"), { reportType })); // canReport1 only
        expect(r).toMatchObject({ success: false, isPermissionError: true, missingPermissions: ["canUpdate1"] });
        expect(r.error).toContain("עדכון דיווחים");
      }
      expect(env.spreadsheets.R1.sheets).toHaveLength(0); // nothing was written
      expect(env.spreadsheets.ARR.sheets).toHaveLength(0);

      for (const reportType of ["דוח 1", "צפי הגעה"]) {
        expect(env.post(report(tokenFor("1111"), { reportType })).success).toBe(true); // both flags
      }
    });

    it("a user with neither flag cannot update either report and sees both missing permissions", () => {
      for (const reportType of ["דוח 1", "צפי הגעה"]) {
        const r = env.post(report(tokenFor("3333"), { reportType }));
        expect(r).toMatchObject({ success: false, isPermissionError: true, missingPermissions: ["canReport1", "canUpdate1"] });
      }
      expect(env.spreadsheets.R1.sheets).toHaveLength(0);
      expect(env.spreadsheets.ARR.sheets).toHaveLength(0);
    });

    it("canUpdate1 without canReport1 is not enough either", () => {
      const sheet = env.spreadsheets.PERM.sheets[0];
      sheet.cells.push(["5555", "עדכון בלבד", "FALSE", "FALSE", "TRUE"]);
      env.clock.now += 61 * 1000; // let the cached permission table refresh
      const r = env.post(report(tokenFor("5555")));
      expect(r).toMatchObject({ success: false, isPermissionError: true, missingPermissions: ["canReport1"] });
    });

    it("report type is matched exactly (דו\"ח 1 / quotes ok), never loosely, and must be present", () => {
      const t = tokenFor("1111");
      expect(env.post(report(t, { reportType: 'דו"ח 1' })).success).toBe(true);
      expect(env.post(report(t, { reportType: "" }))).toMatchObject({ success: false, error: "סוג דיווח לא מוכר" });
      expect(env.post(report(t, { reportType: "דוח 1 מורחב" })).success).toBe(false);
    });

    it("unknown actions, empty and malformed bodies fail cleanly", () => {
      const t = tokenFor("1111");
      expect(env.post({ action: "constructor", token: t })).toMatchObject({ success: false, error: "פעולה לא מוכרת" });
      expect(env.post({ action: "nope", token: t }).success).toBe(false);
      expect(env.post("{not json").success).toBe(false);
      expect(JSON.parse(env.api.doPost({}).getContent()).success).toBe(false);
      expect(JSON.parse(env.api.doGet().getContent()).success).toBe(false);
    });

    it("a report sent without an action is still treated as a report (backwards compatible)", () => {
      const { action, ...noAction } = report(tokenFor("1111"));
      expect(env.post(noAction).success).toBe(true);
    });
  });

  describe("writing reports", () => {
    const submit = (extra = {}) =>
      env.post({
        action: "submitMatzalReport",
        token: env.login("1111").token,
        reportType: "דוח 1",
        department: "מחלקה 1",
        date: "03/10/2026",
        reports: [
          { firstName: "ישראל", lastName: "ישראלי", status: "מ" },
          { firstName: "משה", lastName: "כהן", status: "ב" },
        ],
        ...extra,
      });
    const sheetOf = () => env.spreadsheets.R1.getSheetByName("מחלקה 1");

    it("creates the sheet, header, date column and rows; reports counts and the file url", () => {
      const r = submit({ reports: [{ firstName: "ישראל", lastName: "ישראלי", status: "מ" }, { firstName: "משה", lastName: "כהן", status: "נ" }] });
      expect(r).toMatchObject({ success: true, updated: 2, added: 2, skipped: [] });
      expect(r.fileUrl).toContain("R1");
      expect(sheetOf().cells).toEqual([
        ["#", "שם פרטי", "שם משפחה", "03/10/2026"],
        [1, "ישראל", "ישראלי", "מ"],
        [2, "משה", "כהן", "נ"],
      ]);
    });

    it("re-sending the same date overwrites the same column; a new date adds a column and keeps old values", () => {
      submit({ reports: [{ firstName: "ישראל", lastName: "ישראלי", status: "מ" }] });
      submit({ reports: [{ firstName: "ישראל", lastName: "ישראלי", status: "ש" }, { firstName: "דני", lastName: "לוי", status: "נ" }] });
      expect(sheetOf().cells[1]).toEqual([1, "ישראל", "ישראלי", "ש"]);
      expect(sheetOf().cells[2]).toEqual([2, "דני", "לוי", "נ"]);

      submit({ date: "04/10/2026", reports: [{ firstName: "דני", lastName: "לוי", status: "מ" }] });
      expect(sheetOf().cells[0]).toEqual(["#", "שם פרטי", "שם משפחה", "03/10/2026", "04/10/2026"]);
      expect(sheetOf().cells[1].slice(3)).toEqual(["ש", ""]);        // first soldier: old value kept, new date empty
      expect(sheetOf().cells[2].slice(3)).toEqual(["נ", "מ"]);
    });

    it("accepts option names as well as codes, skips invalid statuses and nameless rows", () => {
      const r = submit({
        reports: [
          { firstName: "א", lastName: "ב", status: "במוצב" }, // name -> code מ
          { firstName: "ג", lastName: "ד", status: "ZZ" },    // not an option of דוח 1
          { firstName: "", lastName: "", status: "מ" },       // no name
          { firstName: "ה", lastName: "ו", status: "" },      // no status
        ],
      });
      expect(r).toMatchObject({ success: true, updated: 1 });
      expect(r.skipped).toEqual([
        { name: "ג ד", reason: "invalid_status", message: "סטטוס לא חוקי: ZZ" },
        { name: "(ללא שם)", reason: "empty_name", message: "חסר שם" },
        { name: "ה ו", reason: "empty_status", message: "חסר סטטוס" },
      ]);
      expect(sheetOf().cells[1]).toEqual([1, "א", "ב", "מ"]);
    });

    it("fails when nothing valid is left, and for bad dates or payloads", () => {
      const none = submit({ reports: [{ firstName: "א", lastName: "ב", status: "ZZ" }] });
      expect(none).toMatchObject({ success: false, error: "אין שורות תקינות לעדכון" });
      expect(none.skipped).toEqual([{ name: "א ב", reason: "invalid_status", message: "סטטוס לא חוקי: ZZ" }]);
      expect(submit({ date: "31/02/2026" }).error).toContain("תאריך");
      expect(submit({ date: "2026-10-03" }).error).toContain("תאריך");
      expect(submit({ reports: "nope" }).success).toBe(false);
      expect(submit({ reports: Array.from({ length: 1001 }, () => ({})) }).error).toContain("יותר מדי");
      expect(sheetOf()).toBeNull();
    });

    it("defaults an empty date to today in dd/mm/yyyy", () => {
      submit({ date: "" });
      expect(sheetOf().cells[0][3]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    describe("notes (הערות)", () => {
      const row = (first, last, status, note) => ({ firstName: first, lastName: last, status, ...(note === undefined ? {} : { note }) });
      const last = (arr) => arr[arr.length - 1];

      it("saves the note in a 'הערות' column at the end of the sheet", () => {
        const r = submit({ reports: [row("ישראל", "ישראלי", "מ", "מגיע באיחור"), row("משה", "כהן", "נ", "")] });
        expect(r.success).toBe(true);
        expect(sheetOf().cells).toEqual([
          ["#", "שם פרטי", "שם משפחה", "03/10/2026", "הערות"],
          [1, "ישראל", "ישראלי", "מ", "מגיע באיחור"],
          [2, "משה", "כהן", "נ", ""],
        ]);
      });

      it("a new value overwrites the previous one, including an empty value", () => {
        submit({ reports: [row("א", "ב", "מ", "הערה ראשונה"), row("ג", "ד", "מ", "נשארת")] });
        submit({ reports: [row("א", "ב", "נ", "הערה חדשה")] });
        expect(sheetOf().cells[1].slice(3)).toEqual(["נ", "הערה חדשה"]);
        expect(sheetOf().cells[2].slice(3)).toEqual(["מ", "נשארת"]);        // not sent this time -> untouched
        submit({ reports: [row("א", "ב", "נ", "")] });
        expect(sheetOf().cells[1][4]).toBe("");                              // an explicit empty note clears it
      });

      it("a new date column is inserted before the notes, which stay the last column and keep their values", () => {
        submit({ reports: [row("א", "ב", "מ", "הערה")] });
        submit({ date: "04/10/2026", reports: [row("א", "ב", "נ", "הערה מעודכנת"), row("ג", "ד", "ש", "של ג")] });
        expect(sheetOf().cells[0]).toEqual(["#", "שם פרטי", "שם משפחה", "03/10/2026", "04/10/2026", "הערות"]);
        expect(sheetOf().cells[1]).toEqual([1, "א", "ב", "מ", "נ", "הערה מעודכנת"]);   // old status kept, note overwritten
        expect(sheetOf().cells[2]).toEqual([2, "ג", "ד", "", "ש", "של ג"]);
        expect(last(sheetOf().cells[0])).toBe("הערות");
        submit({ date: "05/10/2026", reports: [row("א", "ב", "מ", "עוד אחת")] });
        expect(last(sheetOf().cells[0])).toBe("הערות");
        expect(sheetOf().cells[0].slice(3)).toEqual(["03/10/2026", "04/10/2026", "05/10/2026", "הערות"]);
        expect(sheetOf().cells[1].slice(3)).toEqual(["מ", "נ", "מ", "עוד אחת"]);
      });

      it("adds the column at the end of an older sheet that had none", () => {
        submit({ reports: [row("א", "ב", "מ")] });                         // no note field at all (older app)
        expect(sheetOf().cells[0]).toEqual(["#", "שם פרטי", "שם משפחה", "03/10/2026"]);
        submit({ date: "04/10/2026", reports: [row("א", "ב", "נ", "ראשונה")] });
        expect(sheetOf().cells[0]).toEqual(["#", "שם פרטי", "שם משפחה", "03/10/2026", "04/10/2026", "הערות"]);
        expect(sheetOf().cells[1]).toEqual([1, "א", "ב", "מ", "נ", "ראשונה"]);
      });

      it("reports without a note field leave existing notes alone and never create the column", () => {
        submit({ reports: [row("א", "ב", "מ", "נשמר")] });
        submit({ reports: [row("א", "ב", "נ")] });
        expect(sheetOf().cells[1]).toEqual([1, "א", "ב", "נ", "נשמר"]);
        submit({ reportType: "צפי הגעה", reports: [row("א", "ב", "מ")] });
        expect(env.spreadsheets.ARR.getSheetByName("מחלקה 1").cells[0]).not.toContain("הערות");
      });

      it("trims, caps the length and neutralises formulas", () => {
        submit({ reports: [row("א", "ב", "מ", "  =HYPERLINK(\"x\")  "), row("ג", "ד", "מ", "x".repeat(900))] });
        expect(sheetOf().cells[1][4]).toBe("'=HYPERLINK(\"x\")");
        expect(sheetOf().cells[2][4]).toHaveLength(500);
      });

      it("each report type keeps its own notes in its own file", () => {
        submit({ reports: [row("א", "ב", "מ", "בדוח 1")] });
        submit({ reportType: "צפי הגעה", reports: [row("א", "ב", "מ", "בצפי")] });
        expect(sheetOf().cells[1][4]).toBe("בדוח 1");
        expect(env.spreadsheets.ARR.getSheetByName("מחלקה 1").cells[1][4]).toBe("בצפי");
      });
    });

    it("neutralises spreadsheet formulas in names", () => {
      submit({ reports: [{ firstName: "=HYPERLINK(\"x\")", lastName: "+1", status: "מ" }] });
      expect(sheetOf().cells[1].slice(1, 3)).toEqual(["'=HYPERLINK(\"x\")", "'+1"]);
    });

    it("writes arrival forecasts to their own file", () => {
      submit({ reportType: "צפי הגעה", reports: [{ firstName: "א", lastName: "ב", status: "מ" }] });
      expect(env.spreadsheets.ARR.getSheetByName("מחלקה 1")).not.toBeNull();
      expect(env.spreadsheets.R1.getSheetByName("מחלקה 1")).toBeNull();
    });
  });

  describe("busy lock", () => {
    const send = () =>
      env.post({
        action: "submitMatzalReport",
        token: env.login("1111").token,
        reportType: "דוח 1",
        department: "מחלקה 1",
        date: "03/10/2026",
        reports: [{ firstName: "א", lastName: "ב", status: "מ" }],
      });

    it("returns a friendly 'busy' reply (not a server error) and writes nothing when the lock is not free", () => {
      env.lockState.available = false;
      const r = send();
      expect(r).toMatchObject({ success: false, isBusy: true, error: "המערכת עסוקה כרגע, נסו שוב בעוד רגע" });
      expect(r.isAuthError).toBeUndefined();
      expect(env.spreadsheets.R1.sheets).toHaveLength(0);
      expect(env.lockState.released).toBe(0); // never acquired, so nothing to release
    });

    it("works again once the lock is free, and always releases the lock it took", () => {
      env.lockState.available = false;
      send();
      env.lockState.available = true;
      expect(send().success).toBe(true);
      expect(env.lockState.acquired).toBe(1);
      expect(env.lockState.released).toBe(1);
    });
  });

  describe("cache triggers", () => {
    it("installs one edit trigger per spreadsheet and is safe to run again", () => {
      env.api.installCacheTriggers();
      env.api.installCacheTriggers();
      expect(env.triggers.map((t) => t.fn)).toEqual(["onSheetEdited", "onSheetEdited", "onSheetEdited"]);
      expect(env.triggers.map((t) => t.id).sort()).toEqual([
        "1YWmqukCrSYmDy40rD0LuOeumnOfYzypaSZd08-6Iyx4",
        "1aAf9EWKG7BoCX9_zG6X3naXSApMlMKWrhAg23ltm7gU",
        "1f8UFNxGHjIabhkH5oW56J722bsj6fesNgyseY1sDXvw",
      ]);
    });

    it("a sheet edit clears the caches so a permission change applies immediately (no 60s wait)", () => {
      const { token } = env.login("2222");
      expect(env.post({ action: "getReportOptions", token }).success).toBe(true);
      const sheet = env.spreadsheets.PERM.sheets[0];
      sheet.cells.find((row) => row[0] === "2222")[3] = "FALSE"; // revoke canReport1
      expect(env.post({ action: "getReportOptions", token }).success).toBe(true); // stale cache for now
      env.api.onSheetEdited();
      expect(env.post({ action: "getReportOptions", token })).toMatchObject({ success: false, isPermissionError: true });
    });
  });

  describe("department-specific update permission (canUpdate1 cell)", () => {
    const send = (code, department, reportType = "דוח 1") =>
      env.post({
        action: "submitMatzalReport",
        token: env.login(code).token,
        reportType,
        department,
        date: "03/10/2026",
        reports: [{ firstName: "א", lastName: "ב", status: "מ" }],
      });
    const sheetNames = (file) => env.spreadsheets[file].sheets.map((s) => s.name);

    it("parses the cell: TRUE = all, FALSE/empty = none, text = comma-separated departments", () => {
      const p = env.api.parseUpdateAccess;
      for (const v of [true, "TRUE", "true", "כן", 1, "1", " yes "]) {
        expect(p(v)).toEqual({ canUpdate1: true, updateDepartments: null });
      }
      for (const v of ["FALSE", "false", "", undefined, null, "לא", "0", "  "]) {
        expect(p(v)).toEqual({ canUpdate1: false, updateDepartments: [] });
      }
      expect(p("מחלקה 1")).toEqual({ canUpdate1: true, updateDepartments: ["מחלקה 1"] });
      expect(p(" א ,  ב ;ג\nד ")).toEqual({ canUpdate1: true, updateDepartments: ["א", "ב", "ג", "ד"] });
      expect(p(", ,")).toEqual({ canUpdate1: false, updateDepartments: [] });
    });

    it("login reports canUpdate1 plus the allowed departments (null = all), also from the cache", () => {
      for (let i = 0; i < 2; i++) { // second round is served from the permissions cache
        expect(env.login("1111")).toMatchObject({ canUpdate1: true, updateDepartments: null });
        expect(env.login("6666")).toMatchObject({ canUpdate1: true, updateDepartments: ["מחלקה 1"] });
        expect(env.login("7777")).toMatchObject({ canUpdate1: true, updateDepartments: ["מחלקה 1", "מחלקה 2"] });
        expect(env.login("2222")).toMatchObject({ canUpdate1: false, updateDepartments: [] });
        expect(env.login("8888")).toMatchObject({ canUpdate1: false, updateDepartments: [] });
      }
    });

    it("a user with a single department can update it but not any other, for both report types", () => {
      expect(send("6666", "מחלקה 1").success).toBe(true);
      expect(send("6666", "מחלקה 1", "צפי הגעה").success).toBe(true);

      for (const reportType of ["דוח 1", "צפי הגעה"]) {
        const denied = send("6666", "מחלקה 2", reportType);
        expect(denied).toMatchObject({ success: false, isPermissionError: true, department: "מחלקה 2", missingPermissions: ["canUpdate1"] });
        expect(denied.error).toContain("מחלקה 2");
        expect(denied.isAuthError).toBeUndefined();
        expect(denied.error).not.toContain("הוסרו");
      }
      expect(sheetNames("R1")).toEqual(["מחלקה 1"]); // nothing was created for the other department
      expect(sheetNames("ARR")).toEqual(["מחלקה 1"]);
    });

    it("a comma-separated list allows exactly the listed departments", () => {
      expect(send("7777", "מחלקה 1").success).toBe(true);
      expect(send("7777", "מחלקה 2").success).toBe(true);
      expect(send("7777", "מחלקה 3")).toMatchObject({ success: false, isPermissionError: true });
      expect(sheetNames("R1").sort()).toEqual(["מחלקה 1", "מחלקה 2"]);
    });

    it("TRUE (or כן) allows every department, including a brand-new one", () => {
      expect(send("1111", "מחלקה 9").success).toBe(true);
      expect(send("4444", "חפק").success).toBe(true);
      expect(sheetNames("R1").sort()).toEqual(["חפק", "מחלקה 9"]);
    });

    it("FALSE or an empty cell means no update access at all (stopped before any department check)", () => {
      for (const code of ["2222", "8888"]) {
        const r = send(code, "מחלקה 1");
        expect(r).toMatchObject({ success: false, isPermissionError: true, missingPermissions: ["canUpdate1"] });
        expect(r.department).toBeUndefined();
      }
      expect(env.spreadsheets.R1.sheets).toHaveLength(0);
    });

    it("tolerates extra spaces and quotes in the department and reuses the existing sheet", () => {
      expect(send("1111", "מחלקה 1").success).toBe(true);
      expect(send("6666", "  מחלקה    1 ").success).toBe(true);
      expect(sheetNames("R1")).toEqual(["מחלקה 1"]); // no duplicate sheet
      expect(env.spreadsheets.R1.sheets[0].cells).toHaveLength(2); // one soldier row, updated in place
    });

    it("a request without a department is only allowed for users with access to all departments", () => {
      const noDept = (code) =>
        env.post({
          action: "submitMatzalReport",
          token: env.login(code).token,
          reportType: "דוח 1",
          date: "03/10/2026",
          reports: [{ firstName: "א", lastName: "ב", status: "מ" }],
        });
      expect(noDept("6666")).toMatchObject({ success: false, isPermissionError: true });
      expect(noDept("1111").success).toBe(true); // falls back to the default "דיווחים" sheet
    });

    it("matches department names regardless of quote style and letter case, reusing the same sheet", () => {
      expect(send("1111", "Alpha").success).toBe(true);
      expect(send("1212", "ALPHA").success).toBe(true);            // allowed as "alpha"
      expect(send("1212", "חפ״ק").success).toBe(true);             // allowed as חפ"ק (different quote character)
      expect(send("1212", "חפ\"ק").success).toBe(true);
      expect(sheetNames("R1").sort()).toEqual(["Alpha", "חפ״ק"].sort());  // one sheet per department
      expect(send("1212", "bravo").success).toBe(false);
    });

    it("a cell written without a space (מחלקה1) matches the department with a space (מחלקה 1), and the reverse", () => {
      expect(send("3434", "מחלקה 1").success).toBe(true);
      expect(send("3434", "מחלקה1").success).toBe(true);
      expect(sheetNames("R1")).toEqual(["מחלקה 1"]);                // same sheet, no duplicate
      expect(send("3434", "מחלקה 2")).toMatchObject({ success: false, isPermissionError: true });
      expect(send("3434", "מחלקה 11")).toMatchObject({ success: false, isPermissionError: true }); // different number
      // and a cell with a space allows the department typed without one
      expect(send("6666", "מחלקה1").success).toBe(true);
      expect(sheetNames("R1")).toEqual(["מחלקה 1"]);
    });

    it("fails closed when a cached permission entry has no department list (stale cache)", () => {
      env.login("1111"); // fills the permissions cache
      const key = "perm_table_v3";
      const entry = env.cacheStore.get(key);
      const table = JSON.parse(entry.v).map((u) => { const { updateDepartments, ...old } = u; return old; });
      env.cacheStore.set(key, { v: JSON.stringify(table), exp: entry.exp });
      const r = send("1111", "מחלקה 1");
      expect(r).toMatchObject({ success: false, isPermissionError: true });
      expect(env.spreadsheets.R1.sheets).toHaveLength(0);
    });

    it("ignores a permissions cache left over from the previous script version", () => {
      for (const old of ["perm_table_v1", "perm_table_v2"]) {
        env.cacheStore.set(old, { v: JSON.stringify([{ id: "x", role: "ישן", canUpdate1: true }]), exp: env.clock.now + 60000 });
      }
      expect(send("6666", "מחלקה 1").success).toBe(true);          // built fresh from the sheet
      expect(send("6666", "מחלקה 2").success).toBe(false);
    });

    it("a department change in the sheet applies after the caches are cleared", () => {
      expect(send("6666", "מחלקה 2").success).toBe(false);
      const row = env.spreadsheets.PERM.sheets[0].cells.find((r) => r[0] === "6666");
      row[4] = "מחלקה 1, מחלקה 2";
      env.api.onSheetEdited();
      expect(send("6666", "מחלקה 2").success).toBe(true);
    });
  });

  describe("viewing reports (canView1)", () => {
    const view = (code, extra = {}) =>
      env.post({ action: "getReportView", token: env.login(code).token, reportType: "דוח 1", date: "03/10/2026", ...extra });

    // soldiers: מחלקה 1 = שלמה קליסקי + דוד כהן, מחלקה 2 = משה לוי + יוסי בר; reports exist for 03/10/2026
    beforeEach(() => {
      const sold = env.spreadsheets.SOLD;
      sold.sheets[0].cells.push(["", "מחלקה 1", "", "", "7000001", "", "כהן", "דוד", "0521111111"]);
      sold.sheets.push(
        new MockSheet("מחלקה 2", [
          ["", "", "", "", "", "", "", "", ""],
          ["", "מסגרת", "", "", "מספר אישי", "תעודת זהות", "שם משפחה", "שם פרטי", "טלפון עיקרי"],
          ["", "מחלקה 2", "", "", "7000002", "", "לוי", "משה", "0522222222"],
          ["", "מחלקה 2", "", "", "7000003", "", "בר", "יוסי", ""],
        ])
      );
      env.spreadsheets.R1.sheets.push(
        new MockSheet("מחלקה 1", [
          ["#", "שם פרטי", "שם משפחה", "03/10/2026", "04/10/2026"],
          [1, "שלמה", "קליסקי", "מ", ""],
          [2, "דוד", "כהן", "במוצב", "נ"],   // saved by option name -> counted as code מ
          [3, "אורח", "אחר", "ב", ""],       // reported but not in the soldiers list
        ]),
        new MockSheet("מחלקה 2", [
          ["#", "שם פרטי", "שם משפחה", "03/10/2026"],
          [1, "משה", "לוי", "נ"],
        ])
      );
    });

    it("parses the canView1 cell with the same rules as canUpdate1", () => {
      const p = env.api.parseViewAccess;
      expect(p("TRUE")).toEqual({ canView1: true, viewDepartments: null });
      expect(p("")).toEqual({ canView1: false, viewDepartments: [] });
      expect(p("FALSE")).toEqual({ canView1: false, viewDepartments: [] });
      expect(p("מחלקה 1, מחלקה 2")).toEqual({ canView1: true, viewDepartments: ["מחלקה 1", "מחלקה 2"] });
    });

    it("login returns canView1 and the viewable departments (null = all)", () => {
      expect(env.login("1111")).toMatchObject({ canView1: true, viewDepartments: null });
      expect(env.login("6666")).toMatchObject({ canView1: true, viewDepartments: ["מחלקה 1"] });
      expect(env.login("2222")).toMatchObject({ canView1: false, viewDepartments: [] });
      expect(env.login("3333")).toMatchObject({ canView1: false, viewDepartments: [] });
    });

    it("FALSE or empty denies the whole action with a permission error (not an auth error)", () => {
      for (const code of ["2222", "3333", "8888"]) {
        const r = view(code);
        expect(r).toMatchObject({ success: false, isPermissionError: true, missingPermissions: ["canView1"] });
        expect(r.isAuthError).toBeUndefined();
      }
    });

    it("TRUE gives an overall summary and a breakdown for every department", () => {
      const r = view("1111");
      expect(r).toMatchObject({ success: true, reportType: "דוח 1", date: "03/10/2026", hasData: true, details: null });
      expect(r.departments.map((d) => d.name)).toEqual(["מחלקה 1", "מחלקה 2"]);
      // מחלקה 1: 3 people (2 soldiers + one extra from the report tab); מ x2 (code + name), ב x1
      expect(r.departments[0]).toEqual({ name: "מחלקה 1", date: "03/10/2026", total: 3, reported: 3, unreported: 0, counts: { מ: 2, ב: 1 } });
      // מחלקה 2: 2 soldiers, one reported נ, one not reported
      expect(r.departments[1]).toEqual({ name: "מחלקה 2", date: "03/10/2026", total: 2, reported: 1, unreported: 1, counts: { נ: 1 } });
      expect(r.overall).toEqual({ total: 5, reported: 4, unreported: 1, counts: { מ: 2, ב: 1, נ: 1 } });
      expect(r.options.map((o) => o.code)).toEqual(["ש", "נ", "מ"]);
    });

    it("returns the personnel list only for a requested department", () => {
      const r = view("1111", { department: "מחלקה 2" });
      expect(r.department).toBe("מחלקה 2");
      expect(r.details).toEqual([
        { firstName: "משה", lastName: "לוי", status: "נ", note: "" },
        { firstName: "יוסי", lastName: "בר", status: "", note: "" },
      ]);
      expect(r.departments).toHaveLength(2); // the summary is still complete
    });

    it("matches the requested department loosely, and an unknown department gives an empty list", () => {
      expect(view("1111", { department: "מחלקה2" }).details).toHaveLength(2);
      expect(view("1111", { department: "לא קיימת" }).details).toEqual([]);
    });

    it("a department list limits the summary, the overall totals and the details to those departments", () => {
      const r = view("6666");
      expect(r.departments.map((d) => d.name)).toEqual(["מחלקה 1"]);
      expect(r.overall).toEqual({ total: 3, reported: 3, unreported: 0, counts: { מ: 2, ב: 1 } });
      expect(JSON.stringify(r)).not.toContain("לוי"); // nothing from other departments leaks
      const d = view("6666", { department: "מחלקה 1" });
      expect(d.details).toHaveLength(3);
    });

    it("asking for a department outside the list is refused", () => {
      const r = view("6666", { department: "מחלקה 2" });
      expect(r).toMatchObject({ success: false, isPermissionError: true, department: "מחלקה 2", missingPermissions: ["canView1"] });
      expect(r.error).toContain("מחלקה 2");
      expect(r.error).not.toContain("הוסרו");
      expect(view("7777", { department: "מחלקה 2" }).success).toBe(true);
    });

    it("returns each person's latest note in the personnel list (also when the dates move on)", () => {
      const sheet = env.spreadsheets.R1.getSheetByName("מחלקה 1");
      sheet.cells[0].push("הערות");                                  // notes column is last
      sheet.cells[1][5] = "מגיע באיחור";                              // שלמה
      sheet.cells[2][5] = "  חולה  ";                                 // דוד (trimmed)
      const byName = (r) => Object.fromEntries(r.details.map((d) => [d.firstName, d.note]));
      expect(byName(view("1111", { department: "מחלקה 1" }))).toEqual({ שלמה: "מגיע באיחור", דוד: "חולה", אורח: "" });
      expect(byName(view("1111", { date: "", department: "מחלקה 1" })).שלמה).toBe("מגיע באיחור");  // latest mode
      expect(view("1111", { department: "מחלקה 2" }).details.every((d) => d.note === "")).toBe(true);  // no notes column there
    });

    it("the 'הערות' header is never mistaken for a date when looking for the latest report", () => {
      const sheet = env.spreadsheets.R1.getSheetByName("מחלקה 1");
      sheet.cells[0].push("הערות");
      sheet.cells[1][5] = "x";
      expect(view("1111", { date: "" }).departments[0].date).toBe("04/10/2026");
    });

    it("tabs with nobody in them (like the default 'גיליון1' / 'Sheet1') are not departments", () => {
      env.spreadsheets.R1.sheets.push(
        new MockSheet("גיליון1", []),                                              // brand-new empty tab
        new MockSheet("Sheet1", [["#", "שם פרטי", "שם משפחה"]]),                  // header only
        new MockSheet("מחלקה ישנה", [["#", "שם פרטי", "שם משפחה", "03/10/2026"], [1, "ישן", "אדם", "מ"]]) // real data, not in the soldiers list
      );
      for (const r of [view("1111"), view("1111", { date: "" })]) {
        expect(r.departments.map((d) => d.name)).toEqual(["מחלקה 1", "מחלקה 2", "מחלקה ישנה"]);
        expect(r.overall.total).toBe(6);
      }
      expect(view("1111", { department: "גיליון1" })).toMatchObject({ success: true, details: [] });
    });

    it("an empty tab does not appear for a limited user either", () => {
      env.spreadsheets.R1.sheets.push(new MockSheet("גיליון1", []));
      expect(view("6666").departments.map((d) => d.name)).toEqual(["מחלקה 1"]);
    });

    describe("filtering the people by status across departments", () => {
      const people = (r) => r.people.map((p) => `${p.firstName} ${p.lastName} / ${p.department} / ${p.date}`);

      it("returns nobody unless a status is requested", () => {
        expect(view("1111").people).toBeNull();
      });

      it("a status code returns every person with it, from all departments, with department and date", () => {
        expect(people(view("1111", { status: "מ" }))).toEqual(["שלמה קליסקי / מחלקה 1 / 03/10/2026", "דוד כהן / מחלקה 1 / 03/10/2026"]);
        expect(people(view("1111", { status: "נ" }))).toEqual(["משה לוי / מחלקה 2 / 03/10/2026"]);
        expect(view("1111", { status: "ש" }).people).toEqual([]);                  // a valid status nobody has
        expect(view("1111", { status: "ZZ" }).people).toEqual([]);                 // unknown code
      });

      it("'__unreported' returns those with no status, '__other' those with a code that is not an option, '*' everyone", () => {
        expect(people(view("1111", { status: "__unreported" }))).toEqual(["יוסי בר / מחלקה 2 / 03/10/2026"]);
        expect(people(view("1111", { status: "__other" }))).toEqual(["אורח אחר / מחלקה 1 / 03/10/2026"]);   // status ב is not an option of דוח 1
        const all = view("1111", { status: "*" });
        expect(all.people).toHaveLength(5);
        expect(all.people.map((p) => p.note)).toEqual(["", "", "", "", ""]);
      });

      it("people carry their own note and status", () => {
        const sheet = env.spreadsheets.R1.getSheetByName("מחלקה 1");
        sheet.cells[0].push("הערות");
        sheet.cells[1][5] = "מגיע באיחור";
        const r = view("1111", { status: "מ" });
        expect(r.people[0]).toEqual({ firstName: "שלמה", lastName: "קליסקי", status: "מ", note: "מגיע באיחור", department: "מחלקה 1", date: "03/10/2026" });
      });

      it("without a date each person comes from their own department's latest report", () => {
        const r = view("1111", { date: "", status: "נ" });
        expect(people(r)).toEqual(["דוד כהן / מחלקה 1 / 04/10/2026", "משה לוי / מחלקה 2 / 03/10/2026"]);
      });

      it("a limited user only gets people of the departments they may view", () => {
        const r = view("6666", { status: "*" });
        expect(r.people).toHaveLength(3);
        expect(r.people.every((p) => p.department === "מחלקה 1")).toBe(true);
        expect(JSON.stringify(r)).not.toContain("לוי");
        expect(view("6666", { status: "נ" }).people).toEqual([]);                   // מחלקה 2's person is invisible to them
      });

      it("can be combined with a requested department (both lists are returned)", () => {
        const r = view("1111", { status: "נ", department: "מחלקה 2" });
        expect(r.details).toHaveLength(2);
        expect(r.people).toHaveLength(1);
      });

      it("a user without canView1 still gets nothing", () => {
        expect(view("2222", { status: "*" })).toMatchObject({ success: false, isPermissionError: true });
      });
    });

    it("a date without data returns everything as not reported, with hasData false", () => {
      const r = view("1111", { date: "10/10/2026" });
      expect(r).toMatchObject({ success: true, hasData: false });
      expect(r.overall).toEqual({ total: 5, reported: 0, unreported: 5, counts: {} });
    });

    it("uses the arrival forecast file and options for צפי הגעה, and validates input", () => {
      const r = view("1111", { reportType: "צפי הגעה" });
      expect(r).toMatchObject({ success: true, reportType: "צפי הגעה", hasData: false });
      expect(r.options.map((o) => o.name)).toEqual(["מגיע", "בבדיקה"]);
      expect(view("1111", { reportType: "x" })).toMatchObject({ success: false, error: "סוג דיווח לא מוכר" });
      expect(view("1111", { date: "2026-10-03" }).error).toContain("תאריך");
    });

    describe("without a date: the latest report of each department", () => {
      // מחלקה 1 has 03/10 (3 reported) and 04/10 (only דוד: נ); מחלקה 2 has only 03/10 (משה: נ)
      const latest = (code = "1111", extra = {}) => view(code, { date: "", ...extra });
      const R1Sheet = (name) => env.spreadsheets.R1.getSheetByName(name);

      it("gives every department its own newest date, and sums those reports up", () => {
        const r = latest();
        expect(r).toMatchObject({ success: true, hasData: true, date: "" });
        expect(r.departments.map((d) => [d.name, d.date])).toEqual([["מחלקה 1", "04/10/2026"], ["מחלקה 2", "03/10/2026"]]);
        expect(r.departments[0]).toMatchObject({ total: 3, reported: 1, unreported: 2, counts: { נ: 1 } });
        expect(r.departments[1]).toMatchObject({ total: 2, reported: 1, unreported: 1, counts: { נ: 1 } });
        expect(r.overall).toEqual({ total: 5, reported: 2, unreported: 3, counts: { נ: 2 } });
      });

      it("omitting the date field altogether means the same", () => {
        const r = env.post({ action: "getReportView", token: env.login("1111").token, reportType: "דוח 1" });
        expect(r.departments.map((d) => d.date)).toEqual(["04/10/2026", "03/10/2026"]);
      });

      it("picks the newest date, not the last column, and skips a newer column that has no statuses", () => {
        const sheet = R1Sheet("מחלקה 1");
        sheet.cells[0].push("05/10/2026", "02/10/2026");           // newer but empty, and an older column after it
        sheet.cells[1][6] = "ב";                                    // 02/10 has a status (older than 04/10)
        expect(latest().departments[0].date).toBe("04/10/2026");
        sheet.cells[1][5] = "מ";                                    // now 05/10 has a status
        expect(latest().departments[0].date).toBe("05/10/2026");
      });

      it("compares real dates (10/10 is later than 09/10, 01/11 later than 30/10)", () => {
        const sheet = R1Sheet("מחלקה 2");
        sheet.cells[0].push("9/10/2026", "10/10/2026", "30/10/2026", "01/11/2026");
        for (let c = 4; c < 8; c++) sheet.set(2, c + 1, "מ");
        expect(latest().departments[1].date).toBe("01/11/2026");
      });

      it("a department without any report has no date and everyone is not reported", () => {
        env.spreadsheets.R1.sheets = env.spreadsheets.R1.sheets.filter((s) => s.name !== "מחלקה 2"); // soldiers only
        const d = latest().departments.find((x) => x.name === "מחלקה 2");
        expect(d).toEqual({ name: "מחלקה 2", date: "", total: 2, reported: 0, unreported: 2, counts: {} });
      });

      it("no report anywhere gives hasData false", () => {
        env.spreadsheets.R1.sheets = [];
        const r = latest();
        expect(r).toMatchObject({ success: true, hasData: false });
        expect(r.departments.every((d) => d.date === "")).toBe(true);
      });

      it("the personnel list of a department uses that department's own newest date", () => {
        const r = latest("1111", { department: "מחלקה 1" });
        expect(r.details).toEqual([
          { firstName: "שלמה", lastName: "קליסקי", status: "", note: "" },
          { firstName: "דוד", lastName: "כהן", status: "נ", note: "" },       // from the 04/10 column
          { firstName: "אורח", lastName: "אחר", status: "", note: "" },
        ]);
      });

      it("limited users only get their own departments in this mode too", () => {
        const r = latest("6666");
        expect(r.departments.map((d) => d.name)).toEqual(["מחלקה 1"]);
        expect(r.overall.total).toBe(3);
        expect(latest("6666", { department: "מחלקה 2" })).toMatchObject({ success: false, isPermissionError: true });
      });

      it("an explicit invalid date is still rejected", () => {
        expect(latest("1111", { date: "31/02/2026" }).error).toContain("תאריך");
      });
    });

    it("viewing is read-only: it never writes to the report files", () => {
      const before = JSON.stringify(env.spreadsheets.R1.sheets.map((s) => s.cells));
      view("1111", { department: "מחלקה 1" });
      expect(JSON.stringify(env.spreadsheets.R1.sheets.map((s) => s.cells))).toBe(before);
    });
  });
});