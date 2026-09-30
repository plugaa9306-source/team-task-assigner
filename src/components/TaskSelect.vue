<template>
  <div class="task-select">
    <label class="ts-label" for="ts-select">משימה</label>
    <select
      id="ts-select"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option value="">בחרו משימה…</option>
      <option v-for="t in tasks" :key="t" :value="t">{{ t }}</option>
    </select>
  </div>
</template>

<script setup>
defineProps({
  tasks: { type: Array, default: () => [] },
  modelValue: { type: String, default: "" },
});
defineEmits(["update:modelValue"]);
</script>

<style scoped>
.task-select {
  display: block;
  padding: 18px 18px 10px;
}
.ts-label {
  display: block;
  margin-bottom: 7px;
  font-weight: 700;
  color: var(--primary-dark);
}
</style>
