// Same comparison the server uses for department names: spaces, quote styles and letter case are ignored
// ("מחלקה1" = "מחלקה 1"), different numbers stay different ("מחלקה 1" != "מחלקה 11").
export const normalizeDepartment = (value) => String(value ?? "").replace(/[\s'"״׳]/g, "").toLowerCase();

/**
 * The units a user may update, out of all units.
 * @param {string[]} units
 * @param {{ canUpdate1?: boolean, updateDepartments?: string[] | null }} access
 *   updateDepartments: null = all departments, an array = only those. canUpdate1 false = none.
 */
export function updatableUnits(units, { canUpdate1 = true, updateDepartments = null } = {}) {
  return unitsFor(units, canUpdate1 !== false, updateDepartments);
}

function unitsFor(units, enabled, departments) {
  if (!enabled) return [];
  if (!Array.isArray(departments)) return units;
  const allowed = new Set(departments.map(normalizeDepartment));
  return units.filter((u) => allowed.has(normalizeDepartment(u)));
}
