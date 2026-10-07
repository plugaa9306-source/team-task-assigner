<template>
  <div class="team-builder">
    <div class="tb-head">
      <h2><AppIcon name="users" :size="18" />צוות</h2>
      <span class="tb-count" aria-live="polite">{{ countText }}</span>
    </div>
    <div class="tb-rows">
      <PersonRow
        v-for="(row, i) in rows"
        :key="row.key"
        ref="rowRefs"
        :people="people"
        :roles="roles"
        :taken="takenSets[i]"
        :can-remove="rows.length > 1"
        :locked="locked"
        v-model="row.value"
        @remove="removeRow(row.key)"
      />
    </div>
    <div class="tb-foot">
      <button type="button" class="tb-add" :disabled="locked" @click="addRow(true)"><AppIcon name="plus" :size="18" />הוסף אדם נוסף</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from "vue";
import AppIcon from "./AppIcon.vue";
import PersonRow from "./PersonRow.vue";
import { NO_ID, personKey } from "../lib/person.js";

const props = defineProps({
  people: { type: Array, default: () => [] },
  roles: { type: Array, default: () => [] },
  locked: { type: Boolean, default: true },
});
const emit = defineEmits(["update:members", "update:allComplete"]);

let rowSeq = 0;
function makeRow() {
  return { key: ++rowSeq, value: { firstName: "", lastName: "", id: NO_ID, role: "" } };
}

const rows = reactive([makeRow()]);
const rowRefs = ref([]);

function hasNameOf(v) {
  return (v.firstName + v.lastName).trim() !== "";
}

const takenSets = computed(() => {
  const values = rows.map((r) => r.value);
  return values.map((_, i) => {
    const set = new Set();
    values.forEach((v, j) => { if (j !== i && hasNameOf(v)) set.add(personKey(v)); });
    return set;
  });
});

const members = computed(() =>
  rows.map((r) => ({ ...r.value, filled: hasNameOf(r.value) })).filter((v) => v.filled)
);

const allComplete = computed(() =>
  rows.length > 0 && rows.every((r) => hasNameOf(r.value) && r.value.role !== "")
);

const countText = computed(() => {
  const n = members.value.length;
  return n === 1 ? "אדם אחד משובץ" : `${n} אנשים משובצים`;
});

watch(members, (v) => emit("update:members", v), { immediate: true });
watch(allComplete, (v) => emit("update:allComplete", v), { immediate: true });

function addRow(focus) {
  rows.push(makeRow());
  if (focus) {
    nextTick(() => {
      const last = rowRefs.value[rowRefs.value.length - 1];
      last?.focusName();
      last?.$el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
}

function removeRow(key) {
  if (rows.length <= 1) return;
  const idx = rows.findIndex((r) => r.key === key);
  if (idx !== -1) rows.splice(idx, 1);
}
</script>

<style scoped>
.team-builder {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
  padding: 4px 10px 14px;
}

.tb-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line);
}
.tb-head h2 { display: flex; align-items: center; gap: 7px; margin: 0 0 -8px 0; font-size: 16px; color: var(--primary-dark); }
.tb-count {
  font-size: .8rem;
  color: var(--primary);
  font-weight: 700;
  background: #e3eef1;
  padding: 3px 10px;
  border-radius: 999px;
}

.tb-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  padding: 3px 0 6px;
  overscroll-behavior: contain;
}

.tb-foot { padding-top: 12px; }

.tb-add {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1.5px dashed var(--primary);
  border-radius: 999px;
  background: transparent;
  color: var(--primary);
  font-weight: 600;
}
.tb-add:hover:not(:disabled) { background: #e3eef1; border-style: solid; }
</style>
