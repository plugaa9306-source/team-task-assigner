import { createApp } from "vue";
import App from "./App.vue";
import { createAppRouter } from "./router.js";
import { hydrate, logout } from "./lib/auth.js";
import { setAuthErrorHandler } from "./services/api.js";
import "./style.css";

const router = createAppRouter();
setAuthErrorHandler(() => {
  logout();
  router.push({ name: "login" });
});

hydrate();
createApp(App).use(router).mount("#app");
