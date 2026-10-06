<template>
  <AppLayout title="צפייה בדוח 1" :subtitle="`תאריך הדיווח: ${formatDate(date)}`">
    <div class="v1">
      <div class="v1-head">
        <section class="v1-selectors">
          <label class="v1-field">
            <span>סוג הדיווח</span>
            <select v-model="type" class="v1-type" aria-label="סוג הדיווח">
              <option v-for="t in REPORT_TYPES" :key="t.key" :value="t.key">{{ t.label }}</option>
            </select>
          </label>
          <label class="v1-field">
            <span>תאריך</span>
            <input v-model="date" type="date" class="v1-date" aria-label="תאריך">
          </label>
        </section>
      </div>

      <div class="v1-scroll">
        <p v-if="loading && !data" class="v1-state" role="status">טוען…</p>
        <p v-if="error" class="v1-alert" role="alert">
          {{ error }}
          <button type="button" class="v1-link" @click="load">נסו שוב</button>
        </p>

        <template v-if="data">
          <p v-if="!data.hasData" class="v1-state v1-nodata">אין נתוני דיווח לתאריך זה.</p>

          <section class="v1-section" aria-label="סיכום כללי">
            <h2>סיכום כללי</h2>
            <div class="v1-chips">
              <span class="v1-chip v1-chip-total"><span>סה"כ</span><b>{{ data.overall.total }}</b></span>
              <span v-for="c in overallChips" :key="c.key" class="v1-chip" :style="c.style"><span>{{ c.label }}</span><b>{{ c.count }}</b></span>
            </div>
          </section>

          <section v-if="data.departments.length > 1" class="v1-section" aria-label="לפי מחלקה">
            <h2>לפי מחלקה</h2>
            <ul class="v1-depts">
              <li v-for="d in data.departments" :key="d.name">
                <button type="button" class="v1-dept" :class="{ 'is-selected': sameDepartment(d.name, unit) }" :aria-pressed="sameDepartment(d.name, unit)" @click="toggleDepartment(d.name)">
                  <span class="v1-dept-head">
                    <span class="v1-dept-name">{{ d.name }}</span>
                    <span class="v1-dept-total">{{ d.total }} אנשים</span>
                  </span>
                  <span class="v1-chips">
                    <span v-for="c in chipsFor(d.counts, d.unreported, false)" :key="c.key" class="v1-chip" :style="c.style"><span>{{ c.label }}</span><b>{{ c.count }}</b></span>
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <section class="v1-section" aria-label="דוח אישי">
            <h2>דוח אישי<template v-if="unit"> – {{ unit }}</template></h2>
            <p v-if="!unit" class="v1-prompt">בחרו מחלקה מהרשימה למעלה כדי להציג את רשימת החיילים.</p>
            <p v-else-if="!data.details || !data.details.length" class="v1-state">אין חיילים להצגה במחלקה זו.</p>
            <div v-else class="v1-table-wrap">
              <table class="v1-table">
                <thead>
                  <tr>
                    <th scope="col" class="v1-col-num">#</th>
                    <th scope="col" :aria-sort="ariaSort('name')">
                      <button type="button" class="v1-th" @click="toggleSort('name')">שם<span class="v1-arrow" aria-hidden="true">{{ arrow('name') }}</span></button>
                    </th>
                    <th scope="col" :aria-sort="ariaSort('status')">
                      <button type="button" class="v1-th" @click="toggleSort('status')">סטטוס<span class="v1-arrow" aria-hidden="true">{{ arrow('status') }}</span></button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(p, i) in sortedDetails" :key="p.firstName + '|' + p.lastName">
                    <td class="v1-col-num">{{ i + 1 }}</td>
                    <td class="v1-person-name">{{ p.firstName }} {{ p.lastName }}</td>
                    <td><span class="v1-status" :style="statusOf(p.status).style">{{ statusOf(p.status).label }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import AppLayout from "../components/AppLayout.vue";
import { useAuth } from "../lib/auth.js";
import { normalizeDepartment } from "../lib/departments.js";
import { REPORT_TYPES, DEFAULT_TYPE, typeOf, todayISO, formatDate, formatSyncDate, UNREPORTED_LABEL } from "../lib/report1.js";
import { statusStyle } from "../lib/statusColors.js";
import { getReportView } from "../services/api.js";

const TYPE_STORAGE_KEY = "team_app_view1_type";
const SORT_STORAGE_KEY = "team_app_view1_sort";

const { canView1, viewDepartments } = useAuth();

// --- selectors ---
function readSavedType() {
  try {
    const saved = localStorage.getItem(TYPE_STORAGE_KEY);
    return REPORT_TYPES.some((t) => t.key === saved) ? saved : DEFAULT_TYPE;
  } catch {
    return DEFAULT_TYPE;
  }
}

function readSavedSort() {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY));
    if (["name", "status"].includes(saved?.key) && ["asc", "desc"].includes(saved?.dir)) return saved;
  } catch {
    // unreadable preference: use the default
  }
  return { key: "name", dir: "asc" };
}

const type = ref(readSavedType()); // the last chosen report type is remembered
const sort = ref(readSavedSort()); // and so is the last chosen sort of the personnel table: { key, dir }
const date = ref(todayISO()); // opens on today
const unit = ref("");

watch(type, (t) => {
  try {
    localStorage.setItem(TYPE_STORAGE_KEY, t);
  } catch {
    // preference only
  }
});
watch(sort, (v) => {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(v));
  } catch {
    // preference only
  }
}, { deep: true });
watch(date, (d) => { if (!d) date.value = todayISO(); });

const data = ref(null);
const loading = ref(false);
const error = ref("");

// A department is chosen by tapping its card (tap again to deselect). A user limited to a single
// department has nothing to choose, so it is selected right away.
const onlyAllowed = computed(() =>
  canView1.value && Array.isArray(viewDepartments.value) && viewDepartments.value.length === 1 ? viewDepartments.value[0] : ""
);
watch(onlyAllowed, (u) => { if (u) unit.value = u; }, { immediate: true });

const sameDepartment = (a, b) => Boolean(a) && Boolean(b) && normalizeDepartment(a) === normalizeDepartment(b);

function toggleDepartment(name) {
  if (data.value?.departments.length === 1) return; // a single department stays selected
  unit.value = sameDepartment(name, unit.value) ? "" : name;
}

// --- data ---
let requestSeq = 0;
async function load() {
  const seq = ++requestSeq;
  loading.value = true;
  error.value = "";
  const res = await getReportView({
    reportType: typeOf(type.value).syncName,
    date: formatSyncDate(date.value),
    department: unit.value,
  });
  if (seq !== requestSeq) return; // a newer request is already running
  loading.value = false;
  if (res.success) {
    data.value = res;
  } else if (!res.isAuthError) {
    data.value = null;
    error.value = res.error || res.message || "שגיאה בטעינת הדוח";
  }
}

// If only one department is visible there is nothing to pick: show its people right away.
watch(data, (d) => {
  if (d && d.departments.length === 1 && !unit.value) unit.value = d.departments[0].name;
});

watch([type, date, unit], load);
onMounted(load);

// --- display helpers ---
const optionByCode = computed(() => new Map((data.value?.options ?? []).map((o) => [o.code, o])));

function statusOf(code) {
  if (!code) return { label: UNREPORTED_LABEL, style: statusStyle("אפור") };
  const o = optionByCode.value.get(code);
  return o ? { label: o.name, style: statusStyle(o.color) } : { label: code, style: statusStyle("אפור") };
}

// Chips for a counts map: one per option (zero ones only when includeZero), "other" for unknown codes, then not reported.
function chipsFor(counts, unreported, includeZero) {
  const chips = [];
  for (const o of data.value?.options ?? []) {
    const count = counts[o.code] ?? 0;
    if (count || includeZero) chips.push({ key: o.code, label: o.name, count, style: statusStyle(o.color) });
  }
  const other = Object.keys(counts).filter((c) => !optionByCode.value.has(c)).reduce((n, c) => n + counts[c], 0);
  if (other) chips.push({ key: "__other", label: "אחר", count: other, style: statusStyle("אפור") });
  if (unreported) chips.push({ key: "__unreported", label: UNREPORTED_LABEL, count: unreported, style: statusStyle("אפור") });
  return chips;
}

// Personnel table: sort by name, or by status (in the report's option order, unknown codes next, not reported last).
// Tapping a column header sorts it ascending, tapping it again reverses it. A status sort ties by name.
const fullNameOf = (p) => `${p.firstName} ${p.lastName}`.trim();
const byName = (a, b) => fullNameOf(a).localeCompare(fullNameOf(b), "he");

const sortedDetails = computed(() => {
  const list = [...(data.value?.details ?? [])];
  const order = (data.value?.options ?? []).map((o) => o.code);
  const rank = (p) => {
    if (!p.status) return order.length + 1; // not reported
    const i = order.indexOf(p.status);
    return i === -1 ? order.length : i; // unknown codes after the known ones
  };
  const dir = sort.value.dir === "desc" ? -1 : 1;
  if (sort.value.key === "status") return list.sort((a, b) => (rank(a) - rank(b)) * dir || byName(a, b));
  return list.sort((a, b) => byName(a, b) * dir);
});

function toggleSort(key) {
  sort.value = sort.value.key === key
    ? { key, dir: sort.value.dir === "asc" ? "desc" : "asc" }
    : { key, dir: "asc" };
}
const arrow = (key) => (sort.value.key !== key ? "" : sort.value.dir === "asc" ? "▲" : "▼");
const ariaSort = (key) => (sort.value.key !== key ? "none" : sort.value.dir === "asc" ? "ascending" : "descending");

const overallChips = computed(() => (data.value ? chipsFor(data.value.overall.counts, data.value.overall.unreported, true) : []));
</script>

<style scoped>
.v1 { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.v1-head { flex: none; padding: 10px 18px 8px; }
.v1-scroll { flex: 1; min-height: 0; overflow-y: auto; border-top: 1px solid var(--line); padding: 12px 18px 18px; display: flex; flex-direction: column; gap: 14px; overscroll-behavior: contain; }
.v1-scroll > * { flex-shrink: 0; }

.v1-selectors { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.v1-field { display: flex; flex-direction: column; gap: 3px; min-width: 0; font-size: .72rem; font-weight: 700; color: var(--primary-dark); }
.v1-field select { min-height: 38px; padding: 4px 8px 4px 28px; background-position: left 6px center; }
.v1-date { min-height: 38px; width: 100%; padding: 0 10px; background: #fff; border: 1.5px solid var(--line); border-radius: 8px; }
.v1-date:focus-visible { outline: none; border-color: var(--focus); box-shadow: 0 0 0 3px rgba(232, 163, 23, .28); }
.v1-field select, .v1-date { font: inherit; font-size: .88rem; font-weight: 700; }
@media (max-width: 440px) {
  .v1-selectors { gap: 6px; }
  .v1-field { font-size: .68rem; }
  .v1-field select, .v1-date { font-size: .78rem; }
  .v1-field select { padding: 4px 6px 4px 22px; background-position: left 4px center; background-size: 14px; }
  .v1-date { padding: 0 4px; }
}

.v1-section h2 { margin: 0 0 8px; font-size: 1rem; color: var(--primary-dark); }
.v1-state, .v1-prompt { margin: 0; text-align: center; color: var(--muted); }
.v1-nodata { padding: 8px 12px; background: #fff4d6; color: #7a5a00; border-radius: 10px; font-weight: 600; }
.v1-alert { margin: 0; padding: 10px 12px; background: #f6dde0; color: var(--danger); font-weight: 600; font-size: .9rem; border-radius: 10px; }
.v1-link { font: inherit; color: var(--primary); background: none; border: 0; text-decoration: underline; min-height: 0; cursor: pointer; }

.v1-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.v1-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 2px 11px; background: #fff; border: 1px solid var(--line); border-radius: 999px; white-space: nowrap; font-size: .76rem; }
.v1-chip b { font-size: 1rem; font-weight: 800; line-height: 1; }
.v1-chip-total { color: var(--primary-dark); border-color: var(--primary); }

.v1-depts { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.v1-dept { width: 100%; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; text-align: start; background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-sm); cursor: pointer; }
.v1-dept:hover { border-color: var(--primary-light); }
.v1-dept.is-selected { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); background: #eef6f8; }
.v1-dept-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.v1-dept-name { font-weight: 700; color: var(--ink); }
.v1-dept-total { font-size: .8rem; color: var(--muted); }

.v1-table-wrap { overflow-x: auto; background: #fff; border: 1px solid var(--line); border-radius: 12px; }
.v1-table { width: 100%; border-collapse: collapse; }
.v1-table th, .v1-table td { padding: 8px 12px; text-align: start; border-bottom: 1px solid var(--line); }
.v1-table tbody tr:last-child td { border-bottom: 0; }
.v1-table thead th { position: sticky; top: 0; z-index: 1; padding: 0; background: #e3eef1; }
.v1-table thead th.v1-col-num { padding: 8px 12px; font-size: .8rem; color: var(--muted); }
.v1-col-num { width: 1%; white-space: nowrap; color: var(--muted); font-size: .8rem; font-variant-numeric: tabular-nums; }
.v1-th { width: 100%; min-height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 12px; font: inherit; font-size: .85rem; font-weight: 800; color: var(--primary-dark); background: none; border: 0; text-align: start; cursor: pointer; }
.v1-th:hover { background: #d3e5ea; }
.v1-th:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.v1-arrow { font-size: .7rem; color: var(--primary); }
.v1-person-name { font-weight: 700; color: var(--ink); }
.v1-status { padding: 3px 12px; font-size: .82rem; font-weight: 700; background: #fff; border: 1.5px solid; border-radius: 999px; white-space: nowrap; }
</style>
