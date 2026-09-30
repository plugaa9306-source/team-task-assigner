# Vite + Vue 3 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate team-task-assigner from vanilla JS Web Components (no build step) to Vite + Vue 3, converting all four components to Vue SFCs with identical behavior and visual design.

**Architecture:** A Vite-scaffolded Vue 3 SPA (`<script setup>`, plain JS, no router/Pinia). `App.vue` is the single state owner (task, people, roles, template, members, allComplete) and passes data down via props; children emit events up (`update:modelValue`-style), mirroring today's CustomEvent-based wiring. `data/*.json` moves to `public/data/*.json` and is still fetched at runtime, unchanged from today's behavior.

**Tech Stack:** Vite (latest), Vue 3 (latest), `@vitejs/plugin-vue` (latest). No TypeScript, no Pinia, no router, no test framework (none exists today).

**Spec:** `docs/superpowers/specs/2026-09-30-vite-vue-migration-design.md`

## Global Constraints

- Plain JavaScript `<script setup>` SFCs only — no TypeScript.
- State sharing via props + emits only — no Pinia.
- `public/data/*.json` is fetched at runtime with `fetch('data/<name>.json')`, exactly like today — never bundled/imported at build time.
- No automated test framework is introduced. Every task's verification is a manual check via `npm run dev` (and, where noted, `npm run build`).
- No git — do not run any `git` command as part of this plan.
- The old vanilla-JS implementation (`app.js`, `components/`, the old `style.css`, the old root `data/` folder) stays in place, untouched and unreferenced by the new app, until the final cleanup task deletes it.
- Visual design must not change: every CSS rule ported must produce the same rendered result as today.

---

### Task 1: Project scaffold — Vite + Vue project skeleton with data loading

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Modify: `index.html` (overwrite — this is the one unavoidable early replacement, since Vite requires its own `index.html` at the project root; its markup is fully reproduced in `App.vue` in this same task, so nothing is lost)
- Create: `src/main.js`
- Create: `src/style.css`
- Create: `src/App.vue`
- Create: `public/data/people.json`, `public/data/roles.json`, `public/data/tasks.json`, `public/data/template.json` (copies of the existing `data/*.json` files — the old `data/` folder is left in place untouched until Task 8)

**Interfaces:**
- Produces: `src/style.css` (global tokens/reset/layout, imported once from `src/main.js`) — every later component's `<style scoped>` block relies on the CSS custom properties defined here (`--primary`, `--line`, `--shadow-sm`, `--ease`, etc.).
- Produces: `App.vue`'s `onMounted` data-loading pattern (`fetch('data/<name>.json')`, `Promise.all`, try/catch) — later tasks (3, 5, 6) replace pieces of `App.vue`'s template/script but keep this loading logic.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "team-task-assigner",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Install Vite, Vue, and the Vue plugin at their latest versions**

Run: `npm install vue@latest` then `npm install -D vite@latest @vitejs/plugin-vue@latest`

Expected: `package.json` now has `vue` under `dependencies` and `vite`/`@vitejs/plugin-vue` under `devDependencies`, each pinned to whatever the actual latest resolved version is; a `node_modules/` folder and `package-lock.json` are created.

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
});
```

- [ ] **Step 4: Copy the data files into `public/data/`**

Run:
```bash
mkdir -p public/data
cp data/people.json data/roles.json data/tasks.json data/template.json public/data/
```

Expected: `public/data/` now contains the four JSON files, byte-identical to the ones in the old `data/` folder (which is left in place, untouched).

- [ ] **Step 5: Overwrite `index.html` with the Vite entry point**

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#1f5f73" />
  <title>מחולל שיבוצי משימות</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: Create `src/style.css`** (ported verbatim from the current root `style.css`, minus the four `@import` lines — each component now carries its own scoped styles instead)

```css
:root {
  --bg: #dde3e6;
  --card: #f8fafa;
  --ink: #15232b;
  --muted: #5d6f78;
  --line: #c5d0d5;
  --primary: #1f5f73;
  --primary-dark: #163f4d;
  --primary-light: #2c7d95;
  --primary-ink: #ffffff;
  --wa: #1da851;
  --wa-dark: #178a42;
  --danger: #b23a48;
  --focus: #e8a317;
  --radius: 10px;
  --tap: 42px;
  --shadow-sm: 0 2px 6px rgba(21, 35, 43, .08);
  --shadow-md: 0 10px 28px rgba(21, 35, 43, .16);
  --ease: .18s ease;
  --font: "Segoe UI", "Arial Hebrew", Arial, system-ui, sans-serif;
}

* { box-sizing: border-box; }

html, body { height: 100%; }

body {
  margin: 0;
  background: radial-gradient(circle at 50% 0%, #e8ecee, var(--bg) 60%);
  color: var(--ink);
  font-family: var(--font);
  font-size: 16px;
  line-height: 1.4;
  padding: 6px 12px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.card {
  width: 100%;
  max-width: 550px;
  height: calc(100dvh - 12px);
  display: flex;
  flex-direction: column;
  background: var(--card);
  border: 1px solid #fff;
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.app-header {
  background: linear-gradient(135deg, var(--primary-light), var(--primary) 55%, var(--primary-dark));
  color: var(--primary-ink);
  padding: 18px 20px;
}
.app-header h1 { margin: 0; font-size: 1.4rem; font-weight: 700; letter-spacing: .2px; }
.app-header p { margin: 5px 0 0; font-size: .9rem; opacity: .88; }

.app-error {
  margin: 0;
  padding: 12px 18px;
  background: #f6dde0;
  color: var(--danger);
  font-weight: 600;
}

/* Shared form controls */
input, select, button { font: inherit; color: inherit; }

input[type="text"], select {
  min-height: var(--tap);
  width: 100%;
  padding: 8px 12px;
  border: 1.5px solid var(--line);
  border-radius: 8px;
  background: #fff;
  transition: border-color var(--ease), box-shadow var(--ease);
}
input[type="text"]:hover:not(:disabled), select:hover:not(:disabled) { border-color: var(--primary-light); }
input[type="text"]:focus-visible, select:focus-visible {
  outline: none;
  border-color: var(--focus);
  box-shadow: 0 0 0 3px rgba(232, 163, 23, .28);
}

/* Native select arrows render inconsistently (and on the wrong side) across
   browsers in RTL, so draw a single custom chevron on the left instead. */
select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-left: 36px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235d6f78' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: left 10px center;
  background-size: 16px;
}

input[type="text"]:disabled, select:disabled {
  background-color: #eef1f2;
  color: var(--muted);
  cursor: not-allowed;
}

button { min-height: var(--tap); cursor: pointer; transition: background-color var(--ease), border-color var(--ease), transform var(--ease), box-shadow var(--ease); }
button:disabled { cursor: not-allowed; }
button:active:not(:disabled) { transform: translateY(1px); }

:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 1px;
}

@media (min-width: 700px) {
  body { padding: 16px 12px; }
  .card { height: calc(100dvh - 32px); }
}

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

- [ ] **Step 7: Create `src/main.js`**

```js
import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

createApp(App).mount("#app");
```

- [ ] **Step 8: Create a placeholder `src/App.vue`** (data loading only — the real header/component markup is filled in by Tasks 3, 5, and 6; for now this just proves the whole pipeline works end to end)

```vue
<template>
  <main class="card">
    <header class="app-header">
      <h1>שיבוץ משימה</h1>
      <p>בחרו משימה, שבצו אנשים ושלחו בוואטסאפ</p>
    </header>

    <p style="padding: 18px;">
      נטענו: {{ people.length }} אנשים, {{ tasks.length }} משימות, {{ roles.length }} תפקידים, תבנית: {{ template ? "כן" : "לא" }}
    </p>

    <p v-if="error" class="app-error" role="alert">{{ error }}</p>
  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";

const people = ref([]);
const roles = ref([]);
const tasks = ref([]);
const template = ref(null);
const error = ref("");

function load(name) {
  return fetch(`data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`${name}.json (${r.status})`);
    return r.json();
  });
}

onMounted(async () => {
  try {
    const [p, t, r, tpl] = await Promise.all(["people", "tasks", "roles", "template"].map(load));
    people.value = p;
    tasks.value = t;
    roles.value = r;
    template.value = tpl;
  } catch (err) {
    error.value = `שגיאה בטעינת הנתונים: ${err.message}. יש להריץ את האתר משרת (ולא לפתוח את הקובץ ישירות).`;
  }
});
</script>
```

- [ ] **Step 9: Run the dev server and verify data loads**

Run: `npm run dev`

Expected: terminal prints a local URL (e.g. `http://localhost:5173`). Open it in a browser — the teal header renders, and the paragraph below it reads "נטענו: 8 אנשים, 3 משימות, 4 תפקידים, תבנית: כן" (counts matching `public/data/*.json`). No console errors. Stop the dev server (Ctrl+C) when confirmed.

---

### Task 2: `src/lib/person.js` — shared identity helpers

**Files:**
- Create: `src/lib/person.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `NO_ID` (string constant), `personKey({ id, firstName, lastName })` (string) — used by `PersonRow.vue` and `TeamBuilder.vue` in Tasks 4 and 5.

- [ ] **Step 1: Create `src/lib/person.js`** (ported unchanged from the current `components/person-row/person-row.js` exports)

```js
export const NO_ID = 'ללא מ"א';

export function personKey({ id, firstName, lastName }) {
  return id && id !== NO_ID
    ? `id:${id}`
    : `name:${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}
```

- [ ] **Step 2: Sanity-check the port with a throwaway Node command**

Run:
```bash
node -e "
import('./src/lib/person.js').then(({ NO_ID, personKey }) => {
  const a = personKey({ id: '123', firstName: 'א', lastName: 'ב' });
  const b = personKey({ id: NO_ID, firstName: ' משה ', lastName: ' לוי ' });
  console.log(a, b);
  if (a !== 'id:123') throw new Error('id-based key broken');
  if (b !== 'name:משה|לוי') throw new Error('name-based key broken');
  console.log('OK');
});
"
```

Expected: prints `id:123 name:משה|לוי` then `OK`, no thrown error. (This is a one-off manual check, not a persisted test file — the project has no test framework, per the spec.)

---

### Task 3: `TaskSelect.vue`

**Files:**
- Create: `src/components/TaskSelect.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TaskSelect` component with prop `tasks: Array<string>` and `v-model` (emits `update:modelValue` with the selected task string, or `""` for the placeholder) — consumed by `App.vue` here and unchanged in later tasks.

- [ ] **Step 1: Create `src/components/TaskSelect.vue`**

```vue
<template>
  <div class="task-select">
    <label class="ts-label" for="ts-select">משימה</label>
    <select
      id="ts-select"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option value="">בחרו משימה…</option>
      <option v-for="t in tasks" :key="t" :value="t">{{ t }}</option>
    </select>
  </div>
</template>

<script setup>
defineProps({
  tasks: { type: Array, default: () => [] },
  modelValue: { type: String, default: "" },
});
defineEmits(["update:modelValue"]);
</script>

<style scoped>
.task-select {
  display: block;
  padding: 18px 18px 10px;
}
.ts-label {
  display: block;
  margin-bottom: 7px;
  font-weight: 700;
  color: var(--primary-dark);
}
</style>
```

- [ ] **Step 2: Wire it into `src/App.vue`, replacing the placeholder counts paragraph**

```vue
<template>
  <main class="card">
    <header class="app-header">
      <h1>שיבוץ משימה</h1>
      <p>בחרו משימה, שבצו אנשים ושלחו בוואטסאפ</p>
    </header>

    <TaskSelect :tasks="tasks" v-model="task" />
    <p style="padding: 0 18px;">משימה נבחרת: {{ task || "(אין)" }}</p>

    <p v-if="error" class="app-error" role="alert">{{ error }}</p>
  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";
import TaskSelect from "./components/TaskSelect.vue";

const task = ref("");
const people = ref([]);
const roles = ref([]);
const tasks = ref([]);
const template = ref(null);
const error = ref("");

function load(name) {
  return fetch(`data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`${name}.json (${r.status})`);
    return r.json();
  });
}

onMounted(async () => {
  try {
    const [p, t, r, tpl] = await Promise.all(["people", "tasks", "roles", "template"].map(load));
    people.value = p;
    tasks.value = t;
    roles.value = r;
    template.value = tpl;
  } catch (err) {
    error.value = `שגיאה בטעינת הנתונים: ${err.message}. יש להריץ את האתר משרת (ולא לפתוח את הקובץ ישירות).`;
  }
});
</script>
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open the printed URL.

Expected: the "משימה" dropdown shows the placeholder plus the 3 tasks from `public/data/tasks.json`, styled the same as before (teal label, custom chevron on the left). Selecting one updates the "משימה נבחרת: …" line below it immediately. Stop the dev server when confirmed.

---

### Task 4: `PersonRow.vue`

**Files:**
- Create: `src/components/PersonRow.vue`
- Modify: `src/App.vue` (temporary single-row harness, replaced in Task 5)

**Interfaces:**
- Consumes: `NO_ID`, `personKey` from `src/lib/person.js` (Task 2).
- Produces: `PersonRow` component — props `people: Array`, `roles: Array<string>`, `taken: Set<string>`, `canRemove: Boolean`, `locked: Boolean`, `modelValue: { firstName, lastName, id, role }`; emits `update:modelValue` (same shape), `remove` (no payload); exposes `focusName()` via `defineExpose`. Consumed by `TeamBuilder.vue` in Task 5.

- [ ] **Step 1: Create `src/components/PersonRow.vue`**

```vue
<template>
  <div class="person-row" ref="rootEl">
    <div class="pr-main">
      <div class="pr-name-wrap">
        <input
          ref="nameInputEl"
          type="text"
          class="pr-name"
          :class="{ 'pr-invalid': nameInvalid }"
          placeholder="חיפוש שם פרטי או משפחה"
          autocomplete="off"
          role="combobox"
          :aria-expanded="open"
          :aria-controls="resId"
          aria-autocomplete="list"
          aria-label="שם"
          :disabled="locked"
          :value="nameText"
          @input="onInput"
          @keydown="onKey"
          @blur="onNameBlur"
        >
        <ul
          v-show="open"
          ref="listEl"
          class="pr-results"
          :id="resId"
          role="listbox"
          :style="listStyle"
          @mousedown.prevent
        >
          <li
            v-for="(p, i) in matches"
            :key="p.id"
            role="option"
            :class="{ 'is-active': i === active }"
            @click="pick(p)"
          >
            <span class="pr-res-name">{{ p.firstName }} {{ p.lastName }}</span>
            <span class="pr-res-id">{{ p.id }}</span>
          </li>
        </ul>
      </div>
      <button
        type="button"
        class="pr-remove"
        aria-label="הסר אדם"
        :disabled="locked || !canRemove"
        @click="$emit('remove')"
      >
        <svg class="pr-remove-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    <div class="pr-second">
      <select
        ref="roleSelectEl"
        class="pr-role"
        :class="{ 'pr-invalid': roleInvalid }"
        aria-label="תפקיד"
        :disabled="locked"
        :value="modelValue.role"
        @change="onRoleChange"
        @blur="onRoleBlur"
      >
        <option value="">בחרו תפקיד…</option>
        <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
      </select>
      <span class="pr-meta">{{ metaText }}</span>
    </div>
    <p class="pr-hint" v-show="hintText">{{ hintText }}</p>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, useId } from "vue";
import { NO_ID, personKey } from "../lib/person.js";

const props = defineProps({
  people: { type: Array, default: () => [] },
  roles: { type: Array, default: () => [] },
  taken: { type: Set, default: () => new Set() },
  canRemove: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  modelValue: {
    type: Object,
    default: () => ({ firstName: "", lastName: "", id: NO_ID, role: "" }),
  },
});
const emit = defineEmits(["update:modelValue", "remove"]);

const resId = useId();
const rootEl = ref(null);
const nameInputEl = ref(null);
const roleSelectEl = ref(null);
const listEl = ref(null);

function fullName(v) {
  return `${v.firstName} ${v.lastName}`.trim();
}

const nameText = ref(fullName(props.modelValue));
const matches = ref([]);
const active = ref(-1);
const open = ref(false);
const touched = reactive({ name: false, role: false });
const listStyle = ref({});

const hasName = computed(() => fullName(props.modelValue) !== "");
const nameInvalid = computed(() => touched.name && !hasName.value);
const roleInvalid = computed(() => touched.role && props.modelValue.role === "");
const hintText = computed(() => {
  if (nameInvalid.value && roleInvalid.value) return "יש למלא שם ותפקיד";
  if (nameInvalid.value) return "יש למלא שם";
  if (roleInvalid.value) return "יש למלא תפקיד";
  return "";
});
const metaText = computed(() => (hasName.value ? `מ"א ${props.modelValue.id}` : ""));

function focusName() {
  nameInputEl.value?.focus();
}
defineExpose({ focusName });

function onInput(e) {
  nameText.value = e.target.value;
  if (props.modelValue.id !== NO_ID) {
    emit("update:modelValue", { firstName: "", lastName: "", id: NO_ID, role: props.modelValue.role });
  }
  search();
}

function search() {
  const q = nameText.value.trim().toLowerCase();
  if (!q) { close(); return; }
  matches.value = props.people
    .filter((p) => {
      const first = p.firstName.toLowerCase();
      const last = p.lastName.toLowerCase();
      const matchesQuery = first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q);
      return matchesQuery && !props.taken.has(personKey(p));
    })
    .slice(0, 30);

  if (!matches.value.length) { close(); return; }
  active.value = -1;
  open.value = true;
  position();
}

function pick(p) {
  emit("update:modelValue", { firstName: p.firstName, lastName: p.lastName, id: p.id, role: props.modelValue.role });
  nameText.value = `${p.firstName} ${p.lastName}`;
  close();
  roleSelectEl.value?.focus();
}

function onNameBlur() {
  touched.name = true;
  nameText.value = fullName(props.modelValue);
}

function onRoleChange(e) {
  emit("update:modelValue", { ...props.modelValue, role: e.target.value });
}

function onRoleBlur() {
  touched.role = true;
}

function onKey(e) {
  if (e.key === "ArrowDown" && open.value) { e.preventDefault(); move(1); }
  else if (e.key === "ArrowUp" && open.value) { e.preventDefault(); move(-1); }
  else if (e.key === "Enter" && open.value && active.value >= 0) { e.preventDefault(); pick(matches.value[active.value]); }
  else if (e.key === "Escape") close();
}

function move(step) {
  const n = matches.value.length;
  active.value = (active.value + step + n) % n;
  requestAnimationFrame(() => {
    listEl.value?.children[active.value]?.scrollIntoView({ block: "nearest" });
  });
}

function close() {
  open.value = false;
}

function position() {
  const el = nameInputEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - 10;
  const above = r.top - 10;
  const flip = below < 160 && above > below;
  const max = Math.max(120, Math.min(260, flip ? above : below));
  listStyle.value = {
    width: `${r.width}px`,
    left: `${r.left}px`,
    maxHeight: `${max}px`,
    top: flip ? "auto" : `${r.bottom + 4}px`,
    bottom: flip ? `${window.innerHeight - r.top + 4}px` : "auto",
  };
}

function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) close();
}
function onReposition(e) {
  if (!open.value || e.target === listEl.value) return;
  position();
}

onMounted(() => {
  document.addEventListener("click", onDocClick);
  window.addEventListener("scroll", onReposition, true);
  window.addEventListener("resize", onReposition);
});
onUnmounted(() => {
  document.removeEventListener("click", onDocClick);
  window.removeEventListener("scroll", onReposition, true);
  window.removeEventListener("resize", onReposition);
});

watch(() => props.locked, (locked) => { if (locked) close(); });
</script>

<style scoped>
.person-row {
  display: block;
  padding: 12px;
  background: #fff;
  border: 1.5px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--ease), border-color var(--ease);
}
.person-row:hover, .person-row:focus-within { border-color: var(--primary-light); }

.pr-main { display: flex; gap: 8px; align-items: stretch; }
.pr-name-wrap { flex: 1; min-width: 0; }

.pr-remove {
  flex: none;
  width: var(--tap);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--danger);
}
.pr-remove:hover:not(:disabled) { background: #f6dde0; border-color: var(--danger); }
.pr-remove:disabled { opacity: .35; cursor: not-allowed; }
.pr-remove-icon { fill: none; }

.pr-second {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
}
.pr-role { flex: 1; min-width: 0; }

.pr-meta {
  flex: none;
  font-size: .85rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.pr-name.pr-invalid, .pr-role.pr-invalid { border-color: var(--danger); }

.pr-hint {
  margin: 6px 0 0;
  color: var(--danger);
  font-size: .8rem;
}

.pr-results {
  position: fixed;
  z-index: 1000;
  margin: 0;
  padding: 4px;
  list-style: none;
  overflow-y: auto;
  background: #fff;
  border: 1.5px solid var(--primary);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(21, 35, 43, .22);
}

.pr-results li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  min-height: var(--tap);
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.pr-res-name { font-weight: 600; }
.pr-res-id { color: var(--muted); font-size: .85rem; font-variant-numeric: tabular-nums; }

@media (hover: hover) {
  .pr-results li:hover { background: #e3eef1; }
}
.pr-results li.is-active { background: #e3eef1; }
</style>
```

Note: the old vanilla-JS version had a `.pr-meta.is-free` red-text style for a free-typed (non-DB) name. That branch is unreachable now — the "pick only from list" behavior (already shipped in the vanilla-JS version before this migration) guarantees `modelValue.id` is only ever `NO_ID` when the name is also empty. `metaText`/`.pr-meta` above intentionally drop that dead branch; this is a like-for-like port of current *behavior*, not current dead code.

- [ ] **Step 2: Temporarily wire a single `PersonRow` into `src/App.vue` to verify it in isolation**

```vue
<template>
  <main class="card">
    <header class="app-header">
      <h1>שיבוץ משימה</h1>
      <p>בחרו משימה, שבצו אנשים ושלחו בוואטסאפ</p>
    </header>

    <TaskSelect :tasks="tasks" v-model="task" />
    <p style="padding: 0 18px;">משימה נבחרת: {{ task || "(אין)" }}</p>

    <div style="padding: 18px;">
      <PersonRow v-model="testRow" :people="people" :roles="roles" :taken="new Set()" :can-remove="false" :locked="false" />
      <pre style="margin-top: 8px; font-size: 12px;">{{ testRow }}</pre>
    </div>

    <p v-if="error" class="app-error" role="alert">{{ error }}</p>
  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";
import TaskSelect from "./components/TaskSelect.vue";
import PersonRow from "./components/PersonRow.vue";
import { NO_ID } from "./lib/person.js";

const task = ref("");
const people = ref([]);
const roles = ref([]);
const tasks = ref([]);
const template = ref(null);
const error = ref("");
const testRow = ref({ firstName: "", lastName: "", id: NO_ID, role: "" });

function load(name) {
  return fetch(`data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`${name}.json (${r.status})`);
    return r.json();
  });
}

onMounted(async () => {
  try {
    const [p, t, r, tpl] = await Promise.all(["people", "tasks", "roles", "template"].map(load));
    people.value = p;
    tasks.value = t;
    roles.value = r;
    template.value = tpl;
  } catch (err) {
    error.value = `שגיאה בטעינת הנתונים: ${err.message}. יש להריץ את האתר משרת (ולא לפתוח את הקובץ ישירות).`;
  }
});
</script>
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open the printed URL.

Expected, in order:
1. Typing a partial name (e.g. "משה") shows a filtered dropdown of matching people; clicking one fills the row, moves focus to the role select, and the `<pre>` JSON below shows the picked `id`/`firstName`/`lastName`.
2. Typing something that matches nobody shows no dropdown; clicking away (blur) clears the name field back to empty.
3. Picking a person then editing the text without re-picking, then blurring, reverts the field to the originally picked name.
4. Opening the role `<select>` shows all 4 roles regardless of the current selection.
5. Leaving the name or role empty after visiting it shows the red outline + "יש למלא שם/תפקיד" hint below the row.

Stop the dev server when confirmed. (This harness is replaced by `TeamBuilder` in Task 5.)

---

### Task 5: `TeamBuilder.vue`

**Files:**
- Create: `src/components/TeamBuilder.vue`
- Modify: `src/App.vue` (replaces the Task 4 harness)

**Interfaces:**
- Consumes: `PersonRow` (Task 4) with its exact prop/emit contract; `personKey`, `NO_ID` from `src/lib/person.js` (Task 2).
- Produces: `TeamBuilder` component — props `people: Array`, `roles: Array<string>`, `locked: Boolean`; emits `update:members` (array of `{firstName, lastName, id, role, filled}`) and `update:allComplete` (boolean). Consumed by `App.vue` in this task and unchanged in Task 6.

- [ ] **Step 1: Create `src/components/TeamBuilder.vue`**

```vue
<template>
  <div class="team-builder">
    <div class="tb-head">
      <h2>צוות</h2>
      <span class="tb-count" aria-live="polite">{{ countText }}</span>
    </div>
    <div class="tb-rows">
      <PersonRow
        v-for="(row, i) in rows"
        :key="row.key"
        ref="rowRefs"
        :people="people"
        :roles="roles"
        :taken="takenSets[i]"
        :can-remove="rows.length > 1"
        :locked="locked"
        v-model="row.value"
        @remove="removeRow(row.key)"
      />
    </div>
    <div class="tb-foot">
      <button type="button" class="tb-add" :disabled="locked" @click="addRow(true)">+ הוסף אדם נוסף</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from "vue";
import PersonRow from "./PersonRow.vue";
import { NO_ID, personKey } from "../lib/person.js";

const props = defineProps({
  people: { type: Array, default: () => [] },
  roles: { type: Array, default: () => [] },
  locked: { type: Boolean, default: true },
});
const emit = defineEmits(["update:members", "update:allComplete"]);

let rowSeq = 0;
function makeRow() {
  return { key: ++rowSeq, value: { firstName: "", lastName: "", id: NO_ID, role: "" } };
}

const rows = reactive([makeRow()]);
const rowRefs = ref([]);

function hasNameOf(v) {
  return (v.firstName + v.lastName).trim() !== "";
}

const takenSets = computed(() => {
  const values = rows.map((r) => r.value);
  return values.map((_, i) => {
    const set = new Set();
    values.forEach((v, j) => { if (j !== i && hasNameOf(v)) set.add(personKey(v)); });
    return set;
  });
});

const members = computed(() =>
  rows.map((r) => ({ ...r.value, filled: hasNameOf(r.value) })).filter((v) => v.filled)
);

const allComplete = computed(() =>
  rows.length > 0 && rows.every((r) => hasNameOf(r.value) && r.value.role !== "")
);

const countText = computed(() => {
  const n = members.value.length;
  return n === 1 ? "אדם אחד משובץ" : `${n} אנשים משובצים`;
});

watch(members, (v) => emit("update:members", v), { immediate: true });
watch(allComplete, (v) => emit("update:allComplete", v), { immediate: true });

function addRow(focus) {
  rows.push(makeRow());
  if (focus) {
    nextTick(() => {
      const last = rowRefs.value[rowRefs.value.length - 1];
      last?.focusName();
      last?.$el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
}

function removeRow(key) {
  if (rows.length <= 1) return;
  const idx = rows.findIndex((r) => r.key === key);
  if (idx !== -1) rows.splice(idx, 1);
}
</script>

<style scoped>
.team-builder {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
  padding: 10px 18px 14px;
}

.tb-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}
.tb-head h2 { margin: 0; font-size: 1.08rem; color: var(--primary-dark); }
.tb-count {
  font-size: .8rem;
  color: var(--primary);
  font-weight: 700;
  background: #e3eef1;
  padding: 3px 10px;
  border-radius: 999px;
}

.tb-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  padding: 3px 3px 6px;
  overscroll-behavior: contain;
}

.tb-foot { padding-top: 12px; }

.tb-add {
  width: 100%;
  border: 1.5px dashed var(--primary);
  border-radius: 999px;
  background: transparent;
  color: var(--primary);
  font-weight: 600;
}
.tb-add:hover { background: #e3eef1; border-style: solid; }
</style>
```

- [ ] **Step 2: Replace the Task 4 harness in `src/App.vue` with the real `TeamBuilder`**

```vue
<template>
  <main class="card">
    <header class="app-header">
      <h1>שיבוץ משימה</h1>
      <p>בחרו משימה, שבצו אנשים ושלחו בוואטסאפ</p>
    </header>

    <TaskSelect :tasks="tasks" v-model="task" />
    <TeamBuilder
      :people="people"
      :roles="roles"
      :locked="!task"
      @update:members="members = $event"
      @update:all-complete="allComplete = $event"
    />
    <pre style="margin: 0 18px; font-size: 12px;">members: {{ members }}
allComplete: {{ allComplete }}</pre>

    <p v-if="error" class="app-error" role="alert">{{ error }}</p>
  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";
import TaskSelect from "./components/TaskSelect.vue";
import TeamBuilder from "./components/TeamBuilder.vue";

const task = ref("");
const people = ref([]);
const roles = ref([]);
const tasks = ref([]);
const template = ref(null);
const error = ref("");
const members = ref([]);
const allComplete = ref(false);

function load(name) {
  return fetch(`data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`${name}.json (${r.status})`);
    return r.json();
  });
}

onMounted(async () => {
  try {
    const [p, t, r, tpl] = await Promise.all(["people", "tasks", "roles", "template"].map(load));
    people.value = p;
    tasks.value = t;
    roles.value = r;
    template.value = tpl;
  } catch (err) {
    error.value = `שגיאה בטעינת הנתונים: ${err.message}. יש להריץ את האתר משרת (ולא לפתוח את הקובץ ישירות).`;
  }
});
</script>
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open the printed URL.

Expected, in order:
1. Before picking a mission: the team section (name/role inputs, remove button, "+ הוסף אדם נוסף") is entirely disabled.
2. Picking a mission unlocks it; picking one person in row 1 removes them from row 2's dropdown after clicking "+ הוסף אדם נוסף"; removing row 1 makes that person reappear in row 2's dropdown.
3. With one row complete (name + role) and a second, empty row present, the `<pre>` debug block shows `allComplete: false` — an incomplete extra row blocks completion.
4. Removing the empty second row (or completing it) flips `allComplete` to `true` once every row has both fields.
5. Clearing the mission back to the placeholder re-locks the team section while the entered rows keep their data.

Stop the dev server when confirmed.

---

### Task 6: `WhatsappShare.vue` and final `App.vue` wiring

**Files:**
- Create: `src/components/WhatsappShare.vue`
- Modify: `src/App.vue` (final version — debug scaffolding removed)

**Interfaces:**
- Consumes: `members`/`allComplete` shape produced by `TeamBuilder` (Task 5); `template` JSON shape (`{ header, subheader, item_format, footer }`) loaded in `App.vue`.
- Produces: fully wired `App.vue`, matching the spec's data-flow section exactly.

- [ ] **Step 1: Create `src/components/WhatsappShare.vue`**

```vue
<template>
  <div class="whatsapp-share">
    <details class="ws-preview">
      <summary>
        <span>תצוגה מקדימה של ההודעה</span>
        <span class="ws-chevron" aria-hidden="true">▾</span>
      </summary>
      <pre class="ws-text">{{ previewText }}</pre>
    </details>
    <div class="ws-actions">
      <button type="button" class="ws-share" :disabled="!ready" @click="share">שתף בוואטסאפ</button>
      <button type="button" class="ws-copy" :disabled="!ready" @click="copy">העתק</button>
    </div>
    <p class="ws-status" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  task: { type: String, default: "" },
  members: { type: Array, default: () => [] },
  allComplete: { type: Boolean, default: false },
  template: { type: Object, default: null },
});

const status = ref("");

const ready = computed(() => Boolean(props.task) && props.members.length > 0 && props.allComplete);

function buildMessage() {
  const t = props.template;
  if (!t) return "";
  const fill = (str, m = {}) =>
    str
      .replaceAll("{TASK}", props.task)
      .replaceAll("{FIRST_NAME}", m.firstName ?? "")
      .replaceAll("{LAST_NAME}", m.lastName ?? "")
      .replaceAll("{ID}", m.id ?? "")
      .replaceAll("{ROLE}", m.role ?? "");

  const items = props.members.map((m) => {
    let line = fill(t.item_format, m);
    if (!m.role) line = line.replace(/\s*-\s*$/, "").replace(/\s{2,}/g, " ");
    return line.trim();
  });

  return [fill(t.header), "", fill(t.subheader), ...items, "", fill(t.footer)].join("\n");
}

const previewText = computed(() =>
  ready.value ? buildMessage() : "בחרו משימה והוסיפו לפחות אדם אחד עם שם ותפקיד."
);

watch([() => props.task, () => props.members, () => props.allComplete], () => { status.value = ""; });

async function share() {
  const text = buildMessage();
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (isTouch && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

async function copy() {
  try {
    await navigator.clipboard.writeText(buildMessage());
    status.value = "ההודעה הועתקה";
  } catch {
    status.value = "לא ניתן להעתיק. סמנו את הטקסט ידנית.";
  }
}
</script>

<style scoped>
.whatsapp-share {
  display: block;
  flex: none;
  padding: 14px 18px calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--line);
}

.ws-preview {
  margin-bottom: 12px;
  border: 1.5px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.ws-preview summary {
  min-height: var(--tap);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  cursor: pointer;
  font-weight: 600;
  color: var(--primary);
}
.ws-preview summary::-webkit-details-marker { display: none; }
.ws-preview summary::marker { content: ""; }
.ws-chevron {
  transition: transform .15s ease;
}
.ws-preview[open] .ws-chevron { transform: rotate(180deg); }
.ws-text {
  margin: 0;
  padding: 4px 12px 12px;
  max-height: 30vh;
  overflow: auto;
  white-space: pre-wrap;
  font: inherit;
  font-size: .92rem;
}

.ws-actions { display: flex; gap: 10px; }

.ws-share {
  flex: 1;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--wa), var(--wa-dark));
  color: #fff;
  font-weight: 700;
  font-size: 1.05rem;
  box-shadow: 0 4px 14px rgba(29, 168, 81, .32);
}
.ws-share:hover:not(:disabled) { filter: brightness(1.05); box-shadow: 0 6px 18px rgba(29, 168, 81, .4); }
.ws-share:disabled { box-shadow: none; }

.ws-copy {
  flex: none;
  padding: 0 18px;
  border: 1.5px solid var(--primary);
  border-radius: 10px;
  background: transparent;
  color: var(--primary);
  font-weight: 600;
}
.ws-copy:hover:not(:disabled) { background: #e3eef1; }

.ws-actions button:disabled { opacity: .4; cursor: not-allowed; }

.ws-status { margin: 8px 0 0; min-height: 1.2em; font-size: .85rem; color: var(--muted); }
</style>
```

- [ ] **Step 2: Finalize `src/App.vue`** (remove all debug scaffolding; final structure matches the old `index.html` body exactly)

```vue
<template>
  <main class="card">
    <header class="app-header">
      <h1>שיבוץ משימה</h1>
      <p>בחרו משימה, שבצו אנשים ושלחו בוואטסאפ</p>
    </header>

    <TaskSelect :tasks="tasks" v-model="task" />
    <TeamBuilder
      :people="people"
      :roles="roles"
      :locked="!task"
      @update:members="members = $event"
      @update:all-complete="allComplete = $event"
    />
    <WhatsappShare :task="task" :members="members" :all-complete="allComplete" :template="template" />

    <p v-if="error" class="app-error" role="alert">{{ error }}</p>
  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";
import TaskSelect from "./components/TaskSelect.vue";
import TeamBuilder from "./components/TeamBuilder.vue";
import WhatsappShare from "./components/WhatsappShare.vue";

const task = ref("");
const people = ref([]);
const roles = ref([]);
const tasks = ref([]);
const template = ref(null);
const error = ref("");
const members = ref([]);
const allComplete = ref(false);

function load(name) {
  return fetch(`data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`${name}.json (${r.status})`);
    return r.json();
  });
}

onMounted(async () => {
  try {
    const [p, t, r, tpl] = await Promise.all(["people", "tasks", "roles", "template"].map(load));
    people.value = p;
    tasks.value = t;
    roles.value = r;
    template.value = tpl;
  } catch (err) {
    error.value = `שגיאה בטעינת הנתונים: ${err.message}. יש להריץ את האתר משרת (ולא לפתוח את הקובץ ישירות).`;
  }
});
</script>
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open the printed URL.

Expected: pick a mission, add a complete person (name + role) — the message preview (behind the "תצוגה מקדימה של ההודעה" chevron) shows the filled-in template text; "שתף בוואטסאפ" and "העתק" become enabled; clicking "העתק" copies the text and shows "ההודעה הועתקה" below the buttons; clicking the chevron row toggles the preview open/closed. Stop the dev server when confirmed.

---

### Task 7: Full manual verification pass

**Files:** none (verification only).

**Interfaces:** none — this task only exercises the app built in Tasks 1–6.

- [ ] **Step 1: Run the dev server and verify every scenario from the spec**

Run: `npm run dev`, open the printed URL, and check each of the following (all were already validated in the vanilla-JS version and must behave identically here):

1. Team section is locked (inputs, remove, add-person button all disabled) until a mission is chosen; clearing the mission re-locks it while keeping entered data.
2. Duplicate-person prevention: picking a person in one row removes them from every other row's dropdown; removing that row makes them reappear elsewhere.
3. Mandatory fields: an incomplete row (missing name or role) blocks WhatsApp share/copy; the red outline + hint text appear after the field is visited and left empty.
4. Name field only accepts a person chosen from the dropdown — typed text that isn't confirmed via a pick is discarded on blur.
5. Role field is a real `<select>` showing all roles regardless of the current selection.
6. WhatsApp share/copy buttons enable only when a mission is chosen, at least one person exists, and every row is complete; the message preview collapses/expands via the chevron.
7. Visual polish (shadows, gradients, hover/focus states, spacing) looks the same as the current vanilla-JS version.

Expected: all seven pass. If any fails, fix the relevant component before moving on — do not proceed to Task 8 with a known regression.

- [ ] **Step 2: Run a production build and preview it**

Run: `npm run build`, then `npm run preview`, open the printed URL.

Expected: the build completes with no errors or warnings about unresolved imports; the previewed production build behaves identically to the dev server (repeat a quick spot-check of scenario 1 and 6 above against the built version). Stop the preview server when confirmed.

---

### Task 8: Cleanup — remove the old implementation, rewrite the README

**Files:**
- Delete: `app.js`
- Delete: `components/` (entire directory)
- Delete: `style.css` (old root file — superseded by `src/style.css`)
- Delete: `data/` (entire directory — superseded by `public/data/`)
- Modify: `README.md`

**Interfaces:** none — this is the final cleanup step, run only after Task 7 passes.

- [ ] **Step 1: Delete the old vanilla-JS files and folders**

Run:
```bash
rm app.js style.css
rm -rf components data
```

Expected: `ls` at the project root now shows only `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `node_modules/`, `public/`, `src/`, `README.md`, and the `docs/` folder from this migration's spec/plan.

- [ ] **Step 2: Rewrite `README.md`**

```md
# מחולל שיבוצי משימות

Vite + Vue 3.

## הרצה (פיתוח)

    npm install
    npm run dev

ואז לפתוח את הכתובת שמודפסת בטרמינל (בדרך כלל http://localhost:5173).

## בנייה לפרודקשן

    npm run build

התוצאה נשמרת בתיקיית `dist/` וניתנת להגשה מכל שרת סטטי. לבדיקה מקומית של הבנייה:

    npm run preview

## עריכת נתונים

כל הנתונים בתיקיית `public/data/` (אנשים, משימות, תפקידים, תבנית ההודעה) — נטענים בזמן ריצה, כך שניתן לערוך אותם גם אחרי build בלי לבנות מחדש.
```

- [ ] **Step 3: Final full verification**

Run: `npm run dev`, open the printed URL, and repeat the Task 7 Step 1 checklist (all 7 scenarios) once more to confirm nothing broke from deleting the old files.

Expected: all 7 scenarios still pass, with the old vanilla-JS files gone and only the Vite + Vue app present.
