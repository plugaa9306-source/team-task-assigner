const KEYS = { missions: "team_app_missions", roles: "team_app_roles" };

const read = (key) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) && v.length && v.every((x) => typeof x === "string") ? v : null;
  } catch {
    return null;
  }
};

// Lists read from the Google Sheet (missions, roles) are kept in localStorage until logout,
// so they are fetched only once. A failed or empty fetch is never cached.
export async function cachedSheetList(name, fetcher) {
  const cached = read(KEYS[name]);
  if (cached) return cached;
  const list = await fetcher();
  if (Array.isArray(list) && list.length) {
    try {
      localStorage.setItem(KEYS[name], JSON.stringify(list));
    } catch {
      // storage blocked or full: just refetched next time
    }
  }
  return list;
}

export function clearSheetCache() {
  for (const key of Object.values(KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
