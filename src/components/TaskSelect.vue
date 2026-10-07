<template>
  <div class="task-select">
    <label class="ts-label" for="ts-select"><AppIcon name="clipboard" :size="16" />משימה</label>
    <select
      id="ts-select"
      :value="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option value="">בחרו משימה…</option>
      <option v-for="t in tasks" :key="t" :value="t">{{ t }}</option>
    </select>
  </div>
</template>

<script setup>
import AppIcon from "./AppIcon.vue";
defineProps({
  tasks: { type: Array, default: () => [] },
  modelValue: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
});
defineEmits(["update:modelValue"]);
</script>

<style scoped>
.task-select {
  display: block;
  padding: 18px 18px 10px;
}
.ts-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  font-size: .72rem;
  font-weight: 700;
  color: var(--primary-dark);
}
/* same dropdown styling as the Report 1 selectors */
.task-select select {
  min-height: 38px;
  padding: 4px 8px 4px 28px;
  background-position: left 6px center;
  font-size: .88rem;
  font-weight: 700;
}
@media (max-width: 440px) {
  .ts-label { font-size: .68rem; }
  .task-select select { padding: 4px 6px 4px 22px; background-position: left 4px center; background-size: 14px; font-size: .78rem; }
}
</style>
