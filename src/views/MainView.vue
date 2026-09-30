<template>
  <main class="card">
    <header class="app-header">
      <div class="app-header-row">
        <h1>שיבוץ משימה</h1>
        <button type="button" class="app-logout" @click="onLogout">יציאה</button>
      </div>
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
import TaskSelect from "../components/TaskSelect.vue";
import TeamBuilder from "../components/TeamBuilder.vue";
import WhatsappShare from "../components/WhatsappShare.vue";
import { fetchMissions, fetchRoles } from "../lib/missions.js";
import { useAuth } from "../lib/auth.js";
import { useRouter } from "vue-router";

const router = useRouter();
const { logout } = useAuth();

function onLogout() {
  logout();
  router.push({ name: "login" });
}

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
    const [p, t, r, tpl] = await Promise.all([load("people"), fetchMissions(), fetchRoles(), load("template")]);
    people.value = p;
    tasks.value = t;
    roles.value = r;
    template.value = tpl;
  } catch (err) {
    error.value = `שגיאה בטעינת הנתונים: ${err.message}. יש להריץ את האתר משרת (ולא לפתוח את הקובץ ישירות) ולוודא חיבור לאינטרנט.`;
  }
});
</script>

<style scoped>
.app-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.app-logout {
  font: inherit;
  font-size: .85rem;
  color: var(--primary-ink);
  background: rgba(255, 255, 255, .18);
  border: 1px solid rgba(255, 255, 255, .4);
  border-radius: var(--radius);
  padding: 4px 12px;
  cursor: pointer;
}
</style>
