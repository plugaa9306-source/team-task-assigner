import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import TeamBuilder from "./TeamBuilder.vue";

// jsdom does not implement scrollIntoView; TeamBuilder's addRow() calls it on the
// newly focused row's root element, which otherwise causes an unhandled rejection
// inside the nextTick() callback (a false-negative "error" alongside passing tests).
Element.prototype.scrollIntoView = vi.fn();

const people = [
  { id: "1", firstName: "משה", lastName: "לוי" },
  { id: "2", firstName: "דוד", lastName: "כהן" },
];
const roles = ["נהג", "קשר"];

async function fillRow(wrapper, rowIndex, person, role) {
  const row = wrapper.findAll(".person-row")[rowIndex];
  await row.find(".pr-name").setValue(person.firstName);
  await row.find(".pr-name").trigger("input");
  await row.find("li[role=option]").trigger("click");
  await row.find(".pr-role").setValue(role);
  await row.find(".pr-role").trigger("change");
}

describe("TeamBuilder", () => {
  it("starts with exactly one empty row and emits allComplete: false", () => {
    const wrapper = mount(TeamBuilder, { props: { people, roles, locked: false } });
    expect(wrapper.findAll(".person-row")).toHaveLength(1);
    expect(wrapper.emitted("update:allComplete").at(-1)).toEqual([false]);
  });

  it("propagates locked to every row and disables the add button", () => {
    const wrapper = mount(TeamBuilder, { props: { people, roles, locked: true } });
    expect(wrapper.find(".tb-add").element.disabled).toBe(true);
    expect(wrapper.find(".pr-name").element.disabled).toBe(true);
  });

  it("adds a row on '+' click, up to needing both rows complete for allComplete", async () => {
    const wrapper = mount(TeamBuilder, { props: { people, roles, locked: false } });
    await wrapper.find(".tb-add").trigger("click");
    expect(wrapper.findAll(".person-row")).toHaveLength(2);
  });

  it("excludes an already-picked person from other rows' matches (taken set)", async () => {
    const withoutPick = mount(TeamBuilder, { props: { people, roles, locked: false } });
    await withoutPick.find(".tb-add").trigger("click");
    const secondRowNoPick = withoutPick.findAll(".person-row")[1];
    await secondRowNoPick.find(".pr-name").setValue("מ");
    await secondRowNoPick.find(".pr-name").trigger("input");
    expect(secondRowNoPick.findAll(".pr-res-name")).toHaveLength(1);

    const wrapper = mount(TeamBuilder, { props: { people, roles, locked: false } });
    await fillRow(wrapper, 0, people[0], roles[0]);
    await wrapper.find(".tb-add").trigger("click");
    const secondRow = wrapper.findAll(".person-row")[1];
    await secondRow.find(".pr-name").setValue("מ");
    await secondRow.find(".pr-name").trigger("input");
    expect(secondRow.findAll(".pr-res-name")).toHaveLength(0);
  });

  it("emits allComplete: true only once every row has both a name and a role", async () => {
    const wrapper = mount(TeamBuilder, { props: { people, roles, locked: false } });
    await fillRow(wrapper, 0, people[0], roles[0]);
    expect(wrapper.emitted("update:allComplete").at(-1)).toEqual([true]);
  });
});
