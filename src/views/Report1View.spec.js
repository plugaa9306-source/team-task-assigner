import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";

const list = ref([
  { id: "1", idNum: "", firstName: "דוד", lastName: "כהן", phone: "050-123-4567", unit: "מחלקה 1", tabName: "" },
  { id: "2", idNum: "", firstName: "משה", lastName: "לוי", phone: "", unit: "מחלקה 1", tabName: "" },
  { id: "3", idNum: "", firstName: "יוסי", lastName: "בר", phone: "", unit: "מחלקה 2", tabName: "" },
]);
vi.mock("../lib/soldiers.js", async (orig) => ({
  ...(await orig()),
  useSoldiers: () => ({ soldiersList: list, isLoading: ref(false), error: ref(""), units: ref(["מחלקה 1", "מחלקה 2"]), load: vi.fn() }),
}));
vi.mock("../services/api.js", () => ({ getReportOptions: vi.fn(), syncReportInBackground: vi.fn() }));
import { getReportOptions, syncReportInBackground } from "../services/api.js";
import Report1View from "./Report1View.vue";
import { STORAGE_KEY, hydrate, logout } from "../lib/auth.js";
import { todayISO } from "../lib/report1.js";

const OPTIONS = {
  success: true,
  data: {
    report1: [
      { name: "שוחרר", code: "ש", color: "אפור" }, { name: "נפקד", code: "נ", color: "אדום" }, { name: "במוצב", code: "מ", color: "ירוק" },
      { name: "בבית", code: "ב", color: "כתום" }, { name: 'בחו"ל', code: "ח", color: "בורדו" },
    ],
    arrivalForecast: [
      { name: "שוחרר", code: "ש", color: "אפור" }, { name: "נפקד", code: "נ", color: "אדום" }, { name: "מגיע", code: "מ", color: "צהוב" }, { name: "בבדיקה", code: "ב", color: "תכלת" },
    ],
  },
};

const layoutStub = { props: ["title", "subtitle"], template: "<div><h1>{{ title }}</h1><slot /></div>" };

async function mountView({ canEdit = true, pickUnit = true, access = {} } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", canEdit, canReport1: true, ...access }));
  hydrate();
  const w = mount(Report1View, { global: { stubs: { AppLayout: layoutStub } } });
  await flushPromises();
  if (pickUnit) await w.find(".r1-unit").setValue("מחלקה 1");
  return w;
}
const kpis = (w) => w.findAll(".r1-kpi-num").map((n) => n.text());
const optionLabels = (sel) => sel.findAll("option").map((o) => o.text());

describe("Report1View", () => {
  beforeEach(() => {
    localStorage.clear();
    logout();
    getReportOptions.mockReset().mockResolvedValue(OPTIONS);
    syncReportInBackground.mockReset();
  });

  it("defaults to דו\"ח 1 and today, with no unit selected and nobody listed", async () => {
    const w = await mountView({ pickUnit: false });
    expect(w.find("h1").text()).toBe('דו"ח 1');
    expect(w.find(".r1-date").element.value).toBe(todayISO());
    expect(w.find(".r1-date").attributes("min")).toBe(todayISO());
    expect(w.find(".r1-unit").element.value).toBe("");
    expect(w.findAll(".r1-row")).toHaveLength(0);
  });

  it("remembers the last fill (type, platoon, statuses, notes) after a reload, but not the date", async () => {
    const w = await mountView();
    await w.find(".r1-field select").setValue("arrival");
    await w.findAll(".r1-status")[0].setValue("מ");
    await w.findAll(".r1-note-input")[0].setValue("08:30");
    w.unmount();

    // reload: same storage, fresh component
    const again = mount(Report1View, { global: { stubs: { AppLayout: layoutStub } } });
    await flushPromises();
    expect(again.find("h1").text()).toBe("צפי הגעה");
    expect(again.find(".r1-unit").element.value).toBe("מחלקה 1");
    expect(again.find(".r1-date").element.value).toBe(todayISO()); // date not remembered
    expect(again.findAll(".r1-status")[0].element.value).toBe("מ");
    expect(again.findAll(".r1-note-input")[0].element.value).toBe("08:30");
  });

  it("requests the options once on mount and renders a counter per option of the active report", async () => {
    const w = await mountView();
    expect(getReportOptions).toHaveBeenCalledTimes(1);
    const labels = () => w.findAll(".r1-kpi-label").map((l) => l.text());
    expect(labels()).toEqual(['סה"כ', "שוחרר", "נפקד", "במוצב", "בבית", 'בחו"ל', "לא דווח"]);
    await w.find(".r1-field select").setValue("arrival");
    expect(labels()).toEqual(['סה"כ', "שוחרר", "נפקד", "מגיע", "בבדיקה", "לא דווח"]);
  });

  it("tints counters, the chosen dropdown and the row with the server's status colors", async () => {
    const w = await mountView();
    const counters = w.findAll(".r1-kpi-status");
    expect(counters[1].attributes("style")).toContain("rgb(153, 27, 27)"); // נפקד -> אדום text
    expect(counters[4].attributes("style")).toContain("rgb(122, 0, 25)"); // בחו"ל -> בורדו text
    expect(counters[1].attributes("style")).not.toContain("background");
    const select = w.findAll(".r1-status")[0];
    expect(select.attributes("style") ?? "").not.toContain("color");
    await select.setValue("מ"); // במוצב -> ירוק
    expect(w.findAll(".r1-status")[0].attributes("style")).toContain("rgb(22, 101, 52)");
    expect(w.findAll(".r1-status")[0].attributes("style")).not.toContain("background");
    expect(w.findAll(".r1-row")[0].attributes("style")).toContain("border-inline-start-color");
    expect(w.findAll(".r1-row")[1].attributes("style") ?? "").not.toContain("border-inline-start-color");
    await w.find(".r1-field select").setValue("arrival"); // same code, different report -> yellow
    await w.findAll(".r1-status")[0].setValue("מ");
    expect(w.findAll(".r1-status")[0].attributes("style")).toContain("rgb(133, 77, 14)");
  });

  it("caches the options in localStorage and skips the request when they are cached", async () => {
    const first = await mountView();
    expect(getReportOptions).toHaveBeenCalledTimes(1);
    const cached = JSON.parse(localStorage.getItem("team_app_report_options"));
    expect(cached.report1.map((o) => o.label)).toEqual(["שוחרר", "נפקד", "במוצב", "בבית", 'בחו"ל']);
    expect(cached.report1[1].color).toBe("אדום");
    first.unmount();

    getReportOptions.mockClear();
    const again = await mountView();
    expect(getReportOptions).not.toHaveBeenCalled();
    expect(again.findAll(".r1-status option").map((o) => o.text())).toContain('בחו"ל');
    expect(again.find(".r1-status").attributes("disabled")).toBeUndefined();
  });

  it("does not cache a failed request", async () => {
    getReportOptions.mockResolvedValue({ success: false, error: "boom" });
    await mountView({ pickUnit: false });
    expect(localStorage.getItem("team_app_report_options")).toBeNull();
  });

  it("puts name on the start side and call / WhatsApp circle buttons beside it", async () => {
    const w = await mountView();
    const head = w.findAll(".r1-row-head")[0];
    expect(head.element.children[0].classList.contains("r1-name")).toBe(true); // name first => right side in RTL
    expect(w.find(".r1-check").exists()).toBe(false); // no selection checkboxes on this screen
    const call = head.find(".r1-call");
    expect(call.attributes("href")).toBe("tel:0501234567");
    expect(call.attributes("title")).toBe("חייג");
    expect(call.attributes("aria-label")).toContain("חייג");
    const wa = head.find(".r1-wa-chat");
    expect(wa.attributes("href")).toBe("https://wa.me/972501234567");
    expect(wa.attributes("target")).toBe("_blank");
    expect(wa.attributes("rel")).toContain("noopener");
    expect(wa.attributes("title")).toBe("שלח הודעה בוואטסאפ");
    // a soldier with no phone number gets no action buttons
    expect(w.findAll(".r1-row-head")[1].find(".r1-quick").exists()).toBe(false);
  });

  it("a status chosen under one report is not carried into the other", async () => {
    const w = await mountView();
    await w.findAll(".r1-status")[0].setValue("ח"); // בחו"ל exists only in דו"ח 1
    await w.find(".r1-field select").setValue("arrival");
    expect(w.findAll(".r1-status")[0].element.value).toBe("");
    expect(kpis(w).at(-1)).toBe("2"); // everyone unreported
  });

  it("shows an error and disables the controls when the options fail to load", async () => {
    getReportOptions.mockResolvedValue({ success: false, error: "boom" });
    localStorage.setItem("team_app_report1", JSON.stringify({ type: "report1", unit: "מחלקה 1", store: {} }));
    const w = await mountView({ pickUnit: false });
    expect(w.find(".r1-alert").text()).toContain("boom");
    expect(w.find(".r1-status").attributes("disabled")).toBeDefined();
    expect(w.find(".r1-note-input").attributes("disabled")).toBeDefined();
    expect(w.find(".r1-date").attributes("disabled")).toBeDefined();
    expect(w.find(".r1-wa").attributes("disabled")).toBeDefined();
  });

  it("reads lists that sit at the top level of the reply", async () => {
    getReportOptions.mockResolvedValue({ success: true, ...OPTIONS.data });
    const w = await mountView();
    expect(w.find(".r1-alert").exists()).toBe(false);
    expect(w.findAll(".r1-status option").length).toBeGreaterThan(1);
  });

  it("flags a successful reply that contains no options", async () => {
    getReportOptions.mockResolvedValue({ success: true, data: {} });
    localStorage.setItem("team_app_report1", JSON.stringify({ type: "report1", unit: "מחלקה 1", store: {} }));
    const w = await mountView({ pickUnit: false });
    expect(w.find(".r1-alert").text()).toContain("לא החזיר אפשרויות");
    expect(w.find(".r1-status").attributes("disabled")).toBeDefined();
  });

  it("treats an authorization error the same way and can retry", async () => {
    getReportOptions.mockResolvedValue({ success: false, isAuthError: true, error: "x" });
    localStorage.setItem("team_app_report1", JSON.stringify({ type: "report1", unit: "מחלקה 1", store: {} }));
    const w = await mountView({ pickUnit: false });
    expect(w.find(".r1-alert").exists()).toBe(true);
    expect(w.find(".r1-status").attributes("disabled")).toBeDefined();
    getReportOptions.mockResolvedValue(OPTIONS);
    await w.find(".r1-alert .r1-link").trigger("click");
    await flushPromises();
    expect(w.find(".r1-alert").exists()).toBe(false);
    expect(w.find(".r1-status").attributes("disabled")).toBeUndefined();
  });

  it("offers the statuses of the selected report type", async () => {
    const w = await mountView();
    const status = () => w.find(".r1-status");
    expect(optionLabels(status()).slice(1)).toEqual(["שוחרר", "נפקד", "במוצב", "בבית", 'בחו"ל']);
    expect(status().element.value).toBe(""); // nothing preselected
    await w.find(".r1-field select").setValue("arrival");
    expect(w.find("h1").text()).toBe("צפי הגעה");
    expect(optionLabels(status()).slice(1)).toEqual(["שוחרר", "נפקד", "מגיע", "בבדיקה"]);
  });

  it("rejects past dates and accepts future ones", async () => {
    const w = await mountView();
    const input = w.find(".r1-date");
    input.element.value = "2000-01-01";
    await input.trigger("change");
    expect(input.element.value).toBe(todayISO());
    input.element.value = "2999-01-01";
    await input.trigger("change");
    expect(w.find(".r1-date").element.value).toBe("2999-01-01");
  });

  it("counts only the selected unit and updates as statuses change", async () => {
    const w = await mountView();
    // total, 5 options, unreported
    expect(kpis(w)).toEqual(["2", "0", "0", "0", "0", "0", "2"]);
    await w.findAll(".r1-status")[0].setValue("מ");
    expect(kpis(w)).toEqual(["2", "0", "0", "1", "0", "0", "1"]);
    await w.find(".r1-unit").setValue("מחלקה 2");
    expect(kpis(w)[0]).toBe("1");
  });

  it("keeps edits separate per report type and date", async () => {
    const w = await mountView();
    await w.findAll(".r1-status")[0].setValue("מ");
    await w.find(".r1-field select").setValue("arrival");
    expect(w.findAll(".r1-status")[0].element.value).toBe("");
    await w.find(".r1-field select").setValue("report1");
    expect(w.findAll(".r1-status")[0].element.value).toBe("מ");
  });

  it("shows a live preview in a pop-up toggled from the footer and sends it via WhatsApp", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const w = await mountView();
    const shown = () => !(w.find(".r1-preview").attributes("style") ?? "").includes("display: none");
    expect(shown()).toBe(false);
    const toggle = w.find(".r1-preview-btn");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    await w.findAll(".r1-status")[0].setValue("מ");
    await w.findAll(".r1-note-input")[0].setValue("שומר");
    await toggle.trigger("click");
    expect(shown()).toBe(true);
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(w.find(".r1-preview-text").text()).toContain("• דוד כהן - במוצב (שומר)");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await w.vm.$nextTick();
    expect(shown()).toBe(false);
    await w.find(".r1-wa").trigger("click");
    const text = decodeURIComponent(open.mock.calls[0][0]);
    expect(text).toContain('דו"ח 1 – מחלקה 1');
    open.mockRestore();
  });

  describe("department dropdown lists only what the user may update", () => {
    const unitOptions = (w) => w.findAll(".r1-unit option").slice(1).map((o) => o.text());

    it("all departments when canUpdate1 is TRUE", async () => {
      const w = await mountView({ pickUnit: false, access: { canUpdate1: true, updateDepartments: null } });
      expect(unitOptions(w)).toEqual(["מחלקה 1", "מחלקה 2"]);
    });

    it("only the listed departments (matched loosely, e.g. 'מחלקה1')", async () => {
      const w = await mountView({ pickUnit: false, access: { canUpdate1: true, updateDepartments: ["מחלקה1"] } });
      expect(unitOptions(w)).toEqual(["מחלקה 1"]);
      expect(w.find(".r1-unit").attributes("disabled")).toBeDefined(); // a single option is locked (see below)
    });

    it("nothing, with a disabled dropdown and a message, when the user may not update anything", async () => {
      const w = await mountView({ pickUnit: false, access: { canUpdate1: false, updateDepartments: [] } });
      expect(unitOptions(w)).toEqual([]);
      expect(w.find(".r1-unit").attributes("disabled")).toBeDefined();
      expect(w.find(".r1-unit option").text()).toBe("אין מחלקות לעדכון");
    });

    it("selects the only allowed department automatically and locks the dropdown", async () => {
      const w = await mountView({ pickUnit: false, access: { canUpdate1: true, updateDepartments: ["מחלקה 1"] } });
      expect(w.find(".r1-unit").element.value).toBe("מחלקה 1");
      expect(w.find(".r1-unit").attributes("disabled")).toBeDefined();
      expect(w.find(".r1-unit").classes()).toContain("is-locked");
      expect(w.findAll(".r1-row")).toHaveLength(2);                 // the soldiers of that department are already listed
      expect(w.findAll(".r1-kpi-num")[0].text()).toBe("2");
    });

    it("the lone department wins over a different remembered one", async () => {
      localStorage.setItem("team_app_report1", JSON.stringify({ type: "report1", unit: "מחלקה 2", store: {} }));
      const w = await mountView({ pickUnit: false, access: { canUpdate1: true, updateDepartments: ["מחלקה 1"] } });
      expect(w.find(".r1-unit").element.value).toBe("מחלקה 1");
    });

    it("keeps the dropdown enabled and unselected when there are several allowed departments", async () => {
      const w = await mountView({ pickUnit: false, access: { canUpdate1: true, updateDepartments: ["מחלקה 1", "מחלקה 2"] } });
      expect(w.find(".r1-unit").element.value).toBe("");
      expect(w.find(".r1-unit").attributes("disabled")).toBeUndefined();
      expect(w.find(".r1-unit").classes()).not.toContain("is-locked");
    });

    it("a user with access to all departments still picks one (two exist), nothing is preselected", async () => {
      const w = await mountView({ pickUnit: false, access: { canUpdate1: true, updateDepartments: null } });
      expect(w.find(".r1-unit").element.value).toBe("");
    });

    it("forgets a remembered department the user may no longer update", async () => {
      localStorage.setItem("team_app_report1", JSON.stringify({ type: "report1", unit: "מחלקה 3", store: {} }));
      const w = await mountView({ pickUnit: false, access: { canUpdate1: true, updateDepartments: ["מחלקה 1", "מחלקה 2"] } });
      expect(w.find(".r1-unit").element.value).toBe("");
      expect(w.findAll(".r1-row")).toHaveLength(0);
    });
  });

  it("opens WhatsApp first and then syncs the report to the sheet in the background", async () => {
    const order = [];
    const open = vi.spyOn(window, "open").mockImplementation(() => { order.push("open"); return null; });
    syncReportInBackground.mockImplementation(() => order.push("sync"));
    const w = await mountView();
    await w.findAll(".r1-status")[0].setValue("מ");
    await w.findAll(".r1-status")[1].setValue("ב");
    await w.find(".r1-wa").trigger("click");
    expect(order).toEqual(["open", "sync"]); // WhatsApp first, sync second, nothing awaited
    const payload = syncReportInBackground.mock.calls[0][0];
    expect(payload).toEqual({
      reportType: "דוח 1",
      department: "מחלקה 1",
      date: payload.date,
      reports: [
        { firstName: "דוד", lastName: "כהן", status: "מ" },
        { firstName: "משה", lastName: "לוי", status: "ב" },
      ],
    });
    expect(payload.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(w.find(".r1-alert").exists()).toBe(false); // no UI feedback for the sync
    open.mockRestore();
  });

  it("uses the arrival forecast name in the sync payload", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const w = await mountView();
    await w.find(".r1-field select").setValue("arrival");
    await w.findAll(".r1-status")[0].setValue("מ");
    await w.find(".r1-wa").trigger("click");
    expect(syncReportInBackground.mock.calls[0][0].reportType).toBe("צפי הגעה");
    open.mockRestore();
  });

  it("labels the send button 'שלח דוח'", async () => {
    const w = await mountView();
    expect(w.find(".r1-wa").text()).toBe("שלח דוח");
  });

  it("uses a compact layout: header, one-row selectors, one-line counters, merged footer", async () => {
    const w = await mountView();
    expect(w.findAll(".r1-selectors > .r1-field")).toHaveLength(3);          // type, date, platoon in one grid row
    expect(w.find(".r1-selectors").element.parentElement.querySelector(".r1-field-wide")).toBeNull(); // no field wraps onto its own line
    expect(w.find(".r1-kpis").element.className).toBe("r1-kpis");           // flex row of chips that wraps when full
    expect(w.findAll(".r1-kpi").every((k) => k.find(".r1-kpi-label").exists())).toBe(true);
    const actions = w.find(".r1-footer .r1-actions");
    expect(actions.findAll("button")).toHaveLength(2);                       // preview toggle + WhatsApp on one row
    expect(w.find(".r1-footer details").exists()).toBe(false);
  });
  it("lets users without canEdit fill in the report, and has no save button", async () => {
    const w = await mountView({ canEdit: false });
    expect(w.find(".r1-status").attributes("disabled")).toBeUndefined();
    expect(w.find(".r1-note-input").attributes("disabled")).toBeUndefined();
    await w.findAll(".r1-status")[0].setValue("ב");
    expect(w.find(".r1-save").exists()).toBe(false); // there is no save button
  });
});
