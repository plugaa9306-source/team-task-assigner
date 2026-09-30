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
