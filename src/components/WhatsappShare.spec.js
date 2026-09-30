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
  it("shows the not-ready placeholder and disables both buttons when task is empty", () => {
    const wrapper = mount(WhatsappShare, { props: { task: "", members: [], allComplete: false, template } });
    expect(wrapper.find(".ws-text").text()).toBe("בחרו משימה והוסיפו לפחות אדם אחד עם שם ותפקיד.");
    expect(wrapper.find(".ws-share").element.disabled).toBe(true);
    expect(wrapper.find(".ws-copy").element.disabled).toBe(true);
  });

  it("builds the message and enables both buttons once task+members+allComplete are all satisfied", () => {
    const wrapper = mount(WhatsappShare, { props: { task: "אבטחת היקף", members, allComplete: true, template } });
    const text = wrapper.find(".ws-text").text();
    expect(text).toContain("דף משימה: אבטחת היקף");
    expect(text).toContain("[1] *משה לוי* - נהג");
    expect(wrapper.find(".ws-share").element.disabled).toBe(false);
    expect(wrapper.find(".ws-copy").element.disabled).toBe(false);
  });

  it("stays not-ready if allComplete is false even with members present", () => {
    const wrapper = mount(WhatsappShare, { props: { task: "אבטחת היקף", members, allComplete: false, template } });
    expect(wrapper.find(".ws-share").element.disabled).toBe(true);
  });

  it("copies the built message and shows a status message on success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const wrapper = mount(WhatsappShare, { props: { task: "אבטחת היקף", members, allComplete: true, template } });
    await wrapper.find(".ws-copy").trigger("click");
    await Promise.resolve();
    expect(writeText).toHaveBeenCalled();
    expect(wrapper.find(".ws-status").text()).toBe("ההודעה הועתקה");
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
