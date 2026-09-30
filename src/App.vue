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
