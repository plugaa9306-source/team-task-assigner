import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/team-task-assigner/",
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test-setup.js"],
  },
});
