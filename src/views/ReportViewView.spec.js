import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("../services/api.js", () => ({ getReportView: vi.fn() }));
import { getReportView } from "../services/api.js";
import ReportViewView from "./ReportViewView.vue";
import { STORAGE_KEY, hydrate, logout } from "../lib/auth.js";
import { todayISO, formatSyncDate, formatDate } from "../lib/report1.js";

const OPTIONS = [
  { name: "שוחרר", code: "ש", color: "אפור" },
  { name: "נפקד", code: "נ", color: "אדום" },
  { name: "במוצב", code: "מ", color: "ירוק" },
];
const reply = (extra = {}) => ({
  success: true,
  reportType: "דוח 1",
  date: "",
  department: "",
  hasData: true,
  options: OPTIONS,
  overall: { total: 5, reported: 4, unreported: 1, counts: { מ: 2, נ: 1, ב: 1 } },
  departments: [
    { name: "מחלקה 1", date: "04/10/2026", total: 3, reported: 3, unreported: 0, counts: { מ: 2, ב: 1 } },
    { name: "מחלקה 2", date: "03/10/2026", total: 2, reported: 1, unreported: 1, counts: { נ: 1 } },
  ],
  details: null,
  ...extra,
});

const layoutStub = { props: ["title", "subtitle"], template: "<div><h1>{{ title }}</h1><p class='sub'>{{ subtitle }}</p><slot /></div>" };
const TODAY = formatSyncDate(todayISO());
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

  it("דוח 1 (default): shows a date picker set to today and loads that date once", async () => {
    const w = await mountView();
    expect(w.find("h1").text()).toBe("צפייה בדוח 1");
    expect(w.find(".v1-type").element.value).toBe("report1");
    expect(w.find(".v1-date").exists()).toBe(true);
    expect(w.find(".v1-date").element.value).toBe(todayISO());
    expect(w.find(".sub").text()).toBe(`הדיווח לתאריך ${formatDate(todayISO())}`);
    expect(getReportView).toHaveBeenCalledTimes(1);
    expect(lastCall()).toEqual({ reportType: "דוח 1", date: TODAY, department: "" });
  });

  it("צפי הגעה: no date picker, the latest report of each department is requested without a date", async () => {
    localStorage.setItem("team_app_view1_type", "arrival");
    const w = await mountView();
    expect(w.find(".v1-date").exists()).toBe(false);
    expect(w.findAll(".v1-selectors .v1-field")).toHaveLength(1);
    expect(w.find(".sub").text()).toBe("הדיווח האחרון של כל מחלקה");
    expect(getReportView).toHaveBeenCalledTimes(1);
    expect(lastCall()).toEqual({ reportType: "צפי הגעה", department: "" });
    expect(Object.keys(lastCall())).not.toContain("date");
  });

  describe("the date of דוח 1", () => {
    it("changing the date reloads the report for that date", async () => {
      const w = await mountView();
      await w.find(".v1-date").setValue("2026-09-01");
      await flushPromises();
      expect(lastCall()).toEqual({ reportType: "דוח 1", date: "01/09/2026", department: "" });
      expect(w.find(".sub").text()).toBe("הדיווח לתאריך 01.09.2026");
      expect(w.find(".v1-note").text()).toBe("לפי הדיווח בתאריך 01/09/2026");
      expect(getReportView).toHaveBeenCalledTimes(2);
    });

    it("any date can be picked (past or future) and a cleared picker falls back to today", async () => {
      const w = await mountView();
      expect(w.find(".v1-date").attributes("min")).toBeUndefined();
      await w.find(".v1-date").setValue("2999-01-01");
      await flushPromises();
      expect(lastCall().date).toBe("01/01/2999");
      await w.find(".v1-date").setValue("");
      await flushPromises();
      expect(w.find(".v1-date").element.value).toBe(todayISO());
      expect(lastCall().date).toBe(TODAY);
    });

    it("a department with no report on that date says so, and the page explains when nothing exists for it", async () => {
      getReportView.mockResolvedValue(reply({
        hasData: false,
        departments: [{ name: "מחלקה 1", date: "", total: 3, reported: 0, unreported: 3, counts: {} }, { name: "מחלקה 2", date: "", total: 2, reported: 0, unreported: 2, counts: {} }],
      }));
      const w = await mountView();
      expect(w.find(".v1-nodata").text()).toBe("אין נתוני דיווח לתאריך זה.");
      expect(w.findAll(".v1-dept-date").map((d) => d.text())).toEqual(["אין דיווח בתאריך זה", "אין דיווח בתאריך זה"]);
    });

    it("the status filter and the department list are for the chosen date", async () => {
      const w = await mountView();
      await w.find(".v1-date").setValue("2026-09-01");
      await flushPromises();
      const chip = w.findAll(".v1-section")[0].findAll(".v1-chip").find((c) => c.text().startsWith("במוצב"));
      await chip.trigger("click");
      await flushPromises();
      expect(lastCall()).toEqual({ reportType: "דוח 1", date: "01/09/2026", department: "", status: "מ" });
      await chip.trigger("click");
      await w.findAll(".v1-dept")[1].trigger("click");
      await flushPromises();
      expect(lastCall()).toEqual({ reportType: "דוח 1", date: "01/09/2026", department: "מחלקה 2" });
    });

    it("switching to צפי הגעה drops the date, switching back brings the chosen date back", async () => {
      const w = await mountView();
      await w.find(".v1-date").setValue("2026-09-01");
      await flushPromises();
      await w.find(".v1-type").setValue("arrival");
      await flushPromises();
      expect(w.find(".v1-date").exists()).toBe(false);
      expect(lastCall()).toEqual({ reportType: "צפי הגעה", department: "" });
      await w.find(".v1-type").setValue("report1");
      await flushPromises();
      expect(w.find(".v1-date").element.value).toBe("2026-09-01");
      expect(lastCall()).toEqual({ reportType: "דוח 1", date: "01/09/2026", department: "" });
    });

    it("always opens on today (the date is not remembered)", async () => {
      const w = await mountView();
      await w.find(".v1-date").setValue("2026-09-01");
      await flushPromises();
      w.unmount();
      mounted.pop();
      const again = await mountView();
      expect(again.find(".v1-date").element.value).toBe(todayISO());
    });
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

  describe("choosing a department", () => {
    it("has no department dropdown (the report type, plus the date for דוח 1)", async () => {
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

    it("צפי הגעה: shows each department's own report date on its card, and 'אין דיווח' when it has none", async () => {
      localStorage.setItem("team_app_view1_type", "arrival");
      getReportView.mockResolvedValue(reply({
        departments: [
          { name: "מחלקה 1", date: "04/10/2026", total: 3, reported: 3, unreported: 0, counts: { מ: 3 } },
          { name: "מחלקה 2", date: "03/10/2026", total: 2, reported: 2, unreported: 0, counts: { נ: 2 } },
          { name: "מחלקה 3", date: "", total: 4, reported: 0, unreported: 4, counts: {} },
        ],
      }));
      const w = await mountView();
      expect(w.findAll(".v1-dept-date").map((d) => d.text())).toEqual(["נכון ל-04/10/2026", "נכון ל-03/10/2026", "אין דיווח"]);
      expect(w.find(".v1-note").text()).toBe("לפי הדיווח האחרון של כל מחלקה");
    });

    it("shows the selected department's date next to the personnel heading", async () => {
      const w = await mountView();
      getReportView.mockResolvedValue(reply({ department: "מחלקה 2", details: [{ firstName: "משה", lastName: "לוי", status: "נ" }] }));
      await w.findAll(".v1-dept")[1].trigger("click");
      await flushPromises();
      expect(w.find(".v1-h2-date").text()).toBe("נכון ל-03/10/2026");
      getReportView.mockResolvedValue(reply({ department: "מחלקה 1", details: [{ firstName: "משה", lastName: "לוי", status: "נ" }] }));
      await w.findAll(".v1-dept")[0].trigger("click");
      await flushPromises();
      expect(w.find(".v1-h2-date").text()).toBe("נכון ל-04/10/2026");
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
        { firstName: "יוסי", lastName: "בר", status: "", note: "" },          // not reported
        { firstName: "דני", lastName: "כהן", status: "מ", note: "מגיע באיחור - עומס בכבישים" },
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

      it("is a table with a row number, name, status and comments column", async () => {
        const w = await open();
        expect(w.find("table.v1-table").exists()).toBe(true);
        expect(w.findAll("thead th").map((h) => h.text().replace(/[▲▼]/g, ""))).toEqual(["#", "שם", "סטטוס", "הערות"]);
        expect(w.findAll("tbody .v1-col-num").map((c) => c.text())).toEqual(["1", "2", "3", "4", "5", "6"]);
        const first = w.findAll("tbody tr")[0];
        expect(first.find(".v1-status").text()).toBe("שוחרר");
        expect(first.find(".v1-status").attributes("style")).toContain("rgb(55, 65, 81)"); // אפור text
      });

      it("shows each person's comment in the last column (empty when there is none), and it follows the sorting", async () => {
        const w = await open();
        const noteOf = (name) => w.findAll("tbody tr").find((r) => r.find(".v1-person-name").text() === name).find("td.v1-col-note").text();
        expect(noteOf("דני כהן")).toBe("מגיע באיחור - עומס בכבישים");
        expect(noteOf("יוסי בר")).toBe("");
        expect(noteOf("משה גל")).toBe("");                                  // a person without a note field at all
        const cells = w.findAll("tbody tr")[0].findAll("td");
        expect(cells[cells.length - 1].classes()).toContain("v1-col-note");  // last column
        await header(w, "name").trigger("click");                           // descending: the comment stays with its person
        expect(noteOf("דני כהן")).toBe("מגיע באיחור - עומס בכבישים");
        expect(w.findAll("thead th")[3].find("button").exists()).toBe(false); // the comments column is not sortable
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

    it("says so when the department has nobody, and when there is no report for the date", async () => {
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

  describe("filtering by status (tap a chip in the overall summary)", () => {
    const PEOPLE = [
      { firstName: "דני", lastName: "כהן", status: "מ", note: "מגיע באיחור", department: "מחלקה 2", date: "03/10/2026" },
      { firstName: "אבי", lastName: "לוי", status: "מ", note: "", department: "מחלקה 1", date: "04/10/2026" },
      { firstName: "בני", lastName: "אור", status: "מ", note: "", department: "מחלקה 1", date: "04/10/2026" },
    ];
    const chip = (w, label) => w.findAll(".v1-section")[0].findAll(".v1-chip").find((c) => c.text().startsWith(label));
    const filtered = (people = PEOPLE, status = "מ") => reply({ people });
    const names = (w) => w.findAll(".v1-person-name").map((n) => n.text());

    it("the summary chips are toggle buttons, none selected at first", async () => {
      const w = await mountView();
      const chips = w.findAll(".v1-section")[0].findAll(".v1-chip");
      expect(chips.length).toBeGreaterThan(3);
      expect(chips.every((c) => c.element.tagName === "BUTTON" && c.attributes("aria-pressed") === "false")).toBe(true);
    });

    it("tapping a status asks for that status, hides 'לפי מחלקה' and lists the people of all departments", async () => {
      const w = await mountView();
      getReportView.mockResolvedValue(filtered());
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      expect(lastCall()).toEqual({ reportType: "דוח 1", date: TODAY, department: "", status: "מ" });
      expect(w.find(".v1-dept").exists()).toBe(false);                               // the department breakdown is hidden
      expect(w.find('[aria-label="לפי מחלקה"]').exists()).toBe(false);
      expect(chip(w, "במוצב").classes()).toContain("is-active");
      expect(chip(w, "במוצב").attributes("aria-pressed")).toBe("true");
      expect(w.find(".v1-section-head h2").text()).toContain("במוצב");
      expect(w.find(".v1-section-head h2").text()).toContain("3 חיילים");
      // a department column appears, and every row names its department
      expect(w.findAll("thead th").map((h) => h.text().replace(/[▲▼]/g, ""))).toEqual(["#", "שם", "מחלקה", "סטטוס", "הערות"]);
      expect(names(w)).toEqual(["אבי לוי", "בני אור", "דני כהן"]);
      expect(w.findAll(".v1-col-dept").map((c) => c.text())).toEqual(["מחלקה 1", "מחלקה 1", "מחלקה 2"]);
      expect(w.findAll("td.v1-col-note").map((c) => c.text())).toEqual(["", "", "מגיע באיחור"]);
    });

    it("tapping the same chip again goes back to the default view", async () => {
      const w = await mountView();
      getReportView.mockResolvedValue(filtered());
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      getReportView.mockResolvedValue(reply());
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      expect(Object.keys(lastCall())).not.toContain("status");
      expect(w.findAll(".v1-dept")).toHaveLength(2);                                 // 'לפי מחלקה' is back
      expect(w.find(".v1-table").exists()).toBe(false);
      expect(w.find(".v1-prompt").exists()).toBe(true);
      expect(chip(w, "במוצב").classes()).not.toContain("is-active");
    });

    it("the 'הצג לפי מחלקה' link also returns to the default view", async () => {
      const w = await mountView();
      getReportView.mockResolvedValue(filtered());
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      getReportView.mockResolvedValue(reply());
      await w.find(".v1-clear").trigger("click");
      await flushPromises();
      expect(w.findAll(".v1-dept")).toHaveLength(2);
      expect(w.find(".v1-clear").exists()).toBe(false);
    });

    it("tapping another chip switches the filter", async () => {
      const w = await mountView();
      getReportView.mockResolvedValue(filtered());
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      await chip(w, "נפקד").trigger("click");
      await flushPromises();
      expect(lastCall().status).toBe("נ");
      expect(chip(w, "נפקד").classes()).toContain("is-active");
      expect(chip(w, "במוצב").classes()).not.toContain("is-active");
    });

    it("סה\"כ lists everyone, 'לא דווח' the unreported, 'אחר' the unknown codes", async () => {
      const w = await mountView();
      getReportView.mockResolvedValue(filtered([]));
      await chip(w, 'סה"כ').trigger("click");
      await flushPromises();
      expect(lastCall().status).toBe("*");
      expect(w.find(".v1-section-head h2").text()).toContain("כל החיילים");
      await chip(w, 'סה"כ').trigger("click");
      await chip(w, "לא דווח").trigger("click");
      await flushPromises();
      expect(lastCall().status).toBe("__unreported");
      expect(w.find(".v1-section-head h2").text()).toContain("לא דווח");
      await chip(w, "לא דווח").trigger("click");
      await chip(w, "אחר").trigger("click");
      await flushPromises();
      expect(lastCall().status).toBe("__other");
    });

    it("says so when nobody has that status", async () => {
      const w = await mountView();
      getReportView.mockResolvedValue(filtered([]));
      await chip(w, "שוחרר").trigger("click");
      await flushPromises();
      expect(w.text()).toContain("אין חיילים בסטטוס זה.");
    });

    it("selecting a status clears a selected department, and un-selecting does not bring it back", async () => {
      const w = await mountView();
      getReportView.mockResolvedValue(reply({ department: "מחלקה 2", details: [{ firstName: "א", lastName: "ב", status: "מ", note: "" }] }));
      await w.findAll(".v1-dept")[1].trigger("click");
      await flushPromises();
      expect(lastCall().department).toBe("מחלקה 2");
      getReportView.mockResolvedValue(filtered());
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      expect(lastCall()).toEqual({ reportType: "דוח 1", date: TODAY, department: "", status: "מ" });   // one request, no department
      getReportView.mockResolvedValue(reply());
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      expect(lastCall().department).toBe("");
      expect(w.find(".v1-prompt").exists()).toBe(true);
    });

    it("a user limited to one department gets that department back after clearing the filter", async () => {
      getReportView.mockResolvedValue(reply({ department: "מחלקה 2", details: [] }));
      const w = await mountView({ canView1: true, viewDepartments: ["מחלקה 2"] });
      expect(lastCall().department).toBe("מחלקה 2");
      getReportView.mockResolvedValue(filtered());
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      expect(lastCall()).toEqual({ reportType: "דוח 1", date: TODAY, department: "", status: "מ" });
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      expect(lastCall()).toEqual({ reportType: "דוח 1", date: TODAY, department: "מחלקה 2" });
    });

    it("switching the report type drops the status filter (the codes differ between reports)", async () => {
      const w = await mountView();
      getReportView.mockResolvedValue(filtered());
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      getReportView.mockResolvedValue(reply());
      await w.find(".v1-type").setValue("arrival");
      await flushPromises();
      expect(lastCall()).toEqual({ reportType: "צפי הגעה", department: "" });
      expect(w.findAll(".v1-dept")).toHaveLength(2);
    });

    it("can be sorted by department (the extra column), and that sort falls back to name in the department view", async () => {
      const w = await mountView();
      getReportView.mockResolvedValue(filtered());
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      await w.findAll(".v1-th")[1].trigger("click");                                 // 'מחלקה' header
      expect(w.findAll(".v1-col-dept").map((c) => c.text())).toEqual(["מחלקה 1", "מחלקה 1", "מחלקה 2"]);
      expect(names(w)).toEqual(["אבי לוי", "בני אור", "דני כהן"]);                    // ties by name
      await w.findAll(".v1-th")[1].trigger("click");                                 // reverse
      expect(w.findAll(".v1-col-dept").map((c) => c.text())).toEqual(["מחלקה 2", "מחלקה 1", "מחלקה 1"]);
      // back in the default view the department sort does not apply: the table (department view) sorts by name
      getReportView.mockResolvedValue(reply({ department: "מחלקה 2", details: [{ firstName: "תמר", lastName: "ג", status: "נ", note: "" }, { firstName: "אבי", lastName: "ד", status: "נ", note: "" }] }));
      await chip(w, "במוצב").trigger("click");
      await w.findAll(".v1-dept")[1].trigger("click");
      await flushPromises();
      expect(w.findAll("thead th").map((h) => h.text().replace(/[▲▼]/g, ""))).toEqual(["#", "שם", "סטטוס", "הערות"]);
      expect(names(w)).toEqual(["אבי ד", "תמר ג"]);
    });

    it("shows loading on the tapped chip, in the list area and in the progress bar", async () => {
      const w = await mountView();
      let finish;
      getReportView.mockImplementationOnce(() => new Promise((r) => { finish = r; }));
      await chip(w, "במוצב").trigger("click");
      await flushPromises();
      expect(w.find(".v1-progress").exists()).toBe(true);
      expect(chip(w, "במוצב").find(".v1-spinner").exists()).toBe(true);
      expect(chip(w, "נפקד").find(".v1-spinner").exists()).toBe(false);
      expect(w.find(".v1-loading").exists()).toBe(true);
      expect(w.find(".v1-table").exists()).toBe(false);
      finish(filtered());
      await flushPromises();
      expect(w.find(".v1-progress").exists()).toBe(false);
      expect(chip(w, "במוצב").find(".v1-spinner").exists()).toBe(false);
      expect(w.findAll(".v1-table tbody tr")).toHaveLength(3);
    });
  });

  describe("loading indication", () => {
    // a request the test can finish whenever it wants
    const pending = () => {
      let resolve;
      const promise = new Promise((r) => { resolve = r; });
      getReportView.mockImplementationOnce(() => promise);
      return resolve;
    };

    it("shows a progress bar while the first load runs and removes it afterwards", async () => {
      const finish = pending();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", canView1: true, viewDepartments: null }));
      hydrate();
      const w = mount(ReportViewView, { global: { stubs: { AppLayout: layoutStub } } });
      mounted.push(w);
      await flushPromises();
      expect(w.find(".v1-progress").exists()).toBe(true);
      expect(w.find(".v1-state").text()).toBe("טוען…");
      finish(reply());
      await flushPromises();
      expect(w.find(".v1-progress").exists()).toBe(false);
    });

    it("tapping a department card shows loading on the card, in the list area and in the progress bar", async () => {
      const w = await mountView();
      expect(w.find(".v1-progress").exists()).toBe(false);
      const finish = pending();
      await w.findAll(".v1-dept")[1].trigger("click");
      await flushPromises();
      // while the request is open
      expect(w.find(".v1-progress").exists()).toBe(true);
      expect(w.findAll(".v1-dept")[1].find(".v1-spinner").exists()).toBe(true);   // the tapped card
      expect(w.findAll(".v1-dept")[0].find(".v1-spinner").exists()).toBe(false);  // not the others
      expect(w.find(".v1-loading").text()).toContain("טוען את רשימת החיילים");
      expect(w.find(".v1-table").exists()).toBe(false);                            // no stale list meanwhile
      expect(w.find(".v1-prompt").exists()).toBe(false);
      // once it arrives
      finish(reply({ department: "מחלקה 2", details: [{ firstName: "משה", lastName: "לוי", status: "נ", note: "" }] }));
      await flushPromises();
      expect(w.find(".v1-progress").exists()).toBe(false);
      expect(w.find(".v1-spinner").exists()).toBe(false);
      expect(w.find(".v1-loading").exists()).toBe(false);
      expect(w.findAll(".v1-table tbody tr")).toHaveLength(1);
    });

    it("changing the report type shows the progress bar while the new report loads, keeping the old data visible", async () => {
      const w = await mountView();
      const finish = pending();
      await w.find(".v1-type").setValue("arrival");
      await flushPromises();
      expect(w.find(".v1-progress").exists()).toBe(true);
      expect(w.findAll(".v1-dept")).toHaveLength(2);                               // previous summary still on screen
      finish(reply());
      await flushPromises();
      expect(w.find(".v1-progress").exists()).toBe(false);
    });

    it("the loading indication also ends when the request fails", async () => {
      const w = await mountView();
      const finish = pending();
      await w.findAll(".v1-dept")[0].trigger("click");
      await flushPromises();
      expect(w.find(".v1-progress").exists()).toBe(true);
      finish({ success: false, error: "שגיאה" });
      await flushPromises();
      expect(w.find(".v1-progress").exists()).toBe(false);
      expect(w.find(".v1-alert").text()).toContain("שגיאה");
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
