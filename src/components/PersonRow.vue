<template>
  <div class="person-row" ref="rootEl">
    <div class="pr-main">
      <div class="pr-name-wrap">
        <AppIcon class="pr-name-icon" name="search" :size="17" />
        <input
          ref="nameInputEl"
          type="text"
          class="pr-name"
          :class="{ 'pr-invalid': nameInvalid }"
          placeholder="שם פרטי או משפחה"
          autocomplete="off"
          role="combobox"
          :aria-expanded="open"
          :aria-controls="resId"
          aria-autocomplete="list"
          aria-label="שם"
          :disabled="locked"
          :value="nameText"
          @input="onInput"
          @keydown="onKey"
          @blur="onNameBlur"
        >
        <ul
          v-show="open"
          ref="listEl"
          class="pr-results"
          :id="resId"
          role="listbox"
          :style="listStyle"
          @mousedown.prevent
        >
          <li
            v-for="(p, i) in matches"
            :key="p.id"
            role="option"
            :class="{ 'is-active': i === active }"
            @click="pick(p)"
          >
            <span class="pr-res-name">{{ p.firstName }} {{ p.lastName }}</span>
          </li>
        </ul>
      </div>
      <select
        ref="roleSelectEl"
        class="pr-role"
        :class="{ 'pr-invalid': roleInvalid }"
        aria-label="תפקיד"
        :disabled="locked"
        :value="modelValue.role"
        @change="onRoleChange"
        @blur="onRoleBlur"
      >
        <option value="">בחרו תפקיד…</option>
        <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
      </select>
      <button
        type="button"
        class="pr-remove"
        aria-label="הסר אדם"
        :disabled="locked || !canRemove"
        @click="$emit('remove')"
      >
        <AppIcon name="trash" :size="22" />
      </button>
    </div>
    <p class="pr-hint" v-show="hintText">{{ hintText }}</p>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, useId, nextTick } from "vue";
import AppIcon from "./AppIcon.vue";
import { NO_ID, personKey } from "../lib/person.js";

const props = defineProps({
  people: { type: Array, default: () => [] },
  roles: { type: Array, default: () => [] },
  taken: { type: Set, default: () => new Set() },
  canRemove: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  modelValue: {
    type: Object,
    default: () => ({ firstName: "", lastName: "", id: NO_ID, role: "" }),
  },
});
const emit = defineEmits(["update:modelValue", "remove"]);

const resId = useId();
const rootEl = ref(null);
const nameInputEl = ref(null);
const roleSelectEl = ref(null);
const listEl = ref(null);

function fullName(v) {
  return `${v.firstName} ${v.lastName}`.trim();
}

const nameText = ref(fullName(props.modelValue));
const matches = ref([]);
const active = ref(-1);
const open = ref(false);
const touched = reactive({ name: false, role: false });
const listStyle = ref({});

const hasName = computed(() => fullName(props.modelValue) !== "");
const nameInvalid = computed(() => touched.name && !hasName.value);
const roleInvalid = computed(() => touched.role && props.modelValue.role === "");
const hintText = computed(() => {
  if (nameInvalid.value && roleInvalid.value) return "יש למלא שם ותפקיד";
  if (nameInvalid.value) return "יש למלא שם";
  if (roleInvalid.value) return "יש למלא תפקיד";
  return "";
});

function focusName() {
  nameInputEl.value?.focus();
}
defineExpose({ focusName });

function onInput(e) {
  nameText.value = e.target.value;
  if (props.modelValue.id !== NO_ID) {
    emit("update:modelValue", { firstName: "", lastName: "", id: NO_ID, phone: "", role: props.modelValue.role });
  }
  search();
}

function search() {
  const q = nameText.value.trim().toLowerCase();
  if (!q) { close(); return; }
  matches.value = props.people
    .filter((p) => {
      const first = p.firstName.toLowerCase();
      const last = p.lastName.toLowerCase();
      const matchesQuery = first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q);
      return matchesQuery && !props.taken.has(personKey(p));
    })
    .slice(0, 30);

  if (!matches.value.length) { close(); return; }
  active.value = -1;
  open.value = true;
  position();
}

function pick(p) {
  emit("update:modelValue", { firstName: p.firstName, lastName: p.lastName, id: p.id, phone: p.phone ?? "", role: props.modelValue.role });
  nameText.value = `${p.firstName} ${p.lastName}`;
  close();
  nextTick(() => { roleSelectEl.value?.focus(); });
}

function onNameBlur() {
  touched.name = true;
  nameText.value = fullName(props.modelValue);
}

function onRoleChange(e) {
  emit("update:modelValue", { ...props.modelValue, role: e.target.value });
}

function onRoleBlur() {
  touched.role = true;
}

function onKey(e) {
  if (e.key === "ArrowDown" && open.value) { e.preventDefault(); move(1); }
  else if (e.key === "ArrowUp" && open.value) { e.preventDefault(); move(-1); }
  else if (e.key === "Enter" && open.value && active.value >= 0) { e.preventDefault(); pick(matches.value[active.value]); }
  else if (e.key === "Escape") close();
}

function move(step) {
  const n = matches.value.length;
  active.value = (active.value + step + n) % n;
  requestAnimationFrame(() => {
    listEl.value?.children[active.value]?.scrollIntoView({ block: "nearest" });
  });
}

function close() {
  open.value = false;
}

function position() {
  const el = nameInputEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - 10;
  const above = r.top - 10;
  const flip = below < 160 && above > below;
  const max = Math.max(120, Math.min(260, flip ? above : below));
  listStyle.value = {
    width: `${r.width}px`,
    left: `${r.left}px`,
    maxHeight: `${max}px`,
    top: flip ? "auto" : `${r.bottom + 4}px`,
    bottom: flip ? `${window.innerHeight - r.top + 4}px` : "auto",
  };
}

function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) close();
}
function onReposition(e) {
  if (!open.value || e.target === listEl.value) return;
  position();
}

onMounted(() => {
  document.addEventListener("click", onDocClick);
  window.addEventListener("scroll", onReposition, true);
  window.addEventListener("resize", onReposition);
});
onUnmounted(() => {
  document.removeEventListener("click", onDocClick);
  window.removeEventListener("scroll", onReposition, true);
  window.removeEventListener("resize", onReposition);
});

watch(() => props.locked, (locked) => { if (locked) close(); });
</script>

<style scoped>
.person-row {
  display: block;
  padding: 8px;
  background: #fff;
  border: 1.5px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--ease), border-color var(--ease);
}
.person-row:hover, .person-row:focus-within { border-color: var(--primary-light); }

/* centred (not stretched) so the name field and the dropdown are exactly the same height */
.pr-main { display: flex; gap: 8px; align-items: center; }
.pr-name-wrap { flex: 2.3 1 0; min-width: 0; position: relative; }
.pr-name-icon { position: absolute; inset-inline-start: 10px; top: 50%; transform: translateY(-50%); display: block; color: var(--muted); pointer-events: none; }
/* same field styling as the Report 1 selectors */
.pr-name, .pr-role { min-height: 38px; font-size: .88rem; font-weight: 700; }
.pr-name { padding-block: 4px; padding-inline-end: 8px; padding-inline-start: 34px; }

/* a plain clickable trash icon: no border or background until hovered */
.pr-remove {
  flex: none;
  width: 28px;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--danger);
}
.pr-remove:hover:not(:disabled) { background: #f6dde0; }
.pr-remove:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.pr-remove:disabled { opacity: .35; cursor: not-allowed; }

.pr-role { flex: 1 1 0; min-width: 0; max-width: 40%; padding: 4px 8px 4px 28px; background-position: left 6px center; }
@media (max-width: 440px) {
  .pr-name, .pr-role { font-size: .78rem; }
  .pr-name { padding-inline-end: 6px; padding-inline-start: 30px; }
  .pr-role { padding: 4px 6px 4px 22px; background-position: left 4px center; background-size: 14px; }
}

.pr-name.pr-invalid, .pr-role.pr-invalid { border-color: var(--danger); }

.pr-hint {
  margin: 6px 0 0;
  color: var(--danger);
  font-size: .8rem;
}

.pr-results {
  position: fixed;
  z-index: 1000;
  margin: 0;
  padding: 4px;
  list-style: none;
  overflow-y: auto;
  background: #fff;
  border: 1.5px solid var(--primary);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(21, 35, 43, .22);
}

.pr-results li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  min-height: var(--tap);
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.pr-res-name { font-weight: 600; }

@media (hover: hover) {
  .pr-results li:hover { background: #e3eef1; }
}
.pr-results li.is-active { background: #e3eef1; }
</style>
