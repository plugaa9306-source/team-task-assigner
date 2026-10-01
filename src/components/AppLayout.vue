<template>
  <main class="card">
    <header class="app-header">
      <div class="al-row">
        <h1>{{ title }}</h1>
        <div ref="menuEl" class="al-menu">
          <button
            ref="menuBtn"
            type="button"
            class="al-menu-btn"
            aria-label="תפריט"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            aria-controls="al-menu-list"
            @click="menuOpen = !menuOpen"
          >
            <AppIcon name="menu" :size="22" />
          </button>
          <ul v-show="menuOpen" id="al-menu-list" class="al-menu-list" role="menu">
            <li role="none">
              <button type="button" class="al-menu-item" role="menuitem" @click="onLogout">
                <AppIcon name="logout" :size="18" />יציאה
              </button>
            </li>
          </ul>
        </div>
      </div>
      <p v-if="subtitle">{{ subtitle }}</p>
    </header>

    <nav class="al-tabs" aria-label="ניווט ראשי">
      <router-link v-for="t in tabs" :key="t.name" class="al-tab" :to="{ name: t.name }">
        <AppIcon :name="t.icon" :size="19" />
        <span>{{ t.label }}</span>
      </router-link>
    </nav>

    <slot />
  </main>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import AppIcon from "./AppIcon.vue";
import { useAuth } from "../lib/auth.js";

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
});

const router = useRouter();
const { logout, canReport1 } = useAuth();

const tabs = computed(() => [
  { name: "main", label: "שיבוץ משימה", icon: "clipboard" },
  { name: "soldiers", label: "פרטי חיילים", icon: "users" },
  ...(canReport1.value ? [{ name: "report1", label: 'דיווח דו"ח 1', icon: "chart" }] : []),
]);

const menuOpen = ref(false);
const menuEl = ref(null);
const menuBtn = ref(null);

function onOutside(e) {
  if (menuOpen.value && menuEl.value && !menuEl.value.contains(e.target)) menuOpen.value = false;
}
function onKey(e) {
  if (e.key === "Escape" && menuOpen.value) {
    menuOpen.value = false;
    menuBtn.value?.focus();
  }
}
onMounted(() => {
  document.addEventListener("pointerdown", onOutside);
  document.addEventListener("keydown", onKey);
});
onUnmounted(() => {
  document.removeEventListener("pointerdown", onOutside);
  document.removeEventListener("keydown", onKey);
});

function onLogout() {
  menuOpen.value = false;
  logout();
  router.push({ name: "login" });
}
</script>

<style scoped>
.al-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.al-menu { position: relative; }
.al-menu-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; padding: 0; cursor: pointer;
  color: var(--primary-ink); background: rgba(255, 255, 255, .18); border: 1px solid rgba(255, 255, 255, .4);
  border-radius: var(--radius); transition: background-color var(--ease);
}
.al-menu-btn:hover, .al-menu-btn[aria-expanded="true"] { background: rgba(255, 255, 255, .3); }
.al-menu-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.al-menu-list {
  position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; min-width: 160px; margin: 0; padding: 4px; list-style: none;
  background: #fff; border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-md);
}
.al-menu-item {
  width: 100%; min-height: 40px; display: flex; align-items: center; gap: 10px; padding: 0 12px; font: inherit; font-weight: 600;
  color: var(--danger); background: none; border: 0; border-radius: 8px; cursor: pointer; text-align: start;
}
.al-menu-item:hover, .al-menu-item:focus-visible { background: #f6dde0; outline: none; }

.al-tabs { display: flex; flex: none; background: #fff; border-bottom: 1px solid var(--line); box-shadow: var(--shadow-sm); }
.al-tab {
  flex: 1; min-width: 0; min-height: 50px; padding: 0 8px;
  display: flex; align-items: center; justify-content: center; gap: 7px;
  font-size: .9rem; font-weight: 600; text-decoration: none; white-space: nowrap;
  color: var(--muted); border-bottom: 3px solid transparent; margin-bottom: -1px;
  transition: color var(--ease), background-color var(--ease), border-color var(--ease);
}
.al-tab:hover { color: var(--primary); background: #f1f6f8; }
.al-tab:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.al-tab.router-link-exact-active { color: var(--primary-dark); border-bottom-color: var(--primary); background: #e8f1f4; }
@media (max-width: 400px) { .al-tab span { font-size: .78rem; } .al-tab { gap: 5px; padding: 0 4px; } }
</style>
