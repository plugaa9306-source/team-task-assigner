<template>
  <main class="card">
    <header class="app-header">
      <div class="app-header-row">
        <h1>שיבוץ משימה</h1>
        <div class="app-header-actions">
          <router-link class="app-logout" :to="{ name: 'soldiers' }"><AppIcon name="users" :size="16" />פרטי חיילים</router-link>
          <button type="button" class="app-logout" @click="onLogout"><AppIcon name="logout" :size="16" />יציאה</button>
        </div>
      </div>
      <p>בחרו משימה, שבצו אנשים ושלחו בוואטסאפ</p>
    </header>

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
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import AppIcon from "../components/AppIcon.vue";
import TaskSelect from "../components/TaskSelect.vue";
import TeamBuilder from "../components/TeamBuilder.vue";
import WhatsappShare from "../components/WhatsappShare.vue";
import { fetchMissions, fetchRoles } from "../lib/missions.js";
import { useAuth } from "../lib/auth.js";
import { useRouter } from "vue-router";
import { useSoldiers, unitOf } from "../lib/soldiers.js";

const router = useRouter();
const { logout } = useAuth();

function onLogout() {
  logout();
  router.push({ name: "login" });
}

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
    const [t, r, tpl] = await Promise.all([fetchMissions(), fetchRoles(), load("template")]);
    tasks.value = t;
    roles.value = r;
    template.value = tpl;
  } catch (err) {
    error.value = `שגיאה בטעינת הנתונים: ${err.message}. יש להריץ את האתר משרת (ולא לפתוח את הקובץ ישירות) ולוודא חיבור לאינטרנט.`;
  }
});
</script>

<style scoped>
.app-header-actions { display: flex; align-items: center; gap: 8px; }
.app-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.app-logout {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  text-decoration: none;
  white-space: nowrap;
  font: inherit;
  font-size: .85rem;
  color: var(--primary-ink);
  background: rgba(255, 255, 255, .18);
  border: 1px solid rgba(255, 255, 255, .4);
  border-radius: var(--radius);
  padding: 0 14px;
  cursor: pointer;
  transition: background-color var(--ease);
}
.app-logout:hover { background: rgba(255, 255, 255, .28); }
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
