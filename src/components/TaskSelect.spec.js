import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TaskSelect from "./TaskSelect.vue";

describe("TaskSelect", () => {
  const tasks = ["משימה א", "משימה ב"];

  it("renders the placeholder option plus one option per task", () => {
    const wrapper = mount(TaskSelect, { props: { tasks, modelValue: "" } });
    const options = wrapper.findAll("option");
    expect(options).toHaveLength(3);
    expect(options[0].text()).toBe("בחרו משימה…");
    expect(options[0].attributes("value")).toBe("");
    expect(options[1].text()).toBe("משימה א");
    expect(options[2].text()).toBe("משימה ב");
  });

  it("reflects modelValue as the select's current value", () => {
    const wrapper = mount(TaskSelect, { props: { tasks, modelValue: "משימה ב" } });
    expect(wrapper.find("select").element.value).toBe("משימה ב");
  });

  it("emits update:modelValue with the selected value on change", async () => {
    const wrapper = mount(TaskSelect, { props: { tasks, modelValue: "" } });
    await wrapper.find("select").setValue("משימה א");
    expect(wrapper.emitted("update:modelValue")).toEqual([["משימה א"]]);
  });
});
