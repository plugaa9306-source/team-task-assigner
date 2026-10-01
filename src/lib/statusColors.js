const NEUTRAL = { bg: "#F3F4F6", text: "#1F2937", border: "#E5E7EB" };

const PALETTE = {
  // text and border are both strong tones (the UI uses no background fill); bg is kept for badges/chips.
  אדום: { bg: "#FEE2E2", text: "#991B1B", border: "#DC2626" },
  בורדו: { bg: "#FCE7F3", text: "#7A0019", border: "#9B1C31" }, // burgundy = dark red
  ירוק: { bg: "#DCFCE7", text: "#166534", border: "#16A34A" },
  צהוב: { bg: "#FEF9C3", text: "#854D0E", border: "#CA8A04" },
  תכלת: { bg: "#E0F2FE", text: "#075985", border: "#0284C7" },
  כחול: { bg: "#DBEAFE", text: "#1E40AF", border: "#2563EB" },
  כתום: { bg: "#FFEDD5", text: "#9A3412", border: "#EA580C" },
  אפור: { bg: "#F3F4F6", text: "#374151", border: "#6B7280" },
};

/**
 * The server sends status colors as Hebrew names ("אדום", "בורדו", ...).
 * @param {string} hebrewColor
 * @returns {{ bg: string, text: string, border: string }} CSS colors; neutral grey for unknown names
 */
export function mapHebrewColorToCss(hebrewColor) {
  return PALETTE[String(hebrewColor ?? "").trim()] ?? NEUTRAL;
}

/** Inline style for a card/select marked with a status color: text and border only, no background fill. */
export function statusStyle(hebrewColor) {
  const c = mapHebrewColorToCss(hebrewColor);
  return { color: c.text, borderColor: c.border };
}
