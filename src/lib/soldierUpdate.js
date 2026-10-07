import { unitOf } from "./soldiers.js";

export const EDIT_FIELDS = [
  { key: "firstName", label: "שם פרטי" },
  { key: "lastName", label: "שם משפחה" },
  { key: "id", label: 'מ"א' },
  { key: "idNum", label: 'ת"ז' },
  { key: "phone", label: "טלפון" },
  { key: "unit", label: "יחידה / מחלקה" },
];

export function editableValues(soldier) {
  return {
    firstName: soldier.firstName,
    lastName: soldier.lastName,
    id: soldier.id,
    idNum: soldier.idNum,
    phone: soldier.phone,
    unit: unitOf(soldier),
  };
}

// Changed fields only: [{ key, label, from, to }]
export function diffSoldier(original, edited) {
  const before = editableValues(original);
  return EDIT_FIELDS.filter(({ key }) => (edited[key] ?? "").trim() !== (before[key] ?? "").trim()).map(
    ({ key, label }) => ({ key, label, from: before[key] ?? "", to: (edited[key] ?? "").trim() })
  );
}

const show = (v) => (v ? v : "—");

export function buildUpdateMessage(original, changes) {
  const name = `${original.firstName} ${original.lastName}`.trim();
  return [
    "📝 *בקשת עדכון פרטי חייל*",
    `חייל: ${name} (מ"א: ${original.id})`,
    "",
    "שינויים מבוקשים:",
    ...changes.map((c) => `• ${c.label}: ${show(c.from)} ⬅️ ${show(c.to)}`),
    "",
    "נא לעדכן את הגיליון הראשי. תודה!",
  ].join("\n");
}

export const whatsappTextUrl = (message) => `https://wa.me/?text=${encodeURIComponent(message)}`;

// Israeli numbers: 050-123-4567 -> 972501234567. Returns "" when there are no digits.
export function phoneDigits(phone) {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `972${d.slice(1)}`;
  return d;
}

export const whatsappChatUrl = (phone) => {
  const d = phoneDigits(phone);
  return d ? `https://wa.me/${d}` : "";
};

export const telUrl = (phone) => {
  const d = String(phone ?? "").replace(/[^\d+]/g, "");
  return d ? `tel:${d}` : "";
};

// 0501234567 -> 050-123-4567
export function formatPhone(phone) {
  const d = String(phone ?? "").replace(/\D/g, "");
  return /^05\d{8}$/.test(d) ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : String(phone ?? "");
}
