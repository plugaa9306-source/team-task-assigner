import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const list = ref([
  { id: "7158852", idNum: "012345678", firstName: "שלמה", lastName: "קליסקי", phone: "0501234567", unit: "מחלקה 1", tabName: "" },
  { id: "1111111", idNum: "", firstName: "שלמה", lastName: "כהן", phone: "", unit: "חפ\"ק", tabName: "" },
]);
vi.mock("../lib/soldiers.js", async (orig) => ({
  ...(await orig()),
  useSoldiers: () => ({ soldiersList: list, isLoading: ref(false), error: ref(""), load: vi.fn() }),
}));
import SoldierDetailsView from "./SoldierDetailsView.vue";


const mountView = () => mount(SoldierDetailsView, { global: { stubs: { RouterLink: { template: "<a><slot /></a>" } } } });

describe("SoldierDetailsView", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows the instruction, then no-results for an unknown query", async () => {
    const w = mountView();
    expect(w.text()).toContain("הזינו שם");
    await w.find("input").setValue("ZZZ");
    expect(w.text()).toContain("לא נמצא חייל");
  });

  it("lists suggestions for several matches and opens the card on pick", async () => {
    const w = mountView();
    await w.find("input").setValue("שלמה");
    const items = w.findAll(".sd-results li");
    expect(items).toHaveLength(2);
    expect(w.find(".sd-profile").exists()).toBe(false);
    await items[0].trigger("click");
    expect(w.find(".sd-profile").text()).toContain("שלמה קליסקי");
    expect(w.find(".sd-results").exists()).toBe(false);
  });

  it("supports keyboard navigation: arrows move, Enter picks, Escape closes", async () => {
    const w = mountView();
    const input = w.find("input");
    await input.setValue("שלמה");
    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "ArrowDown" });
    const items = w.findAll(".sd-results li");
    expect(items[1].classes()).toContain("is-active");
    await input.trigger("keydown", { key: "ArrowUp" });
    expect(w.findAll(".sd-results li")[0].classes()).toContain("is-active");
    await input.trigger("keydown", { key: "Escape" });
    expect(w.find(".sd-results").exists()).toBe(false);
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(w.find(".sd-results").exists()).toBe(true);
    await input.trigger("keydown", { key: "Enter" });
    expect(w.find(".sd-profile").text()).toContain("שלמה");
    expect(w.find(".sd-results").exists()).toBe(false);
  });

  it("auto-selects a single match and renders call/WhatsApp links", async () => {
    const w = mountView();
    await w.find("input").setValue("7158852");
    expect(w.find(".sd-profile").exists()).toBe(true);
    expect(w.find(".sd-call").attributes("href")).toBe("tel:0501234567");
    expect(w.find(".sd-wa").attributes("href")).toBe("https://wa.me/972501234567");
  });

  it("clear button resets the search", async () => {
    const w = mountView();
    await w.find("input").setValue("7158852");
    await w.find(".sd-clear").trigger("click");
    expect(w.find(".sd-profile").exists()).toBe(false);
    expect(w.text()).toContain("הזינו שם");
  });

  it("edit flow: warns without changes, otherwise opens a wa.me link with only the diff", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const w = mountView();
    await w.find("input").setValue("7158852");
    await w.find(".sd-edit").trigger("click");
    await w.find(".sd-modal").trigger("submit");
    expect(w.text()).toContain("לא בוצעו שינויים");
    expect(open).not.toHaveBeenCalled();

    const phone = w.findAll(".sd-field input")[4];
    await phone.setValue("0529999999");
    await w.find(".sd-modal").trigger("submit");
    const url = decodeURIComponent(open.mock.calls[0][0]);
    expect(url).toContain("טלפון: 0501234567 ⬅️ 0529999999");
    expect(url).not.toContain("שם פרטי");
    expect(w.find(".sd-modal").exists()).toBe(false);
  });
});
