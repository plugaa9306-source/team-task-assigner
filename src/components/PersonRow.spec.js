import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import PersonRow from "./PersonRow.vue";
import { NO_ID } from "../lib/person.js";

const people = [
  { id: "1", firstName: "משה", lastName: "לוי" },
  { id: "2", firstName: "דוד", lastName: "כהן" },
];
const roles = ["נהג", "קשר"];
const emptyValue = () => ({ firstName: "", lastName: "", id: NO_ID, role: "" });

describe("PersonRow", () => {
  it("filters people by the typed query, excluding taken keys", async () => {
    const withoutTaken = mount(PersonRow, {
      props: { people, roles, taken: new Set(), canRemove: true, locked: false, modelValue: emptyValue() },
    });
    await withoutTaken.find(".pr-name").setValue("דוד");
    await withoutTaken.find(".pr-name").trigger("input");
    expect(withoutTaken.findAll(".pr-res-name").map((o) => o.text())).toEqual(["דוד כהן"]);

    const withTaken = mount(PersonRow, {
      props: { people, roles, taken: new Set(["id:2"]), canRemove: true, locked: false, modelValue: emptyValue() },
    });
    await withTaken.find(".pr-name").setValue("דוד");
    await withTaken.find(".pr-name").trigger("input");
    expect(withTaken.findAll(".pr-res-name")).toHaveLength(0);
  });

  it("emits update:modelValue with the picked person when a result is clicked", async () => {
    const wrapper = mount(PersonRow, {
      props: { people, roles, taken: new Set(), canRemove: true, locked: false, modelValue: emptyValue() },
    });
    await wrapper.find(".pr-name").setValue("דוד");
    await wrapper.find(".pr-name").trigger("input");
    await wrapper.find("li[role=option]").trigger("click");
    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted[emitted.length - 1][0]).toMatchObject({ firstName: "דוד", lastName: "כהן", id: "2" });
  });

  it("discards unconfirmed typed text on blur", async () => {
    const wrapper = mount(PersonRow, {
      props: { people, roles, taken: new Set(), canRemove: true, locked: false, modelValue: emptyValue() },
    });
    const input = wrapper.find(".pr-name");
    await input.setValue("זzzנונשוש");
    await input.trigger("input");
    await input.trigger("blur");
    expect(input.element.value).toBe("");
  });

  it("shows the required hint only after a field is touched and left empty", async () => {
    const wrapper = mount(PersonRow, {
      props: { people, roles, taken: new Set(), canRemove: true, locked: false, modelValue: emptyValue() },
    });
    expect(wrapper.find(".pr-hint").isVisible()).toBe(false);
    await wrapper.find(".pr-name").trigger("blur");
    expect(wrapper.find(".pr-hint").text()).toBe("יש למלא שם");
  });

  it("disables the name input, role select, and remove button when locked", () => {
    const wrapper = mount(PersonRow, {
      props: { people, roles, taken: new Set(), canRemove: true, locked: true, modelValue: emptyValue() },
    });
    expect(wrapper.find(".pr-name").element.disabled).toBe(true);
    expect(wrapper.find(".pr-role").element.disabled).toBe(true);
    expect(wrapper.find(".pr-remove").element.disabled).toBe(true);
  });

  it("keeps the name search, role dropdown and remove button on one line", () => {
    const wrapper = mount(PersonRow, { props: { people: [], roles: ["נהג"], canRemove: true } });
    const main = wrapper.find(".pr-main");
    expect(main.find(".pr-name-wrap").exists()).toBe(true);
    expect(main.find("select.pr-role").exists()).toBe(true);
    expect(main.find(".pr-remove").exists()).toBe(true);
    expect(wrapper.find(".pr-second").exists()).toBe(false);
  });

  it("uses the placeholder 'שם פרטי או משפחה'", () => {
    const wrapper = mount(PersonRow, { props: { people: [], roles: [] } });
    expect(wrapper.find("input.pr-name").attributes("placeholder")).toBe("שם פרטי או משפחה");
  });

  it("does not show the personal ID line on the card after choosing a soldier", async () => {
    const wrapper = mount(PersonRow, {
      props: { people: [], roles: [], modelValue: { firstName: "דוד", lastName: "כהן", id: "8783079", role: "" } },
    });
    expect(wrapper.find(".pr-meta").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("8783079");
  });

  it("uses a clickable trash icon (no ✕) to remove a person", async () => {
    const wrapper = mount(PersonRow, { props: { people: [], roles: [], canRemove: true } });
    const btn = wrapper.find(".pr-remove");
    expect(btn.attributes("aria-label")).toBe("הסר אדם");
    expect(btn.find("svg.app-icon").exists()).toBe(true);
    expect(btn.find(".pr-remove-icon").exists()).toBe(false);
    await btn.trigger("click");
    expect(wrapper.emitted("remove")).toHaveLength(1);
  });

  it("lists only names in the suggestions (no personal ID)", async () => {
    const people = [{ id: "8408899", firstName: "ארבל", lastName: "יעקב" }];
    const wrapper = mount(PersonRow, { props: { people, roles: [] } });
    await wrapper.find("input.pr-name").setValue("ארבל");
    const items = wrapper.findAll(".pr-results li");
    expect(items).toHaveLength(1);
    expect(items[0].text()).toBe("ארבל יעקב");
    expect(wrapper.find(".pr-res-id").exists()).toBe(false);
  });
});
