import { createRouter, createWebHashHistory } from "vue-router";
import MainView from "./views/MainView.vue";
import LoginView from "./views/LoginView.vue";
import SoldierDetailsView from "./views/SoldierDetailsView.vue";
import Report1View from "./views/Report1View.vue";
import ReportViewView from "./views/ReportViewView.vue";
import { isAuthenticated, useAuth } from "./lib/auth.js";

export const routes = [
  { path: "/", name: "main", component: MainView, meta: { requiresAuth: true } },
  { path: "/soldiers", name: "soldiers", component: SoldierDetailsView, meta: { requiresAuth: true } },
  { path: "/report1", name: "report1", component: Report1View, meta: { requiresAuth: true, requiresReport1: true } },
  { path: "/view1", name: "view1", component: ReportViewView, meta: { requiresAuth: true, requiresView1: true } },
  { path: "/login", name: "login", component: LoginView },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export function authGuard(to) {
  if (to.meta.requiresAuth && !isAuthenticated.value) return { name: "login" };
  if (to.meta.requiresReport1 && !useAuth().canReport1.value) return { name: "main" };
  if (to.meta.requiresView1 && !useAuth().canView1.value) return { name: "main" };
  if (to.name === "login" && isAuthenticated.value) return { name: "main" };
}

// Hash history so deep links work on static hosting (GitHub Pages).
export function createAppRouter(history = createWebHashHistory()) {
  const router = createRouter({ history, routes });
  router.beforeEach(authGuard);
  return router;
}
