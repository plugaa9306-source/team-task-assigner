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
});
