import { describe, it, expect, beforeEach } from "vitest";
import { createMemoryHistory } from "vue-router";
import { createAppRouter } from "./router.js";
import { logout } from "./lib/auth.js";
import { STORAGE_KEY, hydrate } from "./lib/auth.js";

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
});
