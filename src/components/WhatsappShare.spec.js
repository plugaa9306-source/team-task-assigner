import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import WhatsappShare from "./WhatsappShare.vue";

const template = {
  header: "📌 *דף משימה: {TASK}*",
  subheader: "👥 *צוות יוצא:*",
  item_format: "• [{ID}] *{FIRST_NAME} {LAST_NAME}* - {ROLE}",
  footer: "משוגר ממחולל המשימות 🚀",
};
const members = [{ firstName: "משה", lastName: "לוי", id: "1", role: "נהג" }];

const originalClipboard = navigator.clipboard;

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: originalClipboard,
    configurable: true,
  });
});

describe("WhatsappShare", () => {
  it("shows the not-ready placeholder and disables the share button when task is empty", () => {
    const wrapper = mount(WhatsappShare, { props: { task: "", members: [], allComplete: false, template } });
    expect(wrapper.find(".ws-text").text()).toBe("בחרו משימה והוסיפו לפחות אדם אחד עם שם ותפקיד.");
    expect(wrapper.find(".ws-share").element.disabled).toBe(true);
  });

  it("builds the message and enables the share button once task+members+allComplete are all satisfied", () => {
    const wrapper = mount(WhatsappShare, { props: { task: "אבטחת היקף", members, allComplete: true, template } });
    const text = wrapper.find(".ws-text").text();
    expect(text).toContain("דף משימה: אבטחת היקף");
    expect(text).toContain("[1] *משה לוי* - נהג");
    expect(wrapper.find(".ws-share").element.disabled).toBe(false);
  });

  it("stays not-ready if allComplete is false even with members present", () => {
    const wrapper = mount(WhatsappShare, { props: { task: "אבטחת היקף", members, allComplete: false, template } });
    expect(wrapper.find(".ws-share").element.disabled).toBe(true);
  });
});

describe("WhatsappShare phone placeholder", () => {
  const tpl = { header: "{TASK}", subheader: "s", item_format: "• [{ID}] {FIRST_NAME} {LAST_NAME} - {ROLE} - {PHONE}", footer: "f" };
  const mk = (m) => mount(WhatsappShare, { props: { task: "t", members: [m], allComplete: true, template: tpl } }).find(".ws-text").text();

  it("includes the phone number", () => {
    expect(mk({ firstName: "א", lastName: "ב", id: "1", role: "נהג", phone: "0501234567" })).toContain("• [1] א ב - נהג - 0501234567");
  });

  it("omits the phone segment when there is none", () => {
    const text = mk({ firstName: "א", lastName: "ב", id: "1", role: "נהג", phone: "" });
    expect(text).toContain("• [1] א ב - נהג");
    expect(text).not.toContain("נהג -");
  });
});

describe("WhatsappShare layout", () => {
  const tpl2 = { header: "{TASK}", subheader: "s", item_format: "{FIRST_NAME}", footer: "f" };
  const m2 = [{ firstName: "א", lastName: "ב", id: "1", role: "נהג", phone: "" }];
  const shown = (w) => !(w.find(".ws-preview").attributes("style") ?? "").includes("display: none");

  it("labels the share button 'שלח דוח משימה בוואטסאפ'", () => {
    const w = mount(WhatsappShare, { props: { task: "t", members: m2, allComplete: true, template: tpl2 } });
    expect(w.find(".ws-share").text()).toBe("שלח דוח משימה בוואטסאפ");
  });

  it("has the preview toggle, share and group buttons on one row", () => {
    const w = mount(WhatsappShare, { props: { task: "t", members: m2, allComplete: true, template: tpl2 } });
    expect(w.find(".ws-actions").findAll("button").map((b) => b.classes()[0])).toEqual(["ws-preview-btn", "ws-share", "ws-group"]);
    expect(w.find("details").exists()).toBe(false);
  });

  it("toggles the preview pop-up and closes it on Escape", async () => {
    const w = mount(WhatsappShare, { props: { task: "t", members: m2, allComplete: true, template: tpl2 } });
    const toggle = w.find(".ws-preview-btn");
    expect(shown(w)).toBe(false);
    expect(toggle.attributes("aria-expanded")).toBe("false");
    await toggle.trigger("click");
    expect(shown(w)).toBe(true);
    expect(toggle.attributes("aria-expanded")).toBe("true");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await w.vm.$nextTick();
    expect(shown(w)).toBe(false);
    w.unmount();
  });
});

describe("WhatsappShare group button", () => {
  const tpl3 = { header: "משימה: {TASK}", subheader: "s", item_format: "{FIRST_NAME}", footer: "f" };
  const team = [
    { firstName: "א", lastName: "ב", id: "1", role: "נהג", phone: "050-1234567" },
    { firstName: "ג", lastName: "ד", id: "2", role: "לוחם", phone: "0521112222" },
    { firstName: "ה", lastName: "ו", id: "3", role: "קשר", phone: "" },
  ];
  const mk = (members = team, props = {}) => mount(WhatsappShare, { props: { task: "סיור", members, allComplete: true, template: tpl3, ...props } });

  it("copies the team's international numbers and opens WhatsApp with the task message", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const w = mk();
    await w.find(".ws-group").trigger("click");
    await Promise.resolve();
    await w.vm.$nextTick();
    expect(writeText).toHaveBeenCalledWith("972501234567\n972521112222");
    const url = open.mock.calls[0][0];
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("משימה: סיור");
    const toast = w.find(".ws-toast").text();
    expect(toast).toContain("מספרי הצוות הועתקו");
    expect(toast).toContain("1 ללא מספר טלפון");
    open.mockRestore();
  });

  it("is disabled until the share is ready and when nobody has a number", () => {
    expect(mk(team, { task: "" }).find(".ws-group").element.disabled).toBe(true);
    expect(mk(team, { allComplete: false }).find(".ws-group").element.disabled).toBe(true);
    expect(mk([{ firstName: "ה", lastName: "ו", id: "3", role: "קשר", phone: "" }]).find(".ws-group").element.disabled).toBe(true);
    expect(mk().find(".ws-group").element.disabled).toBe(false);
  });

  it("reports a clipboard failure but still opens WhatsApp", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const w = mk();
    await w.find(".ws-group").trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    expect(open).toHaveBeenCalledTimes(1);
    expect(w.find(".ws-toast").text()).toContain("לא ניתן להעתיק");
    open.mockRestore();
  });
});
