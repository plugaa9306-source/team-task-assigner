import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("../services/api.js", () => ({ getReportView: vi.fn() }));
import { getReportView } from "../services/api.js";
import ReportViewView from "./ReportViewView.vue";
import { STORAGE_KEY, hydrate, logout } from "../lib/auth.js";
import { todayISO, formatSyncDate } from "../lib/report1.js";

const OPTIONS = [
  { name: "שוחרר", code: "ש", color: "אפור" },
  { name: "נפקד", code: "נ", color: "אדום" },
  { name: "במוצב", code: "מ", color: "ירוק" },
];
const reply = (extra = {}) => ({
  success: true,
  reportType: "דוח 1",
  date: "x",
  department: "",
  hasData: true,
  options: OPTIONS,
  overall: { total: 5, reported: 4, unreported: 1, counts: { מ: 2, נ: 1, ב: 1 } },
  departments: [
    { name: "מחלקה 1", total: 3, reported: 3, unreported: 0, counts: { מ: 2, ב: 1 } },
    { name: "מחלקה 2", total: 2, reported: 1, unreported: 1, counts: { נ: 1 } },
  ],
  details: null,
  ...extra,
});

const layoutStub = { props: ["title", "subtitle"], template: "<div><h1>{{ title }}</h1><p class='sub'>{{ subtitle }}</p><slot /></div>" };
const mounted = [];
async function mountView(access = { canView1: true, viewDepartments: null }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", ...access }));
  hydrate();
  const w = mount(ReportViewView, { global: { stubs: { AppLayout: layoutStub } } });
  mounted.push(w);
  await flushPromises();
  return w;
}
const lastCall = () => getReportView.mock.calls.at(-1)[0];

describe("ReportViewView", () => {
  beforeEach(() => {
    localStorage.clear();
    logout();
    getReportView.mockReset().mockResolvedValue(reply());
  });
  afterEach(() => { // components share the login state, so don't let finished ones keep reacting
    while (mounted.length) mounted.pop().unmount();
  });

  it("opens on today with the default report type and loads the summary once", async () => {
    const w = await mountView();
    expect(w.find("h1").text()).toBe("צפייה בדוח 1");
    expect(w.find(".v1-date").element.value).toBe(todayISO());
    expect(w.find(".v1-type").element.value).toBe("report1");
    expect(getReportView).toHaveBeenCalledTimes(1);
    expect(lastCall()).toEqual({ reportType: "דוח 1", date: formatSyncDate(todayISO()), department: "" });
  });

  it("remembers the last chosen report type in localStorage and selects it on the next visit", async () => {
    const w = await mountView();
    await w.find(".v1-type").setValue("arrival");
    await flushPromises();
    expect(localStorage.getItem("team_app_view1_type")).toBe("arrival");
    expect(lastCall().reportType).toBe("צפי הגעה");
    w.unmount();

    const again = await mountView();
    expect(again.find(".v1-type").element.value).toBe("arrival");
    expect(lastCall().reportType).toBe("צפי הגעה");
  });

  it("ignores an invalid saved report type", async () => {
    localStorage.setItem("team_app_view1_type", "nonsense");
    const w = await mountView();
    expect(w.find(".v1-type").element.value).toBe("report1");
  });

  it("reloads when the date changes, and a cleared date falls back to today", async () => {
    const w = await mountView();
    await w.find(".v1-date").setValue("2026-09-01");
    await flushPromises();
    expect(lastCall().date).toBe("01/09/2026");
    await w.find(".v1-date").setValue("");
    await flushPromises();
    expect(w.find(".v1-date").element.value).toBe(todayISO());
  });

  describe("choosing a department", () => {
    it("has no department dropdown, only the report type and the date", async () => {
      const w = await mountView();
      expect(w.find(".v1-unit").exists()).toBe(false);
      expect(w.findAll(".v1-selectors .v1-field")).toHaveLength(2);
    });

    it("global access: nothing is selected at first, the personnel list waits for a tap on a department", async () => {
      const w = await mountView({ canView1: true, viewDepartments: null });
      expect(lastCall().department).toBe("");
      expect(w.find(".v1-table").exists()).toBe(false);
    });

    it("a user limited to a single department gets it selected automatically", async () => {
      const w = await mountView({ canView1: true, viewDepartments: ["מחלקה 2"] });
      expect(lastCall().department).toBe("מחלקה 2");
      expect(getReportView).toHaveBeenCalledTimes(1);          // no second request for the auto-selection
      expect(w.find(".v1-unit").exists()).toBe(false);
    });

    it("a user limited to several departments still picks one by tapping its card", async () => {
      await mountView({ canView1: true, viewDepartments: ["מחלקה 1", "מחלקה 2"] });
      expect(lastCall().department).toBe("");
    });

    it("when the server shows only one department it is selected automatically (and stays selected)", async () => {
      const one = { name: "מחלקה 1", total: 3, reported: 3, unreported: 0, counts: { מ: 3 } };
      const people = [{ firstName: "א", lastName: "ב", status: "מ" }];
      getReportView.mockResolvedValueOnce(reply({ departments: [one] }));
      getReportView.mockResolvedValue(reply({ departments: [one], department: "מחלקה 1", details: people }));
      const w = await mountView({ canView1: true, viewDepartments: null });
      expect(lastCall().department).toBe("מחלקה 1");
      expect(w.findAll(".v1-table tbody tr")).toHaveLength(1);
      expect(w.find(".v1-dept").exists()).toBe(false);          // no breakdown for a single department
    });
  });

  describe("summary and details", () => {
    it("shows the overall summary with colored status chips, including zeros and not-reported", async () => {
      const w = await mountView();
      const chips = w.findAll(".v1-section")[0].findAll(".v1-chip").map((c) => c.text());
      expect(chips).toEqual(['סה"כ5', "שוחרר0", "נפקד1", "במוצב2", "אחר1", "לא דווח1"]);
      const redChip = w.findAll(".v1-section")[0].findAll(".v1-chip")[2];
      expect(redChip.attributes("style")).toContain("rgb(153, 27, 27)"); // אדום text
    });

    it("shows a breakdown per department (only non-zero chips)", async () => {
      const w = await mountView();
      const cards = w.findAll(".v1-dept");
      expect(cards).toHaveLength(2);
      expect(cards[0].text()).toContain("מחלקה 1");
      expect(cards[0].text()).toContain("3 אנשים");
      expect(cards[1].findAll(".v1-chip").map((c) => c.text())).toEqual(["נפקד1", "לא דווח1"]);
    });

    it("hides the personnel list and prompts for a department until one is selected", async () => {
      const w = await mountView();
      expect(w.find(".v1-table").exists()).toBe(false);
      expect(w.find(".v1-prompt").text()).toContain("בחרו מחלקה");
    });

    it("tapping a department card requests and shows its personnel; tapping it again deselects it", async () => {
      const people = [
        { firstName: "משה", lastName: "לוי", status: "נ" },
        { firstName: "יוסי", lastName: "בר", status: "" },
        { firstName: "דני", lastName: "כהן", status: "ב" },
      ];
      const w = await mountView();
      getReportView.mockResolvedValue(reply({ department: "מחלקה 2", details: people }));
      await w.findAll(".v1-dept")[1].trigger("click");
      await flushPromises();
      expect(lastCall().department).toBe("מחלקה 2");
      expect(w.find(".v1-prompt").exists()).toBe(false);
      const rows = w.findAll(".v1-table tbody tr").map((r) => [r.find(".v1-person-name").text(), r.find(".v1-status").text()]);
      // sorted by name by default (the server sent them in a different order); unknown code shown as-is
      expect(rows).toEqual([["דני כהן", "ב"], ["יוסי בר", "לא דווח"], ["משה לוי", "נפקד"]]);
      expect(w.findAll(".v1-dept")[1].classes()).toContain("is-selected");
      expect(w.findAll(".v1-dept")[1].attributes("aria-pressed")).toBe("true");

      await w.findAll(".v1-dept")[0].trigger("click");            // another card switches the selection
      await flushPromises();
      expect(lastCall().department).toBe("מחלקה 1");

      getReportView.mockResolvedValue(reply());
      await w.findAll(".v1-dept")[0].trigger("click");            // same card again deselects
      await flushPromises();
      expect(lastCall().department).toBe("");
      expect(w.find(".v1-table").exists()).toBe(false);
      expect(w.find(".v1-prompt").exists()).toBe(true);
    });

    describe("the personnel table and its sorting", () => {
      const people = [
        { firstName: "יוסי", lastName: "בר", status: "" },          // not reported
        { firstName: "דני", lastName: "כהן", status: "מ" },
        { firstName: "אבי", lastName: "לוי", status: "ש" },
        { firstName: "משה", lastName: "גל", status: "נ" },
        { firstName: "חיים", lastName: "רז", status: "ב" },         // code that is not an option -> after the known ones
        { firstName: "בני", lastName: "אור", status: "מ" },
      ];
      const names = (w) => w.findAll(".v1-person-name").map((n) => n.text());
      const open = async () => {
        getReportView.mockResolvedValue(reply({ department: "מחלקה 2", details: people }));
        return mountView({ canView1: true, viewDepartments: ["מחלקה 2"] });
      };
      const header = (w, key) => w.findAll(".v1-th")[key === "name" ? 0 : 1];
      const NAME_ASC = ["אבי לוי", "בני אור", "דני כהן", "חיים רז", "יוסי בר", "משה גל"];

      it("is a table with a row number, name and status column", async () => {
        const w = await open();
        expect(w.find("table.v1-table").exists()).toBe(true);
        expect(w.findAll("thead th").map((h) => h.text().replace(/[▲▼]/g, ""))).toEqual(["#", "שם", "סטטוס"]);
        expect(w.findAll("tbody .v1-col-num").map((c) => c.text())).toEqual(["1", "2", "3", "4", "5", "6"]);
        const first = w.findAll("tbody tr")[0];
        expect(first.find(".v1-status").text()).toBe("שוחרר");
        expect(first.find(".v1-status").attributes("style")).toContain("rgb(55, 65, 81)"); // אפור text
      });

      it("sorts by name ascending by default", async () => {
        const w = await open();
        expect(names(w)).toEqual(NAME_ASC);
        expect(w.findAll("thead th")[1].attributes("aria-sort")).toBe("ascending");
        expect(w.findAll("thead th")[2].attributes("aria-sort")).toBe("none");
        expect(header(w, "name").text()).toContain("▲");
      });

      it("tapping the name header again reverses the order", async () => {
        const w = await open();
        await header(w, "name").trigger("click");
        expect(names(w)).toEqual([...NAME_ASC].reverse());
        expect(w.findAll("thead th")[1].attributes("aria-sort")).toBe("descending");
        expect(header(w, "name").text()).toContain("▼");
      });

      it("sorts by status in the option order (שוחרר, נפקד, במוצב), unknown codes next and not reported last", async () => {
        const w = await open();
        await header(w, "status").trigger("click");
        expect(names(w)).toEqual(["אבי לוי", "משה גל", "בני אור", "דני כהן", "חיים רז", "יוסי בר"]); // ties by name
        expect(w.findAll("thead th")[2].attributes("aria-sort")).toBe("ascending");
        expect(w.findAll("thead th")[1].attributes("aria-sort")).toBe("none");
      });

      it("status descending shows the not-reported people first", async () => {
        const w = await open();
        await header(w, "status").trigger("click");
        await header(w, "status").trigger("click");
        expect(names(w)[0]).toBe("יוסי בר");
        expect(names(w).slice(-1)).toEqual(["אבי לוי"]);
      });

      it("remembers the sort in localStorage and ignores an invalid saved value", async () => {
        const w = await open();
        await header(w, "status").trigger("click");
        await header(w, "status").trigger("click");
        expect(JSON.parse(localStorage.getItem("team_app_view1_sort"))).toEqual({ key: "status", dir: "desc" });
        w.unmount();
        mounted.pop();
        const again = await open();
        expect(again.findAll("thead th")[2].attributes("aria-sort")).toBe("descending");
        again.unmount();
        mounted.pop();
        localStorage.setItem("team_app_view1_sort", "nonsense");
        const bad = await open();
        expect(names(bad)).toEqual(NAME_ASC);
      });

      it("shows no table without a department", async () => {
        const w = await mountView();
        expect(w.find(".v1-table").exists()).toBe(false);
      });
    });

    it("says so when the department has nobody, and when there is no data for the date", async () => {
      getReportView.mockResolvedValue(reply({ hasData: false, department: "מחלקה 2", details: [] }));
      const w = await mountView({ canView1: true, viewDepartments: ["מחלקה 2"] });
      expect(w.find(".v1-nodata").text()).toContain("אין נתוני דיווח לתאריך זה");
      expect(w.text()).toContain("אין חיילים להצגה במחלקה זו");
    });

    it("hides the breakdown when only one department is visible", async () => {
      getReportView.mockResolvedValue(reply({ departments: [{ name: "מחלקה 1", total: 3, reported: 3, unreported: 0, counts: { מ: 3 } }] }));
      const w = await mountView({ canView1: true, viewDepartments: ["מחלקה 1"] });
      expect(w.find(".v1-dept").exists()).toBe(false);
    });
  });

  describe("errors", () => {
    it("shows the server's permission message with a retry button", async () => {
      getReportView.mockResolvedValueOnce({ success: false, isPermissionError: true, error: "אין לך הרשאה לצפות במחלקה: מחלקה 9" });
      const w = await mountView();
      expect(w.find(".v1-alert").text()).toContain("אין לך הרשאה לצפות במחלקה: מחלקה 9");
      expect(w.find(".v1-section").exists()).toBe(false);
      getReportView.mockResolvedValue(reply());
      await w.find(".v1-alert .v1-link").trigger("click");
      await flushPromises();
      expect(w.find(".v1-alert").exists()).toBe(false);
      expect(w.find(".v1-section").exists()).toBe(true);
    });

    it("ignores an out-of-date response when a newer request was made", async () => {
      let resolveFirst;
      getReportView.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", canView1: true, viewDepartments: null }));
      hydrate();
      const w = mount(ReportViewView, { global: { stubs: { AppLayout: layoutStub } } });
      mounted.push(w);
      await flushPromises();
      getReportView.mockResolvedValue(reply({ overall: { total: 9, reported: 9, unreported: 0, counts: { מ: 9 } } }));
      await w.find(".v1-type").setValue("arrival");
      await flushPromises();
      resolveFirst(reply({ overall: { total: 1, reported: 1, unreported: 0, counts: {} } })); // late, stale answer
      await flushPromises();
      expect(w.find(".v1-chip-total").text()).toContain("9");
    });
  });
});
