<template>
  <AppLayout :title="reportType.label" :subtitle="`תאריך הדיווח: ${formatDate(date)}`">
    <div class="r1">
      <div class="r1-head">
        <p v-if="optionsError" class="r1-alert" role="alert">
          {{ optionsError }}
          <button type="button" class="r1-link" @click="loadOptions({ force: true })">נסו שוב</button>
        </p>
        <section class="r1-selectors">
          <label class="r1-field">
            <span>סוג הדיווח</span>
            <select v-model="type" aria-label="סוג הדיווח" :disabled="controlsDisabled">
              <option v-for="t in REPORT_TYPES" :key="t.key" :value="t.key">{{ t.label }}</option>
            </select>
          </label>
          <label class="r1-field">
            <span>תאריך</span>
            <input type="date" class="r1-date" :value="date" :min="today" aria-label="בחירת תאריך" :disabled="controlsDisabled" @change="onDate">
          </label>
          <label class="r1-field">
            <span>מחלקה</span>
            <select v-model="unit" class="r1-unit" :class="{ 'is-locked': onlyUnit }" aria-label="בחירת מחלקה" :disabled="controlsDisabled || noUnits || Boolean(onlyUnit)">
              <option value="" disabled>{{ noUnits ? "אין מחלקות לעדכון" : "בחרו מחלקה…" }}</option>
              <option v-for="u in availableUnits" :key="u" :value="u">{{ u }}</option>
            </select>
          </label>
        </section>

        <section class="r1-kpis" aria-label="סיכום המחלקה">
          <div class="r1-kpi r1-kpi-total"><span class="r1-kpi-label">סה"כ</span><span class="r1-kpi-num">{{ stats.total }}</span></div>
          <div v-for="st in statuses" :key="st.key" class="r1-kpi r1-kpi-status" :style="statusStyle(st.color)">
            <span class="r1-kpi-label">{{ st.label }}</span><span class="r1-kpi-num">{{ stats.byStatus[st.key] }}</span>
          </div>
          <div class="r1-kpi k-unreported"><span class="r1-kpi-label">לא דווח</span><span class="r1-kpi-num">{{ stats.unreported }}</span></div>
        </section>
      </div>

      <div class="r1-scroll">
        <p v-if="isLoading" class="r1-state" role="status">טוען רשימת חיילים…</p>
        <p v-else-if="error" class="r1-state r1-error" role="alert">
          {{ error }} <button type="button" class="r1-link" @click="reload">נסו שוב</button>
        </p>
        <p v-if="!isLoading && !error && !unit" class="r1-state">בחרו מחלקה כדי להציג את רשימת החיילים.</p>
        <p v-else-if="!isLoading && !error && !rows.length" class="r1-state">אין חיילים להצגה.</p>

        <ul class="r1-list">
          <li v-for="s in rows" :key="rowKey(s)" class="r1-row" :style="rowStyle(s)">
            <div class="r1-row-head">
              <span class="r1-name">{{ fullName(s) }}</span>
              <div v-if="telUrl(s.phone)" class="r1-quick">
                <a class="r1-circle r1-call" :href="telUrl(s.phone)" title="חייג" :aria-label="`חייג ל${fullName(s)}`">
                  <AppIcon name="phone" :size="19" />
                </a>
                <a
                  class="r1-circle r1-wa-chat"
                  :href="whatsappChatUrl(s.phone)"
                  target="_blank"
                  rel="noopener"
                  title="שלח הודעה בוואטסאפ"
                  :aria-label="`שלח הודעה בוואטסאפ ל${fullName(s)}`"
                >
                  <AppIcon name="whatsapp" :size="21" />
                </a>
              </div>
            </div>
            <div class="r1-controls">
              <select
                class="r1-status"
                :value="entryOf(entries, s).status"
                :style="selectStyle(s)"
                :disabled="controlsDisabled"
                :aria-label="`סטטוס – ${fullName(s)}`"
                @change="setStatus(s, $event.target.value)"
              >
                <option value="" disabled>בחרו סטטוס…</option>
                <option v-for="st in statuses" :key="st.key" :value="st.key">{{ st.label }}</option>
              </select>
              <input
                type="text"
                class="r1-note-input"
                :value="entryOf(entries, s).note"
                :disabled="controlsDisabled"
                placeholder="הערות…"
                :aria-label="`הערות – ${fullName(s)}`"
                @input="setNote(s, $event.target.value)"
              >
            </div>
          </li>
        </ul>

      </div>

      <footer ref="footerEl" class="r1-footer">
        <div v-show="previewOpen" id="r1-preview" class="r1-preview" role="region" aria-label="תצוגה מקדימה של ההודעה">
          <pre class="r1-preview-text">{{ previewText }}</pre>
        </div>
        <div class="r1-actions">
          <button
            type="button"
            class="r1-preview-btn"
            title="תצוגה מקדימה"
            aria-label="תצוגה מקדימה"
            aria-controls="r1-preview"
            :aria-expanded="previewOpen"
            @click="previewOpen = !previewOpen"
          >
            <AppIcon name="chat" :size="22" />
          </button>
          <button type="button" class="r1-btn r1-wa" :disabled="controlsDisabled || !unit || !unitSoldiers.length" @click="shareWhatsapp">
            <AppIcon name="whatsapp" :size="20" />שלח דוח
          </button>
        </div>
      </footer>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";
import AppLayout from "../components/AppLayout.vue";
import AppIcon from "../components/AppIcon.vue";
import { useSoldiers, unitOf } from "../lib/soldiers.js";
import { whatsappTextUrl, whatsappChatUrl, telUrl } from "../lib/soldierUpdate.js";
import { getReportOptions, syncReportInBackground } from "../services/api.js";
import { statusStyle, mapHebrewColorToCss } from "../lib/statusColors.js";
import { useAuth } from "../lib/auth.js";
import { updatableUnits } from "../lib/departments.js";
import { loadDraft, saveDraft } from "../lib/report1Draft.js";
import { loadReportOptions, saveReportOptions } from "../lib/reportOptionsCache.js";
import {
  REPORT_TYPES, DEFAULT_TYPE, typeOf, rowKey, fullName, entryOf, computeStats, buildSummary, buildSyncPayload, statusesFromData, todayISO, formatDate,
} from "../lib/report1.js";

const { soldiersList, isLoading, error, units, load } = useSoldiers();

// Only the departments this user may update are offered (canUpdate1: TRUE = all, a list = those, FALSE = none).
const { canUpdate1, updateDepartments } = useAuth();
const availableUnits = computed(() =>
  updatableUnits(units.value, { canUpdate1: canUpdate1.value, updateDepartments: updateDepartments.value })
);
const noUnits = computed(() => !isLoading.value && !availableUnits.value.length);


const today = todayISO();
// Restore the last state (type, platoon, entered statuses/notes); the date always starts on today.
const draft = loadDraft();
const type = ref(REPORT_TYPES.some((t) => t.key === draft.type) ? draft.type : DEFAULT_TYPE);
const date = ref(today);
const unit = ref(draft.unit);
// With a single allowed department there is nothing to choose: it is selected and the dropdown is locked.
const onlyUnit = computed(() => (availableUnits.value.length === 1 ? availableUnits.value[0] : ""));
watch(onlyUnit, (u) => { if (u) unit.value = u; }, { immediate: true });

const reportType = computed(() => typeOf(type.value));

// Status choices come from the server: { report1: [...], arrivalForecast: [...] } (kept in local state).
// Cached in localStorage until logout, so the request is only made when nothing is cached.
const cachedOptions = loadReportOptions();
const report1Options = ref(cachedOptions?.report1 ?? []);
const arrivalForecastOptions = ref(cachedOptions?.arrivalForecast ?? []);
const optionsLoading = ref(!cachedOptions);
const optionsError = ref("");
const statuses = computed(() => (type.value === "arrival" ? arrivalForecastOptions.value : report1Options.value));
// Nothing can be edited until the options arrived (or if they failed to load).
const controlsDisabled = computed(() => optionsLoading.value || Boolean(optionsError.value));

async function loadOptions({ force = false } = {}) {
  if (!force && (report1Options.value.length || arrivalForecastOptions.value.length)) return;
  optionsLoading.value = true;
  optionsError.value = "";
  const res = await getReportOptions();
  optionsLoading.value = false;
  if (!res.success) {
    optionsError.value = res.isAuthError
      ? "אין הרשאה לטעינת אפשרויות הדיווח."
      : res.error || res.message || "שגיאה בטעינת אפשרויות הדיווח.";
    return;
  }
  // tolerate the lists being at the top level of the reply instead of inside `data`
  const payload = res.data ?? res;
  report1Options.value = statusesFromData(payload, "report1");
  arrivalForecastOptions.value = statusesFromData(payload, "arrival");
  if (!report1Options.value.length && !arrivalForecastOptions.value.length) {
    optionsError.value = "השרת לא החזיר אפשרויות סטטוס לדיווח.";
    return;
  }
  saveReportOptions({ report1: report1Options.value, arrivalForecast: arrivalForecastOptions.value });
}

// Entries are kept per report type + date so switching between them never loses edits (local only).
const store = reactive(draft.store);
const key = computed(() => `${type.value}|${date.value}`);
const entries = computed(() => store[key.value] ?? {});


const unitSoldiers = computed(() => (unit.value ? soldiersList.value.filter((s) => unitOf(s) === unit.value) : []));
const stats = computed(() => computeStats(unitSoldiers.value, entries.value, statuses.value));
const rows = unitSoldiers;

const previewText = computed(() =>
  unit.value && unitSoldiers.value.length
    ? buildSummary(unitSoldiers.value, entries.value, type.value, date.value, unit.value, statuses.value)
    : "בחרו מחלקה כדי לראות תצוגה מקדימה של ההודעה."
);

function touch(s, patch) {
  const k = key.value;
  store[k] = { ...(store[k] ?? {}), [rowKey(s)]: { ...entryOf(entries.value, s), ...patch } };
}
const setStatus = (s, status) => touch(s, { status });
const setNote = (s, note) => touch(s, { note });

function onDate(e) {
  const v = e.target.value;
  if (!v || v < today) {
    e.target.value = date.value; // past dates are not allowed
    return;
  }
  date.value = v;
}

const reload = () => load({ force: true });

// The chosen status (if it is one of this report's options) tints the row accent and its dropdown.
const chosenStatus = (s) => statuses.value.find((st) => st.key === entryOf(entries.value, s).status);
const rowStyle = (s) => {
  const st = chosenStatus(s);
  return st ? { borderInlineStartColor: mapHebrewColorToCss(st.color).border } : {};
};
const selectStyle = (s) => {
  const st = chosenStatus(s);
  return st ? statusStyle(st.color) : {};
};

// The preview opens as a popover above the footer; it closes on Escape or a tap outside it.
const previewOpen = ref(false);
const footerEl = ref(null);
const onOutside = (e) => {
  if (previewOpen.value && footerEl.value && !footerEl.value.contains(e.target)) previewOpen.value = false;
};
const onKey = (e) => {
  if (e.key === "Escape") previewOpen.value = false;
};
onMounted(() => {
  document.addEventListener("pointerdown", onOutside);
  document.addEventListener("keydown", onKey);
});
onUnmounted(() => {
  document.removeEventListener("pointerdown", onOutside);
  document.removeEventListener("keydown", onKey);
});

// WhatsApp opens first and instantly; the sheet update is fired afterwards in the background
// (not awaited, no UI, failures only logged).
function shareWhatsapp() {
  window.open(whatsappTextUrl(previewText.value), "_blank", "noopener");
  syncReportInBackground(buildSyncPayload(unitSoldiers.value, entries.value, type.value, date.value, unit.value));
}

watch([type, unit, store], () => saveDraft({ type: type.value, unit: unit.value, store }), { deep: true });

onMounted(async () => {
  loadOptions();
  await load();
  if (unit.value && !availableUnits.value.includes(unit.value)) unit.value = ""; // remembered platoon no longer exists or is not allowed
});
</script>

<style scoped>
.r1 { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.r1-head { flex: none; padding: 10px 10px 8px; display: flex; flex-direction: column; gap: 8px; }
/* only the list of names scrolls; selectors and counters stay in view */
.r1-scroll { flex: 1; min-height: 0; overflow-y: auto; border-top: 1px solid var(--line); padding: 12px 10px 14px; display: flex; flex-direction: column; gap: 12px; overscroll-behavior: contain; }
/* children must keep their natural height; the column scrolls instead of squeezing them */
.r1-scroll > * { flex-shrink: 0; }

.r1-selectors { display: grid; grid-template-columns: 1fr 1.15fr 1fr; gap: 8px; }
.r1-field { display: flex; flex-direction: column; gap: 3px; min-width: 0; font-size: .72rem; font-weight: 700; color: var(--primary-dark); }
.r1-field select { min-height: 38px; padding: 4px 8px 4px 28px; background-position: left 6px center; }
.r1-date { min-height: 38px; width: 100%; padding: 0 10px; background: #fff; border: 1.5px solid var(--line); border-radius: 8px; }
/* a locked single option stays readable (disabled selects are greyed by default) */
.r1-unit.is-locked:disabled { opacity: 1; color: var(--primary-dark); -webkit-text-fill-color: var(--primary-dark); }
.r1-date:focus-visible { outline: none; border-color: var(--focus); box-shadow: 0 0 0 3px rgba(232, 163, 23, .28); }
/* the date and the dropdowns share one text size and weight */
.r1-field select, .r1-date { font: inherit; font-size: .88rem; font-weight: 700; }
/* all three selectors stay on one line, even on narrow phones */
@media (max-width: 440px) {
  .r1-selectors { gap: 6px; }
  .r1-field { font-size: .68rem; }
  .r1-field select, .r1-date { font-size: .78rem; }
  .r1-field select { padding: 4px 6px 4px 22px; background-position: left 4px center; background-size: 14px; }
  .r1-date { padding: 0 4px; }
}

/* one line when it fits; otherwise the counters wrap onto the next line */
.r1-kpis { display: flex; flex-wrap: wrap; gap: 6px; }
.r1-kpi { flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 2px 11px; background: #fff; border: 1px solid var(--line); border-radius: 999px; white-space: nowrap; }
.r1-kpi-num { font-size: 1rem; font-weight: 800; line-height: 1; color: var(--primary-dark); }
.r1-kpi-label { font-size: .76rem; color: var(--muted); }
/* status chips take their text/border color from the server-provided status color (inline style) */
.r1-kpi-status .r1-kpi-num, .r1-kpi-status .r1-kpi-label { color: inherit; }
.k-unreported .r1-kpi-num { color: var(--muted); }
/* the total chip uses the app's teal, like the status chips use their own colors */
.r1-kpi-total { color: var(--primary-dark); border-color: var(--primary); }
.r1-kpi-total .r1-kpi-num, .r1-kpi-total .r1-kpi-label { color: inherit; }

.r1-alert { margin: 0; padding: 10px 12px; background: #f6dde0; color: var(--danger); font-weight: 600; font-size: .9rem; border-radius: 10px; }
.r1-state { margin: 0; text-align: center; color: var(--muted); }
.r1-error { color: var(--danger); font-weight: 600; }
.r1-link { font: inherit; color: var(--primary); background: none; border: 0; text-decoration: underline; min-height: 0; }

.r1-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.r1-row { display: flex; flex-direction: column; gap: 8px; padding: 8px 10px; background: #fff; border: 1px solid var(--line); border-inline-start: 5px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-sm); }
.r1-name { font-weight: 700; color: var(--ink); }
.r1-row-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.r1-quick { display: flex; gap: 8px; flex: none; }
.r1-circle { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; text-decoration: none; transition: transform var(--ease), box-shadow var(--ease); }
.r1-circle:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.r1-circle:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.r1-call { background: #DCFCE7; color: #166534; }
.r1-wa-chat { background: #25D366; color: #fff; }
.r1-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.r1-note-input { min-height: var(--tap); }
@media (max-width: 420px) { .r1-controls { grid-template-columns: 1fr; } }

.r1-footer { position: relative; flex: none; padding: 8px 11px 12px; border-top: 1px solid var(--line); background: var(--card); }
.r1-preview { position: absolute; z-index: 10; left: 12px; right: 12px; bottom: calc(100% + 6px); max-height: min(45vh, 320px); overflow: auto; background: #fff; border: 1.5px solid var(--primary); border-radius: 12px; box-shadow: var(--shadow-md); }
.r1-preview-text { margin: 0; padding: 12px 14px; white-space: pre-wrap; font: inherit; font-size: .9rem; }
.r1-preview-btn { flex: none; width: 46px; height: 46px; display: inline-flex; align-items: center; justify-content: center; padding: 0; color: var(--primary); background: #fff; border: 1.5px solid var(--primary); border-radius: 12px; cursor: pointer; }
.r1-preview-btn:hover, .r1-preview-btn[aria-expanded="true"] { background: #e3eef1; }
.r1-preview-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.r1-actions { display: flex; gap: 10px; }
.r1-btn { flex: 1; min-height: 46px; height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; font-weight: 700; line-height: 1; color: #fff; border: 0; border-radius: 12px; box-shadow: var(--shadow-sm); }
.r1-btn:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
.r1-wa { background: linear-gradient(135deg, #25c05f, var(--wa-dark)); }
</style>
