<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="d in paths" :key="d" :d="d" :stroke="filled ? 'none' : undefined" />
  </svg>
</template>

<script setup>
import { computed } from "vue";

// 24x24 icon paths. Stroke icons by default; `whatsapp` is a filled glyph.
const ICONS = {
  users: ["M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M2.5 20a6.5 6.5 0 0 1 13 0", "M16 4.3a3.5 3.5 0 0 1 0 6.4", "M18 14.2a6.5 6.5 0 0 1 3.5 5.8"],
  logout: ["M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4", "M15 8l4 4-4 4", "M19 12H9"],
  clipboard: ["M9 4h6v3H9z", "M15 5.5h2a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2h2", "M9 13l2 2 4-4"],
  chart: ["M5 20V11M12 20V4M19 20v-6"],
  save: ["M5 4h11l3 3v13H5z","M8 4v5h7V4","M8 20v-6h8v6"],
  filter: ["M4 5h16l-6 8v6l-4-2v-4z"],
  phone: ["M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"],
  trash: ["M4 7h16", "M10 11v6M14 11v6", "M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12", "M9 7V4h6v3"],
  eye: ["M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  plus: ["M12 5v14M5 12h14"],
  search: ["M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z", "M16 16l4.5 4.5"],
  copy: ["M9 9h10v11H9z", "M5 15V4h10"],
  chat: ["M4 5h16v11H9l-5 4z", "M8 9.5h8M8 12.5h5"],
  whatsapp: [
    "M12.04 2a9.9 9.9 0 0 0-8.43 15.1L2 22l5.05-1.56A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.2 15.03l-.3-.18-3 .93.98-2.9-.2-.31A8.1 8.1 0 0 1 12.04 3.8zM8.6 7.4c-.2 0-.5.07-.75.35-.26.28-1 1-1 2.4s1.03 2.8 1.17 3c.15.2 2 3.2 4.95 4.35 2.45.97 2.95.78 3.48.73.53-.05 1.7-.7 1.94-1.37.24-.67.24-1.25.17-1.37-.07-.12-.26-.2-.55-.34-.29-.15-1.7-.84-1.97-.94-.26-.1-.46-.15-.65.15-.2.29-.75.94-.92 1.13-.17.2-.34.22-.63.07-.29-.14-1.22-.45-2.32-1.43-.86-.77-1.44-1.7-1.6-2-.18-.29-.02-.45.13-.6.13-.13.29-.34.44-.5.14-.18.2-.3.29-.5.1-.2.05-.37-.02-.52-.07-.14-.64-1.56-.88-2.13-.23-.56-.47-.48-.65-.49z",
  ],
};

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 18 },
});
const paths = computed(() => ICONS[props.name] ?? []);
const filled = computed(() => props.name === "whatsapp");
</script>

<style>
.app-icon { flex: none; vertical-align: middle; }
</style>
