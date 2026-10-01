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
            <span>בחירת תאריך</span>
            <input type="date" class="r1-date" :value="date" :min="today" aria-label="בחירת תאריך" :disabled="controlsDisabled" @change="onDate">
          </label>
          <label class="r1-field r1-field-wide">
            <span>בחירת מחלקה</span>
            <select v-model="unit" class="r1-unit" aria-label="בחירת מחלקה" :disabled="controlsDisabled">
              <option value="" disabled>בחרו מחלקה…</option>
              <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
            </select>
          </label>
        </section>

        <section class="r1-kpis" aria-label="סיכום המחלקה">
          <div class="r1-kpi r1-kpi-total"><span class="r1-kpi-num">{{ stats.total }}</span><span class="r1-kpi-label">סה"כ</span></div>
          <div v-for="st in statuses" :key="st.key" class="r1-kpi r1-kpi-status" :style="statusStyle(st.color)">
            <span class="r1-kpi-num">{{ stats.byStatus[st.key] }}</span><span class="r1-kpi-label">{{ st.label }}</span>
          </div>
          <div class="r1-kpi k-unreported"><span class="r1-kpi-num">{{ stats.unreported }}</span><span class="r1-kpi-label">לא דווח</span></div>
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

      <footer class="r1-footer">
        <details class="r1-preview">
          <summary><span class="r1-sum-label"><AppIcon name="chat" :size="18" />תצוגה מקדימה</span><span aria-hidden="true">▾</span></summary>
          <pre class="r1-preview-text">{{ previewText }}</pre>
        </details>
        <div class="r1-actions">
          <button type="button" class="r1-btn r1-wa" :disabled="controlsDisabled || !unit || !unitSoldiers.length" @click="shareWhatsapp">
            <AppIcon name="whatsapp" :size="20" />שלח בוואטסאפ
          </button>
        </div>
      </footer>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import AppLayout from "../components/AppLayout.vue";
import AppIcon from "../components/AppIcon.vue";
import { useSoldiers, unitOf } from "../lib/soldiers.js";
import { whatsappTextUrl, whatsappChatUrl, telUrl } from "../lib/soldierUpdate.js";
import { getReportOptions } from "../services/api.js";
import { statusStyle, mapHebrewColorToCss } from "../lib/statusColors.js";
import { loadDraft, saveDraft } from "../lib/report1Draft.js";
import { loadReportOptions, saveReportOptions } from "../lib/reportOptionsCache.js";
import {
  REPORT_TYPES, DEFAULT_TYPE, typeOf, rowKey, fullName, entryOf, computeStats, buildSummary, statusesFromData, todayISO, formatDate,
} from "../lib/report1.js";

const { soldiersList, isLoading, error, units, load } = useSoldiers();

const today = todayISO();
// Restore the last state (type, platoon, entered statuses/notes); the date always starts on today.
const draft = loadDraft();
const type = ref(REPORT_TYPES.some((t) => t.key === draft.type) ? draft.type : DEFAULT_TYPE);
const date = ref(today);
const unit = ref(draft.unit);

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

function shareWhatsapp() {
  window.open(whatsappTextUrl(previewText.value), "_blank", "noopener");
}

watch([type, unit, store], () => saveDraft({ type: type.value, unit: unit.value, store }), { deep: true });

onMounted(async () => {
  loadOptions();
  await load();
  if (unit.value && !units.value.includes(unit.value)) unit.value = ""; // the remembered platoon no longer exists
});
</script>

<style scoped>
.r1 { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.r1-head { flex: none; padding: 14px 18px 8px; display: flex; flex-direction: column; gap: 12px; }
/* only the list of names scrolls; selectors and counters stay in view */
.r1-scroll { flex: 1; min-height: 0; overflow-y: auto; border-top: 1px solid var(--line); padding: 12px 18px 14px; display: flex; flex-direction: column; gap: 12px; overscroll-behavior: contain; }
/* children must keep their natural height; the column scrolls instead of squeezing them */
.r1-scroll > * { flex-shrink: 0; }

.r1-selectors { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.r1-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; font-size: .8rem; font-weight: 700; color: var(--primary-dark); }
.r1-field-wide { grid-column: 1 / -1; }
.r1-date { min-height: var(--tap); width: 100%; padding: 0 10px; font: inherit; font-weight: 400; background: #fff; border: 1.5px solid var(--line); border-radius: 8px; }
.r1-date:focus-visible { outline: none; border-color: var(--focus); box-shadow: 0 0 0 3px rgba(232, 163, 23, .28); }

.r1-kpis { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(58px, 1fr); gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.r1-kpi { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 8px 2px; background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-sm); }
.r1-kpi-num { font-size: 1.25rem; font-weight: 800; line-height: 1.1; color: var(--primary-dark); }
.r1-kpi-label { font-size: .7rem; color: var(--muted); text-align: center; white-space: nowrap; }
/* status counters take their color from the server-provided status color (inline style) */
.r1-kpi-status .r1-kpi-num, .r1-kpi-status .r1-kpi-label { color: inherit; }
.k-unreported .r1-kpi-num { color: var(--muted); }


.r1-alert { margin: 0; padding: 10px 12px; background: #f6dde0; color: var(--danger); font-weight: 600; font-size: .9rem; border-radius: 10px; }
.r1-state { margin: 0; text-align: center; color: var(--muted); }
.r1-error { color: var(--danger); font-weight: 600; }
.r1-link { font: inherit; color: var(--primary); background: none; border: 0; text-decoration: underline; min-height: 0; }

.r1-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.r1-row { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; background: #fff; border: 1px solid var(--line); border-inline-start: 5px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-sm); }
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

.r1-footer { flex: none; padding: 8px 18px 14px; border-top: 1px solid var(--line); background: var(--card); }
.r1-preview { background: #fff; border: 1.5px solid var(--line); border-radius: 10px; margin-bottom: 6px; }
.r1-preview summary { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; font-weight: 700; color: var(--primary-dark); cursor: pointer; list-style: none; }
.r1-preview summary::-webkit-details-marker { display: none; }
.r1-sum-label { display: inline-flex; align-items: center; gap: 8px; }
.r1-preview[open] summary { border-bottom: 1px solid var(--line); }
.r1-preview-text { margin: 0; padding: 10px 14px; max-height: 180px; overflow: auto; white-space: pre-wrap; font: inherit; font-size: .9rem; }
.r1-actions { display: flex; gap: 10px; }
.r1-btn { flex: 1; min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; font-weight: 700; line-height: 1; color: #fff; border: 0; border-radius: 12px; box-shadow: var(--shadow-sm); }
.r1-btn:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
.r1-wa { background: linear-gradient(135deg, #25c05f, var(--wa-dark)); }
</style>
