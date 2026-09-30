import { NO_ID } from "./person.js";
import { unitOf } from "./soldiers.js";

const FINAL_LETTERS = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

// Case-insensitive, whitespace-collapsed, final letters folded to their regular forms,
// quotes/geresh removed (so מ"א and מא match).
export function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c])
    .replace(/["'״׳]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const digitsOnly = (v) => String(v ?? "").replace(/\D/g, "");

// In-memory lookup by name (any word order), personal ID or national ID.
export function searchSoldiers(list, query, limit = 20) {
  const q = normalizeText(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const qDigits = digitsOnly(q);
  const isNumeric = qDigits.length > 0 && qDigits === q.replace(/[\s-]/g, "");

  const out = [];
  for (const s of list) {
    let hit;
    if (isNumeric) {
      hit = [s.id === NO_ID ? "" : digitsOnly(s.id), digitsOnly(s.idNum)].some((d) => d.includes(qDigits));
    } else {
      const name = normalizeText(`${s.firstName} ${s.lastName}`);
      hit = tokens.every((t) => name.includes(t));
    }
    if (hit) {
      out.push(s);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export { unitOf };
