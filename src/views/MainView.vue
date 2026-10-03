<template>
  <AppLayout title="שיבוץ משימה" subtitle="בחרו משימה, שבצו אנשים ושלחו בוואטסאפ">
    <div class="pick-row" :class="{ 'has-unit': showUnit }">
      <TaskSelect :tasks="tasks" v-model="task" />
      <label v-if="showUnit" class="unit-field">
        <span class="unit-label">מחלקה</span>
        <select v-model="unit" class="soldiers-unit" aria-label="סינון לפי מחלקה">
          <option value="">כל המחלקות</option>
          <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
        </select>
      </label>
    </div>
    <div v-if="soldiersLoading || soldiersError" class="soldiers-bar">
      <p v-if="soldiersLoading" class="soldiers-status" role="status">
        <span class="soldiers-spinner" aria-hidden="true"></span>טוען רשימת חיילים…
      </p>
      <p v-else class="soldiers-status soldiers-error" role="alert">
        {{ soldiersError }}
        <button type="button" class="soldiers-retry" @click="loadSoldiers({ force: true })">נסו שוב</button>
      </p>
    </div>
    <TeamBuilder
      :people="people"
      :roles="roles"
      :locked="!task"
      @update:members="members = $event"
      @update:all-complete="allComplete = $event"
    />
    <WhatsappShare :task="task" :members="members" :all-complete="allComplete" :template="template" />

    <p v-if="error" class="app-error" role="alert">{{ error }}</p>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import AppLayout from "../components/AppLayout.vue";
import TaskSelect from "../components/TaskSelect.vue";
import TeamBuilder from "../components/TeamBuilder.vue";
import WhatsappShare from "../components/WhatsappShare.vue";
import { fetchMissions, fetchRoles } from "../lib/missions.js";
import { cachedSheetList } from "../lib/sheetCache.js";
import { useSoldiers, unitOf } from "../lib/soldiers.js";


const task = ref("");
const {
  soldiersList,
  isLoading: soldiersLoading,
  error: soldiersError,
  units,
  load: loadSoldiers,
} = useSoldiers();
const unit = ref("");
const showUnit = computed(() => !soldiersLoading.value && !soldiersError.value && units.value.length > 1);
const people = computed(() => (unit.value ? soldiersList.value.filter((s) => unitOf(s) === unit.value) : soldiersList.value));
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
  loadSoldiers();
  try {
    const [t, r, tpl] = await Promise.all([
      cachedSheetList("missions", fetchMissions),
      cachedSheetList("roles", fetchRoles),
      load("template"),
    ]);
    tasks.value = t;
    roles.value = r;
    template.value = tpl;
  } catch (err) {
    error.value = `שגיאה בטעינת הנתונים: ${err.message}. יש להריץ את האתר משרת (ולא לפתוח את הקובץ ישירות) ולוודא חיבור לאינטרנט.`;
  }
});
</script>

<style scoped>
.soldiers-bar { padding: 0 18px 4px; }
.soldiers-status { margin: 0 0 6px; display: flex; align-items: center; gap: 8px; font-size: .9rem; color: var(--muted); }
.soldiers-error { color: var(--danger); font-weight: 600; }
.soldiers-retry { font: inherit; color: var(--primary); background: none; border: 0; text-decoration: underline; cursor: pointer; }
/* mission and unit filter share one row */
.pick-row { display: grid; grid-template-columns: 1fr; gap: 10px; align-items: end; padding: 10px 10px 8px; }
.pick-row.has-unit { grid-template-columns: 1.5fr 1fr; }
.pick-row > .task-select { padding: 0; min-width: 0; }
.unit-field { display: block; min-width: 0; }
.unit-label { display: block; margin-bottom: 3px; font-size: .72rem; font-weight: 700; color: var(--primary-dark); }
/* same dropdown styling as the Report 1 selectors */
.soldiers-unit { width: 100%; min-height: 38px; padding: 4px 8px 4px 28px; background-position: left 6px center; font: inherit; font-size: .88rem; font-weight: 700; border: 1.5px solid var(--line); border-radius: 8px; background-color: #fff; }
@media (max-width: 440px) {
  .unit-label { font-size: .68rem; }
  .soldiers-unit { padding: 4px 6px 4px 22px; background-position: left 4px center; background-size: 14px; font-size: .78rem; }
}
.soldiers-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--line);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: soldiers-spin .7s linear infinite;
}
@keyframes soldiers-spin { to { transform: rotate(360deg); } }
</style>
