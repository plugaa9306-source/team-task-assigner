<template>
  <AppLayout title="שיבוץ משימה" subtitle="בחרו משימה, שבצו אנשים ושלחו בוואטסאפ">
    <TaskSelect :tasks="tasks" v-model="task" />
    <div class="soldiers-bar">
      <p v-if="soldiersLoading" class="soldiers-status" role="status">
        <span class="soldiers-spinner" aria-hidden="true"></span>טוען רשימת חיילים…
      </p>
      <p v-else-if="soldiersError" class="soldiers-status soldiers-error" role="alert">
        {{ soldiersError }}
        <button type="button" class="soldiers-retry" @click="loadSoldiers({ force: true })">נסו שוב</button>
      </p>
      <select v-else-if="units.length > 1" v-model="unit" class="soldiers-unit" aria-label="סינון לפי יחידה">
        <option value="">כל היחידות</option>
        <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
      </select>
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
.soldiers-bar { padding: 0 18px; }
.soldiers-status { margin: 0 0 6px; display: flex; align-items: center; gap: 8px; font-size: .9rem; color: var(--muted); }
.soldiers-error { color: var(--danger); font-weight: 600; }
.soldiers-retry { font: inherit; color: var(--primary); background: none; border: 0; text-decoration: underline; cursor: pointer; }
.soldiers-unit {
  width: 100%;
  min-height: 38px;
  margin-bottom: 4px;
  font: inherit;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: #fff;
  padding: 0 10px;
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
