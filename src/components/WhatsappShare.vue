<template>
  <div ref="rootEl" class="whatsapp-share">
    <div v-show="previewOpen" id="ws-preview" class="ws-preview" role="region" aria-label="תצוגה מקדימה של ההודעה">
      <pre class="ws-text">{{ previewText }}</pre>
    </div>
    <div class="ws-actions">
      <button
        type="button"
        class="ws-preview-btn"
        title="תצוגה מקדימה"
        aria-label="תצוגה מקדימה של ההודעה"
        aria-controls="ws-preview"
        :aria-expanded="previewOpen"
        @click="previewOpen = !previewOpen"
      >
        <AppIcon name="chat" :size="22" />
      </button>
      <button type="button" class="ws-share" :disabled="!ready" @click="share"><AppIcon name="whatsapp" :size="19" />שלח דוח משימה בוואטסאפ</button>
      <button
        type="button"
        class="ws-group"
        :disabled="!canGroup"
        title="העתקת מספרי הצוות ופתיחת וואטסאפ ליצירת קבוצה"
        @click="createGroup"
      >
        <AppIcon name="users" :size="19" />צור קבוצה
      </button>
    </div>
    <div v-if="toast" class="ws-toast" role="status" aria-live="polite">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import AppIcon from "./AppIcon.vue";
import { selectedNumbers, formatNumbers } from "../lib/bulk.js";

const props = defineProps({
  task: { type: String, default: "" },
  members: { type: Array, default: () => [] },
  allComplete: { type: Boolean, default: false },
  template: { type: Object, default: null },
});

// The preview opens as a pop-up above the buttons; it closes on Escape or a tap outside.
const previewOpen = ref(false);
const rootEl = ref(null);
const onOutside = (e) => {
  if (previewOpen.value && rootEl.value && !rootEl.value.contains(e.target)) previewOpen.value = false;
};
const onKey = (e) => {
  if (e.key === "Escape") previewOpen.value = false;
};
onMounted(() => {
  document.addEventListener("pointerdown", onOutside);
  document.addEventListener("keydown", onKey);
});
onUnmounted(() => {
  document.removeEventListener("pointerdown", onOutside);
  document.removeEventListener("keydown", onKey);
});

const numbers = computed(() => selectedNumbers(props.members));
const canGroup = computed(() => ready.value && numbers.value.length > 0);

// WhatsApp can't create a group from a link, so: copy the team's numbers, then open WhatsApp with the
// task message ready to send into the new group.
const toast = ref("");
let toastTimer;
onUnmounted(() => clearTimeout(toastTimer));
function showToast(text) {
  toast.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 4000);
}

async function createGroup() {
  const missing = props.members.length - numbers.value.length;
  // both calls start inside the click so the browser doesn't block the clipboard or the new tab
  const copied = navigator.clipboard?.writeText(formatNumbers(numbers.value));
  window.open(`https://wa.me/?text=${encodeURIComponent(buildMessage())}`, "_blank", "noopener");
  try {
    await copied;
    showToast(`מספרי הצוות הועתקו. פתחו קבוצה חדשה בוואטסאפ והוסיפו אותם${missing > 0 ? ` (${missing} ללא מספר טלפון)` : ""}`);
  } catch {
    showToast("לא ניתן להעתיק את מספרי הצוות");
  }
}

const ready = computed(() => Boolean(props.task) && props.members.length > 0 && props.allComplete);

function buildMessage() {
  const t = props.template;
  if (!t) return "";
  const fill = (str, m = {}) =>
    str
      .replaceAll("{TASK}", props.task)
      .replaceAll("{FIRST_NAME}", m.firstName ?? "")
      .replaceAll("{LAST_NAME}", m.lastName ?? "")
      .replaceAll("{ID}", m.id ?? "")
      .replaceAll("{PHONE}", m.phone ?? "")
      .replaceAll("{ROLE}", m.role ?? "");

  const items = props.members.map((m) => {
    // drop the " - {PHONE}" segment when the person has no phone on record
    const format = m.phone ? t.item_format : t.item_format.replace(/\s*-\s*\{PHONE\}/, "").replace("{PHONE}", "");
    let line = fill(format, m);
    if (!m.role) line = line.replace(/\s*-\s*$/, "").replace(/\s{2,}/g, " ");
    return line.trim();
  });

  return [fill(t.header), "", fill(t.subheader), ...items, "", fill(t.footer)].join("\n");
}

const previewText = computed(() =>
  ready.value ? buildMessage() : "בחרו משימה והוסיפו לפחות אדם אחד עם שם ותפקיד."
);

async function share() {
  const text = buildMessage();
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (isTouch && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}
</script>

<style scoped>
.whatsapp-share {
  position: relative;
  display: block;
  flex: none;
  padding: 14px 18px calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--line);
}

.ws-preview {
  position: absolute;
  z-index: 10;
  left: 12px;
  right: 12px;
  bottom: calc(100% + 6px);
  max-height: min(45vh, 320px);
  overflow: auto;
  background: #fff;
  border: 1.5px solid var(--primary);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
}
.ws-text {
  margin: 0;
  padding: 12px 14px;
  white-space: pre-wrap;
  font: inherit;
  font-size: .92rem;
}

.ws-preview-btn {
  flex: none;
  width: var(--tap);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--primary);
  background: #fff;
  border: 1.5px solid var(--primary);
  border-radius: 10px;
}
.ws-preview-btn:hover, .ws-preview-btn[aria-expanded="true"] { background: #e3eef1; }
.ws-preview-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

.ws-actions { display: flex; gap: 10px; }

.ws-share {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--wa), var(--wa-dark));
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
  white-space: nowrap;
  min-width: 0;
  padding: 0 10px;
  box-shadow: 0 4px 14px rgba(29, 168, 81, .32);
}
.ws-share:hover:not(:disabled) { filter: brightness(1.05); box-shadow: 0 6px 18px rgba(29, 168, 81, .4); }
.ws-share:disabled { box-shadow: none; }

.ws-actions .ws-share:disabled, .ws-actions .ws-group:disabled { opacity: .4; cursor: not-allowed; }

.ws-group {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border: 1.5px solid var(--primary);
  border-radius: 10px;
  background: transparent;
  color: var(--primary);
  font-weight: 600;
}
.ws-group:hover:not(:disabled) { background: #e3eef1; }

.ws-toast {
  position: fixed;
  z-index: 60;
  left: 50%;
  bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100vw - 32px);
  padding: 11px 18px;
  font-weight: 700;
  font-size: .9rem;
  color: #fff;
  background: #166534;
  border-radius: 14px;
  box-shadow: var(--shadow-md);
  text-align: center;
}
</style>
