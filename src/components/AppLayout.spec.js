import { describe, it, expect, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import AppLayout from "./AppLayout.vue";
import { STORAGE_KEY, hydrate, logout } from "../lib/auth.js";

const stub = { template: "<div />" };
const menuShown = (w) => !(w.find(".al-menu-list").attributes("style") ?? "").includes("display: none");
const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: ["main", "soldiers", "report1", "view1", "login"].map((name) => ({ path: `/${name}`, name, component: stub })),
  });

async function mountAt(path, { canReport1 = false } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", canReport1 }));
  hydrate();
  const router = makeRouter();
  router.push(path);
  await router.isReady();
  const w = mount(AppLayout, { props: { title: "כותרת" }, global: { plugins: [router] } });
  return { w, router };
}

describe("AppLayout", () => {
  beforeEach(() => { localStorage.clear(); logout(); });

  it("shows the two base tabs and marks the current one active", async () => {
    const { w } = await mountAt("/soldiers");
    const tabs = w.findAll(".al-tab");
    expect(tabs.map((t) => t.text())).toEqual(["שיבוץ משימה", "פרטי חיילים"]);
    expect(tabs[1].classes()).toContain("router-link-exact-active");
    expect(tabs[0].classes()).not.toContain("router-link-exact-active");
  });

  it('adds the דיווח דו"ח 1 tab only for canReport1 users', async () => {
    const { w } = await mountAt("/main", { canReport1: true });
    expect(w.findAll(".al-tab").map((t) => t.text())).toContain('דיווח דו"ח 1');
  });

  it("has a 3-line menu button that opens a dropdown with logout and closes again", async () => {
    const { w } = await mountAt("/main");
    const btn = w.find(".al-menu-btn");
    expect(btn.attributes("aria-label")).toBe("תפריט");
    expect(btn.attributes("aria-expanded")).toBe("false");
    expect(menuShown(w)).toBe(false);
    await btn.trigger("click");
    expect(btn.attributes("aria-expanded")).toBe("true");
    expect(menuShown(w)).toBe(true);
    expect(w.find(".al-menu-item").text()).toBe("יציאה");
    await btn.trigger("click");
    expect(menuShown(w)).toBe(false);
  });

  it("closes the menu on Escape and on an outside click", async () => {
    const { w } = await mountAt("/main");
    const host = document.createElement("div");
    document.body.appendChild(host);
    w.unmount();
    const router = makeRouter();
    router.push("/main");
    await router.isReady();
    const mounted = mount(AppLayout, { props: { title: "t" }, global: { plugins: [router] }, attachTo: host });
    await mounted.find(".al-menu-btn").trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await mounted.vm.$nextTick();
    expect(menuShown(mounted)).toBe(false);
    await mounted.find(".al-menu-btn").trigger("click");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await mounted.vm.$nextTick();
    expect(menuShown(mounted)).toBe(false);
    mounted.unmount();
    host.remove();
  });

  it("logout from the menu clears the session and goes to /login", async () => {
    const { w, router } = await mountAt("/main");
    await w.find(".al-menu-btn").trigger("click");
    await w.find(".al-menu-item").trigger("click");
    await flushPromises();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(router.currentRoute.value.name).toBe("login");
    expect(menuShown(w)).toBe(false);
  });

  it("shows the title and subtitle stacked in one titles block on every screen", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t" }));
    hydrate();
    const router = makeRouter();
    router.push("/main");
    await router.isReady();
    const w = mount(AppLayout, { props: { title: "כותרת", subtitle: "תת" }, global: { plugins: [router] } });
    expect(w.find(".al-titles h1").text()).toBe("כותרת");
    expect(w.find(".al-titles p").text()).toBe("תת");
    const noSub = mount(AppLayout, { props: { title: "כותרת" }, global: { plugins: [router] } });
    expect(noSub.find(".al-titles p").exists()).toBe(false);
  });

  it('shows the "צפייה בדוח 1" tab only for users with canView1', async () => {
    const { w: without } = await mountAt("/main");
    expect(without.findAll(".al-tab").map((t) => t.text())).not.toContain("צפייה בדוח 1");

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", canView1: true }));
    hydrate();
    const router = makeRouter();
    router.push("/main");
    await router.isReady();
    const withView = mount(AppLayout, { props: { title: "t" }, global: { plugins: [router] } });
    expect(withView.findAll(".al-tab").map((t) => t.text())).toContain("צפייה בדוח 1");
  });

  it("scrolls the current tab into view when the screen opens (the tab row can overflow)", async () => {
    const calls = [];
    const original = Element.prototype.scrollIntoView;
    let host;
    // only count calls from this test's own component (other mounted layouts share the login state)
    Element.prototype.scrollIntoView = function (opts) { if (host?.contains(this)) calls.push([this.textContent.trim(), opts]); };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", canReport1: true, canView1: true }));
      hydrate();
      const router = makeRouter();
      router.push("/view1");
      await router.isReady();
      host = document.createElement("div");
      document.body.appendChild(host);
      const w = mount(AppLayout, { props: { title: "t" }, global: { plugins: [router] }, attachTo: host });
      await flushPromises();
      expect(calls).toEqual([["צפייה בדוח 1", { block: "nearest", inline: "nearest" }]]);
      w.unmount();
      host.remove();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
