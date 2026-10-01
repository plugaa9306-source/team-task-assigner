import { NO_ID } from "./person.js";

// The status choices of each report come from the server (`getReportOptions`), keyed by `optionsKey`.
export const REPORT_TYPES = [
  { key: "report1", label: 'דו"ח 1', optionsKey: "report1" },
  { key: "arrival", label: "צפי הגעה", optionsKey: "arrivalForecast", aliases: ["arrival", "arrival_forecast"] },
];
export const DEFAULT_TYPE = "report1";
export const UNREPORTED_LABEL = "לא דווח";

export const typeOf = (key) => REPORT_TYPES.find((t) => t.key === key) ?? REPORT_TYPES[0];

/**
 * @typedef {{ name: string, code: string, color: string }} ReportOption   server shape (color is a Hebrew name)
 * @typedef {{ key: string, label: string, color: string }} Status          what the UI uses
 */

// Server options -> statuses: code becomes the key, name the label (blank names / duplicate codes dropped).
export function normalizeOptions(list) {
  const seen = new Set();
  const out = [];
  for (const o of Array.isArray(list) ? list : []) {
    // tolerate plain strings and alternative field names
    const isText = typeof o === "string";
    const label = String(isText ? o : o?.name ?? o?.label ?? o?.text ?? o?.title ?? "").trim();
    const key = String(isText ? o : o?.code ?? o?.value ?? o?.id ?? o?.key ?? label).trim();
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label, color: String(isText ? "" : o?.color ?? "").trim() });
  }
  return out;
}

// The statuses for one report type out of the server payload. The lists normally sit in `data`
// ({ report1, arrivalForecast }); `options` or the top level are accepted too.
export function statusesFromData(data, typeKey) {
  const t = typeOf(typeKey);
  const names = [t.optionsKey, ...(t.aliases ?? [])];
  for (const source of [data, data?.options, data?.data]) {
    for (const n of names) {
      const list = normalizeOptions(source?.[n]);
      if (list.length) return list;
    }
  }
  return [];
}

export const statusLabel = (statuses, key) => statuses.find((s) => s.key === key)?.label ?? "";

// Stable per-soldier key (personal ID, or name when the soldier has none).
export const rowKey = (s) =>
  s.id && s.id !== NO_ID ? `id:${s.id}` : `name:${s.firstName.trim()}|${s.lastName.trim()}`.toLowerCase();

export const fullName = (s) => `${s.firstName} ${s.lastName}`.trim();

// Local calendar date, yyyy-mm-dd.
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// entries: { [rowKey]: { status, note } }. A soldier with no entry is "unreported" (status "").
export const entryOf = (entries, s) => entries[rowKey(s)] ?? { status: "", note: "" };

export function computeStats(soldiers, entries, statuses) {
  const byStatus = Object.fromEntries(statuses.map((s) => [s.key, 0]));
  let unreported = 0;
  for (const s of soldiers) {
    const st = entryOf(entries, s).status;
    if (st in byStatus) byStatus[st] += 1;
    else unreported += 1;
  }
  return { total: soldiers.length, byStatus, unreported };
}

// Hebrew WhatsApp text for one unit: a line per soldier (name - status, note in brackets),
// then a general summary with the total and a count per status.
export function buildSummary(soldiers, entries, typeKey, dateISO, unit, statuses) {
  const type = typeOf(typeKey);
  const lines = soldiers.map((s) => {
    const e = entryOf(entries, s);
    const status = statusLabel(statuses, e.status) || UNREPORTED_LABEL;
    const note = e.note.trim();
    return `• ${fullName(s)} - ${status}${note ? ` (${note})` : ""}`;
  });

  const stats = computeStats(soldiers, entries, statuses);
  const summary = [`סה"כ: ${stats.total}`];
  for (const { key, label } of statuses) {
    if (stats.byStatus[key]) summary.push(`• ${label}: ${stats.byStatus[key]}`);
  }
  if (stats.unreported) summary.push(`• ${UNREPORTED_LABEL}: ${stats.unreported}`);

  return [`📋 *${type.label} – ${unit} – ${formatDate(dateISO)}*`, "", ...lines, "", "*סיכום כללי*", ...summary].join("\n");
}
