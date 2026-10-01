const KEY = "team_app_report1";

// The report screen's last state, kept in localStorage so a reload doesn't lose what was filled in.
// The date is deliberately not stored: the screen always opens on today.
// Shape: { type, unit, store: { "type|date": { rowKey: { status, note } } } }
export function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === "object") {
      return {
        type: typeof d.type === "string" ? d.type : "",
        unit: typeof d.unit === "string" ? d.unit : "",
        store: d.store && typeof d.store === "object" ? d.store : {},
      };
    }
  } catch {
    // unreadable storage means no draft
  }
  return { type: "", unit: "", store: {} };
}

export function saveDraft({ type, unit, store }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ type, unit, store }));
  } catch {
    // storage blocked or full: the screen still works for this session
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
