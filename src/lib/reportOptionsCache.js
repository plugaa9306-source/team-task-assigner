const KEY = "team_app_report_options";

const isList = (v) => Array.isArray(v) && v.every((s) => s && typeof s.key === "string" && typeof s.label === "string");

// Report status options, kept in localStorage until logout so they are requested from the server only once.
// Shape: { report1: Status[], arrivalForecast: Status[] }  (see normalizeOptions in report1.js)
export function loadReportOptions() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && isList(d.report1) && isList(d.arrivalForecast) && (d.report1.length || d.arrivalForecast.length)) return d;
  } catch {
    // unreadable storage means nothing cached
  }
  return null;
}

export function saveReportOptions({ report1, arrivalForecast }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ report1, arrivalForecast }));
  } catch {
    // storage blocked or full: options just get re-requested next time
  }
}

export function clearReportOptions() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
