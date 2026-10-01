import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter } from "./router.js";
import { logout } from "./lib/auth.js";
import { STORAGE_KEY, hydrate } from "./lib/auth.js";

const signIn = (extra = {}) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", role: "Viewer", canEdit: false, ...extra }));
  hydrate();
};

describe("route guard", () => {
  beforeEach(() => { localStorage.clear(); logout(); });

  it("redirects unauthenticated users to /login", async () => {
    const router = createAppRouter(createMemoryHistory());
    await router.push("/");
    expect(router.currentRoute.value.name).toBe("login");
  });

  it("redirects authenticated users away from /login", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "t", role: "Viewer", canEdit: false }));
    hydrate();
    const router = createAppRouter(createMemoryHistory());
    await router.push("/login");
    expect(router.currentRoute.value.name).toBe("main");
  });

  it("blocks /report1 without canReport1 and allows it with", async () => {
    signIn();
    let router = createAppRouter(createMemoryHistory());
    await router.push("/report1");
    expect(router.currentRoute.value.name).toBe("main");
    signIn({ canReport1: true });
    router = createAppRouter(createMemoryHistory());
    await router.push("/report1");
    expect(router.currentRoute.value.name).toBe("report1");
  });

  it("sends every signed-in user, Report 1 or not, from /login to the task screen", async () => {
    signIn({ canReport1: true });
    const router = createAppRouter(createMemoryHistory());
    await router.push("/login");
    expect(router.currentRoute.value.name).toBe("main");
  });
});
