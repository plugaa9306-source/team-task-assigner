const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1RR6Xa-evfYzQ0Dp234R8BD_evddJpI038iZH6sqHnrA/export?format=csv";
export const MISSIONS_CSV_URL = `${SHEET_CSV_URL}&gid=0`;
export const ROLES_CSV_URL = `${SHEET_CSV_URL}&gid=433000815`;

const MISSION_COLUMN = "משימה";
const ROLE_COLUMN = "תפקיד";

// Minimal RFC 4180 parser: quoted fields, escaped quotes (""), CRLF/LF newlines.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Returns the non-blank values of the named column (falls back to column 2).
export function parseColumn(csv, name) {
  const [header = [], ...rows] = parseCsv(csv.replace(/^\uFEFF/, ""));
  const found = header.findIndex((h) => h.trim() === name);
  const col = found >= 0 ? found : 1;
  return rows.map((r) => (r[col] ?? "").trim()).filter(Boolean);
}

export const parseMissions = (csv) => parseColumn(csv, MISSION_COLUMN);
export const parseRoles = (csv) => parseColumn(csv, ROLE_COLUMN);

async function fetchSheet(url, parse) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`google sheet (${res.status})`);
  return parse(await res.text());
}

export const fetchMissions = (url = MISSIONS_CSV_URL) => fetchSheet(url, parseMissions);
export const fetchRoles = (url = ROLES_CSV_URL) => fetchSheet(url, parseRoles);
