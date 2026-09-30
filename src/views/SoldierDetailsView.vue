<template>
  <main class="card sd">
    <header class="app-header">
      <div class="sd-header-row">
        <h1>פרטי חייל</h1>
        <router-link class="sd-back" :to="{ name: 'main' }">→ לשיבוץ</router-link>
      </div>
      <p>חיפוש לפי שם, מ"א או ת"ז</p>
    </header>

    <div class="sd-body">
      <div class="sd-search">
        <svg class="sd-search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
        </svg>
        <input
          ref="searchEl"
          v-model="query"
          type="search"
          class="sd-input"
          placeholder="חיפוש לפי שם, מ&quot;א או ת&quot;ז…"
          autocomplete="off"
          aria-label="חיפוש חייל"
          @input="onInput"
        >
        <button v-if="query" type="button" class="sd-clear" aria-label="נקה חיפוש" @click="clear">✕</button>

        <ul v-if="showPanel" class="sd-results" role="listbox">
          <li v-for="s in matches" :key="s.id + s.firstName + s.lastName" role="option" @click="pick(s)">
            <span class="sd-res-name">{{ s.firstName }} {{ s.lastName }}</span>
            <span v-if="unitOf(s)" class="sd-badge">{{ unitOf(s) }}</span>
          </li>
        </ul>
      </div>

      <p v-if="isLoading" class="sd-note" role="status">טוען רשימת חיילים…</p>
      <p v-else-if="error" class="sd-note sd-error" role="alert">
        {{ error }} <button type="button" class="sd-link" @click="load({ force: true })">נסו שוב</button>
      </p>
      <p v-else-if="!query.trim()" class="sd-note">הזינו שם, מ"א או ת"ז כדי להציג פרטי חייל.</p>
      <p v-else-if="!matches.length" class="sd-note">לא נמצא חייל התואם לחיפוש.</p>

      <article v-if="soldier" class="sd-profile">
        <div class="sd-hero">
          <div class="sd-avatar" aria-hidden="true">{{ initials }}</div>
          <h2>{{ soldier.firstName }} {{ soldier.lastName }}</h2>
          <span v-if="unitOf(soldier)" class="sd-badge">{{ unitOf(soldier) }}</span>
        </div>

        <dl class="sd-grid">
          <div v-for="t in tiles" :key="t.key" class="sd-tile">
            <dt>
              <svg class="sd-tile-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path v-for="d in FIELD_ICONS[t.key]" :key="d" :d="d" />
              </svg>
              {{ t.label }}
            </dt>
            <dd>
              <span class="sd-num" :dir="t.key === 'phone' ? 'ltr' : undefined">{{ t.value }}</span>
              <button v-if="t.key === 'id'" type="button" class="sd-copy" @click="copyId">{{ copied ? "הועתק ✓" : "העתק" }}</button>
            </dd>
          </div>
        </dl>

        <div class="sd-actions">
          <a v-if="telUrl(soldier.phone)" class="sd-btn sd-call" :href="telUrl(soldier.phone)"><svg class="sd-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>התקשר</a>
          <a v-if="whatsappChatUrl(soldier.phone)" class="sd-btn sd-wa" :href="whatsappChatUrl(soldier.phone)" target="_blank" rel="noopener"><svg class="sd-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.43 15.1L2 22l5.05-1.56A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.2 15.03l-.3-.18-3 .93.98-2.9-.2-.31A8.1 8.1 0 0 1 12.04 3.8zM8.6 7.4c-.2 0-.5.07-.75.35-.26.28-1 1-1 2.4s1.03 2.8 1.17 3c.15.2 2 3.2 4.95 4.35 2.45.97 2.95.78 3.48.73.53-.05 1.7-.7 1.94-1.37.24-.67.24-1.25.17-1.37-.07-.12-.26-.2-.55-.34-.29-.15-1.7-.84-1.97-.94-.26-.1-.46-.15-.65.15-.2.29-.75.94-.92 1.13-.17.2-.34.22-.63.07-.29-.14-1.22-.45-2.32-1.43-.86-.77-1.44-1.7-1.6-2-.18-.29-.02-.45.13-.6.13-.13.29-.34.44-.5.14-.18.2-.3.29-.5.1-.2.05-.37-.02-.52-.07-.14-.64-1.56-.88-2.13-.23-.56-.47-.48-.65-.49z"/></svg>וואטסאפ</a>
        </div>
        <button type="button" class="sd-edit" @click="openEdit">✎ דווח על טעות / עדכן פרטים</button>
      </article>
    </div>

    <div v-if="editing" class="sd-overlay" @click.self="editing = false">
      <form class="sd-modal" role="dialog" aria-modal="true" aria-labelledby="sd-modal-title" @submit.prevent="generate">
        <h2 id="sd-modal-title">עדכון פרטי חייל</h2>
        <label v-for="f in EDIT_FIELDS" :key="f.key" class="sd-field">
          <span>{{ f.label }}</span>
          <span class="sd-input-wrap">
            <svg class="sd-field-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path v-for="d in FIELD_ICONS[f.key]" :key="d" :d="d" />
            </svg>
            <input v-model="form[f.key]" type="text" :dir="f.key === 'phone' ? 'ltr' : undefined" autocomplete="off">
          </span>
        </label>
        <p v-if="noChanges" class="sd-error" role="alert">לא בוצעו שינויים.</p>
        <div class="sd-modal-actions">
          <button type="button" class="sd-btn sd-cancel" @click="editing = false">
            <svg class="sd-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>ביטול
          </button>
          <button type="submit" class="sd-btn sd-wa sd-submit">
            <svg class="sd-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.43 15.1L2 22l5.05-1.56A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.2 15.03l-.3-.18-3 .93.98-2.9-.2-.31A8.1 8.1 0 0 1 12.04 3.8zM8.6 7.4c-.2 0-.5.07-.75.35-.26.28-1 1-1 2.4s1.03 2.8 1.17 3c.15.2 2 3.2 4.95 4.35 2.45.97 2.95.78 3.48.73.53-.05 1.7-.7 1.94-1.37.24-.67.24-1.25.17-1.37-.07-.12-.26-.2-.55-.34-.29-.15-1.7-.84-1.97-.94-.26-.1-.46-.15-.65.15-.2.29-.75.94-.92 1.13-.17.2-.34.22-.63.07-.29-.14-1.22-.45-2.32-1.43-.86-.77-1.44-1.7-1.6-2-.18-.29-.02-.45.13-.6.13-.13.29-.34.44-.5.14-.18.2-.3.29-.5.1-.2.05-.37-.02-.52-.07-.14-.64-1.56-.88-2.13-.23-.56-.47-.48-.65-.49z"/></svg> שלח עדכון בוואטסאפ
          </button>
        </div>
      </form>
    </div>
  </main>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import { useSoldiers, unitOf } from "../lib/soldiers.js";
import { searchSoldiers } from "../lib/soldierSearch.js";
import {
  EDIT_FIELDS, editableValues, diffSoldier, buildUpdateMessage,
  whatsappTextUrl, whatsappChatUrl, telUrl, formatPhone,
} from "../lib/soldierUpdate.js";

const { soldiersList, isLoading, error, load } = useSoldiers();

// Stroke paths (24x24) for the edit-form field icons.
const FIELD_ICONS = {
  firstName: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 20a8 8 0 0 1 16 0"],
  lastName: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 20a8 8 0 0 1 16 0"],
  id: ["M4 6h16v12H4z", "M8 10h3M8 14h6", "M16 10.5h.01"],
  idNum: ["M3 6h18v12H3z", "M7.5 12a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z", "M5 16c.4-1.5 1.5-2.2 2.5-2.2S9.6 14.5 10 16", "M13.5 10h4M13.5 14h4"],
  phone: ["M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"],
  unit: ["M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z", "M9 12l2 2 4-4"],
};

const query = ref("");
const picked = ref(null);
const panelOpen = ref(true);
const copied = ref(false);
const editing = ref(false);
const noChanges = ref(false);
const form = reactive({});
const searchEl = ref(null);

onMounted(() => {
  load();
  searchEl.value?.focus();
});

const matches = computed(() => searchSoldiers(soldiersList.value, query.value));
// A single match opens its card automatically.
const soldier = computed(() => picked.value ?? (matches.value.length === 1 ? matches.value[0] : null));
const tiles = computed(() => {
  const s = soldier.value;
  if (!s) return [];
  return [
    { key: "id", label: 'מ"א', value: s.id },
    { key: "idNum", label: 'ת"ז', value: s.idNum || "—" },
    { key: "unit", label: "יחידה", value: unitOf(s) || "—" },
    { key: "phone", label: "טלפון", value: formatPhone(s.phone) || "—" },
  ];
});
const initials = computed(() => {
  const s = soldier.value;
  return s ? `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}` : "";
});
const showPanel = computed(() => panelOpen.value && !picked.value && matches.value.length > 1);

function onInput() {
  picked.value = null;
  panelOpen.value = true;
}
function pick(s) {
  picked.value = s;
  panelOpen.value = false;
}
function clear() {
  query.value = "";
  picked.value = null;
  panelOpen.value = true;
  searchEl.value?.focus();
}

async function copyId() {
  try {
    await navigator.clipboard.writeText(soldier.value.id);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    copied.value = false;
  }
}

function openEdit() {
  Object.assign(form, editableValues(soldier.value));
  noChanges.value = false;
  editing.value = true;
}

function generate() {
  const changes = diffSoldier(soldier.value, form);
  if (!changes.length) {
    noChanges.value = true;
    return;
  }
  window.open(whatsappTextUrl(buildUpdateMessage(soldier.value, changes)), "_blank", "noopener");
  editing.value = false;
}
</script>

<style scoped>
.sd-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sd-back { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 0 14px; white-space: nowrap; color: var(--primary-ink); font-size: .85rem; text-decoration: none; background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.4); border-radius: var(--radius); transition: background-color var(--ease); }
.sd-back:hover { background: rgba(255,255,255,.28); }
.sd-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }

.sd-search { position: relative; }
.sd-input { width: 100%; min-height: 46px; padding: 0 40px; font: inherit; background: #fff; border: 1.5px solid var(--line); border-radius: var(--radius); }
.sd-input:focus-visible { outline: none; border-color: var(--primary-light); box-shadow: 0 0 0 3px rgba(44,125,149,.25); }
.sd-search-icon { position: absolute; inset-inline-start: 13px; top: 14px; color: var(--muted); pointer-events: none; }
.sd-clear { position: absolute; inset-inline-end: 6px; top: 6px; width: 34px; height: 34px; border: 0; background: none; color: var(--muted); font-size: 1rem; cursor: pointer; }
.sd-results { position: absolute; z-index: 5; inset-inline: 0; top: calc(100% + 4px); margin: 0; padding: 4px; list-style: none; max-height: 260px; overflow-y: auto; background: #fff; border: 1.5px solid var(--primary); border-radius: var(--radius); box-shadow: var(--shadow-md); }
.sd-results li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px; border-radius: 8px; cursor: pointer; }
.sd-results li:hover { background: #e3eef1; }
.sd-badge { font-size: .78rem; font-weight: 700; color: var(--primary); background: #e3eef1; padding: 2px 10px; border-radius: 999px; white-space: nowrap; }

.sd-note { margin: 4px 0; color: var(--muted); text-align: center; }
.sd-error { color: var(--danger); font-weight: 600; }
.sd-link { font: inherit; color: var(--primary); background: none; border: 0; text-decoration: underline; cursor: pointer; }

.sd-profile { background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow-md); overflow: hidden; display: flex; flex-direction: column; }
.sd-hero { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 16px 16px; background: linear-gradient(180deg, #e3eef1, #fff); }
.sd-avatar { width: 68px; height: 68px; display: grid; place-items: center; font-size: 1.5rem; font-weight: 700; color: var(--primary-ink); background: linear-gradient(135deg, var(--primary-light), var(--primary-dark)); border-radius: 50%; box-shadow: var(--shadow-md); border: 3px solid #fff; }
.sd-hero h2 { margin: 0; font-size: 1.4rem; color: var(--primary-dark); text-align: center; }
.sd-grid { margin: 0; padding: 4px 16px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sd-tile { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; min-width: 0; }
.sd-tile dt { display: flex; align-items: center; gap: 6px; font-size: .75rem; color: var(--muted); margin-bottom: 4px; }
.sd-tile-icon { flex: none; color: var(--primary); }
.sd-tile dd { margin: 0; min-height: 26px; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.sd-num { font-variant-numeric: tabular-nums; letter-spacing: .3px; }
.sd-copy { min-height: 0; height: 24px; padding: 0 10px; font-size: .72rem; font-weight: 700; color: var(--primary); background: #e3eef1; border: 0; border-radius: 999px; }
.sd-copy:hover { background: #d3e5ea; }
.sd-actions { display: flex; gap: 10px; padding: 0 16px; }
.sd-btn { flex: 1; min-height: 46px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; line-height: 1; font-weight: 700; text-decoration: none; border: 0; border-radius: 12px; color: #fff; box-shadow: var(--shadow-sm); transition: transform var(--ease), box-shadow var(--ease); }
.sd-btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
.sd-icon { flex: none; display: block; }
.sd-btn .sd-icon { width: 22px; height: 22px; }
.sd-call { background: linear-gradient(135deg, var(--primary-light), var(--primary)); }
.sd-wa { background: linear-gradient(135deg, #25c05f, var(--wa-dark)); }
.sd-edit { align-self: center; margin: 12px 0 14px; min-height: 36px; padding: 0 14px; font-size: .88rem; font-weight: 600; color: var(--muted); background: none; border: 0; border-radius: 999px; }
.sd-edit:hover { color: var(--primary); background: #e3eef1; }
.sd-cancel { background: transparent; color: var(--muted); border: 1.5px solid var(--line); box-shadow: none; }

.sd-overlay { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px; background: rgba(21,35,43,.5); }
.sd-modal { width: 100%; max-width: 420px; max-height: 100%; overflow-y: auto; background: var(--card); border-radius: 16px; box-shadow: var(--shadow-md); padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.sd-modal h2 { margin: 0 0 4px; color: var(--primary-dark); font-size: 1.15rem; }
.sd-field { display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: .85rem; color: var(--primary-dark); }
.sd-input-wrap { position: relative; display: block; }
.sd-field-icon { position: absolute; inset-inline-start: 12px; top: 50%; transform: translateY(-50%); color: var(--primary); pointer-events: none; }
.sd-field input { min-height: 44px; padding: 0 12px; padding-inline-start: 38px; font-weight: 400; border-radius: var(--radius); }
.sd-modal-actions { display: flex; gap: 8px; margin-top: 6px; }
.sd-modal-actions .sd-cancel { flex: 0 0 auto; }
.sd-submit { white-space: nowrap; }
</style>
