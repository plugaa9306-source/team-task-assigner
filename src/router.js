import { createRouter, createWebHashHistory } from "vue-router";
import MainView from "./views/MainView.vue";
import LoginView from "./views/LoginView.vue";
import { isAuthenticated } from "./lib/auth.js";

export const routes = [
  { path: "/", name: "main", component: MainView, meta: { requiresAuth: true } },
  { path: "/login", name: "login", component: LoginView },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export function authGuard(to) {
  if (to.meta.requiresAuth && !isAuthenticated.value) return { name: "login" };
  if (to.name === "login" && isAuthenticated.value) return { name: "main" };
}

// Hash history so deep links work on static hosting (GitHub Pages).
export function createAppRouter(history = createWebHashHistory()) {
  const router = createRouter({ history, routes });
  router.beforeEach(authGuard);
  return router;
}
