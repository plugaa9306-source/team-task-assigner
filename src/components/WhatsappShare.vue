<template>
  <div class="whatsapp-share">
    <details class="ws-preview">
      <summary>
        <span>תצוגה מקדימה של ההודעה</span>
        <span class="ws-chevron" aria-hidden="true">▾</span>
      </summary>
      <pre class="ws-text">{{ previewText }}</pre>
    </details>
    <div class="ws-actions">
      <button type="button" class="ws-share" :disabled="!ready" @click="share">שתף בוואטסאפ</button>
      <button type="button" class="ws-copy" :disabled="!ready" @click="copy">העתק</button>
    </div>
    <p class="ws-status" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  task: { type: String, default: "" },
  members: { type: Array, default: () => [] },
  allComplete: { type: Boolean, default: false },
  template: { type: Object, default: null },
});

const status = ref("");

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
      .replaceAll("{ROLE}", m.role ?? "");

  const items = props.members.map((m) => {
    let line = fill(t.item_format, m);
    if (!m.role) line = line.replace(/\s*-\s*$/, "").replace(/\s{2,}/g, " ");
    return line.trim();
  });

  return [fill(t.header), "", fill(t.subheader), ...items, "", fill(t.footer)].join("\n");
}

const previewText = computed(() =>
  ready.value ? buildMessage() : "בחרו משימה והוסיפו לפחות אדם אחד עם שם ותפקיד."
);

watch([() => props.task, () => props.members, () => props.allComplete], () => { status.value = ""; });

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

async function copy() {
  try {
    await navigator.clipboard.writeText(buildMessage());
    status.value = "ההודעה הועתקה";
  } catch {
    status.value = "לא ניתן להעתיק. סמנו את הטקסט ידנית.";
  }
}
</script>

<style scoped>
.whatsapp-share {
  display: block;
  flex: none;
  padding: 14px 18px calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--line);
}

.ws-preview {
  margin-bottom: 12px;
  border: 1.5px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.ws-preview summary {
  min-height: var(--tap);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  cursor: pointer;
  font-weight: 600;
  color: var(--primary);
}
.ws-preview summary::-webkit-details-marker { display: none; }
.ws-preview summary::marker { content: ""; }
.ws-chevron {
  transition: transform .15s ease;
}
.ws-preview[open] .ws-chevron { transform: rotate(180deg); }
.ws-text {
  margin: 0;
  padding: 4px 12px 12px;
  max-height: 30vh;
  overflow: auto;
  white-space: pre-wrap;
  font: inherit;
  font-size: .92rem;
}

.ws-actions { display: flex; gap: 10px; }

.ws-share {
  flex: 1;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--wa), var(--wa-dark));
  color: #fff;
  font-weight: 700;
  font-size: 1.05rem;
  box-shadow: 0 4px 14px rgba(29, 168, 81, .32);
}
.ws-share:hover:not(:disabled) { filter: brightness(1.05); box-shadow: 0 6px 18px rgba(29, 168, 81, .4); }
.ws-share:disabled { box-shadow: none; }

.ws-copy {
  flex: none;
  padding: 0 18px;
  border: 1.5px solid var(--primary);
  border-radius: 10px;
  background: transparent;
  color: var(--primary);
  font-weight: 600;
}
.ws-copy:hover:not(:disabled) { background: #e3eef1; }

.ws-actions button:disabled { opacity: .4; cursor: not-allowed; }

.ws-status { margin: 8px 0 0; min-height: 1.2em; font-size: .85rem; color: var(--muted); }
</style>
