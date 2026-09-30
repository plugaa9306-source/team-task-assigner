# Vite + Vue 3 migration — design spec

Date: 2026-09-30

## Goal

Migrate team-task-assigner from vanilla JS Web Components (no build step) to
Vite + Vue 3 (latest versions of both), converting all four components to
Vue SFCs, while preserving the app's current behavior and visual design
exactly (everything built and verified earlier in this project: mission-first
locking, mandatory name+role fields, duplicate-person prevention, pick-only-
from-list name field, role `<select>`, custom chevron styling, and the visual
polish pass).

## Decisions (from brainstorming)

- **Language:** plain JavaScript, `<script setup>` SFCs — no TypeScript.
- **State sharing:** props + emits only, no Pinia. `App.vue` is the single
  source of truth (mirrors today's `app.js` orchestrator role).
- **Data loading:** `data/*.json` moves to `public/data/*.json` and is still
  fetched at runtime with `fetch('data/<name>.json')`, exactly like today —
  editing a JSON file after `npm run build` still takes effect with no
  rebuild.
- **Old files:** deleted once the Vue version is verified working (no
  `legacy/` backup folder).
- **Git:** not initialized for this project; this spec is written to disk
  only, no commit.
- **Styling:** all current CSS is preserved as-is, just relocated — global
  tokens/reset/layout into `src/style.css`, per-component CSS into that
  component's `<style scoped>` block. No visual changes.
- **Testing:** no automated test framework introduced (none exists today).
  Verification is manual, re-running the same scenarios already validated
  during this project's earlier vanilla-JS work.

## Target project structure

```
team-task-assigner/
├── index.html                  # Vite entry (new, replaces old static index.html)
├── package.json                # new
├── vite.config.js              # new
├── public/
│   └── data/
│       ├── people.json
│       ├── roles.json
│       ├── tasks.json
│       └── template.json
├── src/
│   ├── main.js                 # createApp(App).mount('#app'); imports style.css
│   ├── style.css                # global tokens/reset/layout (ported from current style.css)
│   ├── App.vue
│   ├── lib/
│   │   └── person.js            # NO_ID, personKey() — ported unchanged
│   └── components/
│       ├── TaskSelect.vue
│       ├── TeamBuilder.vue
│       ├── PersonRow.vue
│       └── WhatsappShare.vue
└── README.md                    # rewritten with npm-based instructions
```

Deleted at the end of the migration: `app.js`, `index.html` (old version),
`style.css` (old version), `components/` (old vanilla-JS+CSS files), and the
top-level `data/` folder (superseded by `public/data/`).

## Component contracts

### `App.vue`

- On `onMounted`, fetches all four JSON files in parallel (same
  `Promise.all` pattern as today's `app.js`). On any failure, sets an
  `error` ref and renders the existing Hebrew error message in place of the
  app content — same text: `שגיאה בטעינת הנתונים: ${err.message}. יש להריץ
  את האתר משרת (ולא לפתוח את הקובץ ישירות).` (still true under Vite's dev
  server / any static host serving `dist/`).
- State: `task` (ref, string), `people`/`roles`/`template` (refs, loaded
  once), `members` (ref, array — from `TeamBuilder`'s `update:members`),
  `allComplete` (ref, boolean — from `TeamBuilder`'s `update:allComplete`).
- Computed: `locked = computed(() => !task.value)`, passed to `TeamBuilder`.
- Template renders `<TaskSelect>`, `<TeamBuilder>`, `<WhatsappShare>` and the
  error paragraph, matching today's `index.html` structure/classes
  (`.card`, `.app-header`, `#app-error` → template-bound `v-if`).

### `TaskSelect.vue`

- Props: `tasks: Array<string>`, `modelValue: string`.
- Emits: `update:modelValue`.
- Renders the `<label>` + `<select>` exactly as today (`.ts-label`, with the
  label's `for` pointing at a fixed `id="ts-select"` on the `<select>`, same
  as today — one static instance, no need to generate a unique id).
  Placeholder option `בחרו משימה…` stays first with value `""`.
- Used in `App.vue` as `<TaskSelect :tasks="tasks" v-model="task" />`.

### `TeamBuilder.vue`

- Props: `people: Array`, `roles: Array<string>`, `locked: boolean`.
- Emits: `update:members` (array of `{firstName, lastName, id, role,
  filled}`), `update:allComplete` (boolean).
- Internal state: `rows` (reactive array of row-state objects, one per
  `PersonRow`; each starts as `{ key: <unique>, firstName: "", lastName: "",
  id: NO_ID, role: "" }`). Starts with exactly one row, same as today.
- Computed:
  - `members`: rows filtered to `hasName` (ports today's `value.filled`
    logic).
  - `allComplete`: `rows.length > 0 && rows.every(r => hasName(r) &&
    r.role !== "")` — ports today's `TeamBuilder.allComplete` getter
    exactly (an incomplete/empty extra row blocks completion; the user must
    fill or remove it).
  - `takenByRow`: for each row index, a `Set` of `personKey(...)` for every
    *other* filled row — ports `#syncTaken()`.
- Methods: `addRow()` (push a new row, focus it — ports `#addRow`/focus
  behavior via a `ref` + `nextTick`), `removeRow(key)` (never removes the
  last row — ports `#removeRow`).
- Watches `rows` (deep) to re-emit `update:members`/`update:allComplete`
  whenever any row changes (replaces the `person-change` event bubbling +
  `#changed()`).
- Template: header with `<h2>צוות</h2>` + count badge (`אדם אחד משובץ` /
  `${n} אנשים משובצים`, ported string logic), `<PersonRow>` `v-for` over
  `rows` bound via `v-model` per row plus `:taken`, `:can-remove="rows.length
  > 1"`, `:locked="locked"`, `@remove="removeRow(row.key)"`, then the
  `+ הוסף אדם נוסף` button (disabled when `locked`).

### `PersonRow.vue`

Ports `person-row.js` behavior in full:

- Props: `people: Array`, `roles: Array<string>`, `taken: Set<string>`,
  `canRemove: boolean`, `locked: boolean`, `modelValue: {firstName, lastName,
  id, role}`.
- Emits: `update:modelValue`, `remove`.
- Internal refs: `nameInput`, `roleSelect` (template refs replacing
  `querySelector` lookups), `query` (the raw text in the name input,
  separate from the confirmed `modelValue` — ports the
  input-vs-confirmed-state split from the "pick only from list" work),
  `matches`, `active` (highlighted index), `open` (dropdown visibility),
  `touched: { name: false, role: false }`.
- Behavior ported 1:1, same rules already validated in this project:
  - Typing filters `people` by first/last/full name substring match,
    excluding anyone in `taken` (via `personKey`), capped at 30 results.
  - Only clicking a result or confirming via `Enter` on a highlighted result
    sets `modelValue`; free-typed text is never accepted — on blur, the
    input's displayed text is forced back to the confirmed name (or cleared
    if nothing was confirmed).
  - Role is a native `<select>` (not `datalist`), first option is the
    `בחרו תפקיד…` placeholder, matching the already-fixed "always show all
    options" behavior.
  - Validity hints: after a field is blurred at least once (`touched`), an
    empty name and/or role gets the `pr-invalid` class and the shared
    `pr-hint` paragraph shows `יש למלא שם` / `יש למלא תפקיד` / `יש למלא שם
    ותפקיד`.
  - `locked` disables the name input, role select, and remove button (and
    closes the dropdown if open). `canRemove` (combined with `locked`)
    controls the remove button's `disabled`.
  - Dropdown list is `position: fixed`, positioned via
    `getBoundingClientRect()` against the name input on open, and
    repositioned on `scroll`/`resize` (capture-phase listeners registered in
    `onMounted`, removed in `onUnmounted`) — ports `#position`/`#open`/
    `#onReposition` exactly. Closing on outside click ports `#onDocClick`
    (document-level listener, `onMounted`/`onUnmounted`).
  - Remove button keeps the inline SVG X icon already built.
- Template structure and CSS classes (`pr-main`, `pr-name-wrap`, `pr-remove`,
  `pr-second`, `pr-role`, `pr-meta`, `pr-hint`, `pr-results`, etc.) are
  preserved so the `<style scoped>` block can be a near-verbatim port of
  `person-row.css`.

### `WhatsappShare.vue`

- Props: `task: string`, `members: Array`, `allComplete: boolean`,
  `template: object | null`.
- Computed: `ready = computed(() => Boolean(task) && members.length > 0 &&
  allComplete)`, `message = computed(() => buildMessage())` — `buildMessage`
  ports the template-filling logic in `src/lib/person.js` or locally,
  unchanged (including the "no dangling ` - `" cleanup for a role-less
  line, which becomes dead-but-harmless now that `allComplete` guarantees
  every emitted member has a role — kept for defensive parity with today's
  code, not worth removing as part of this port).
- Methods: `share()` (native `navigator.share` on touch devices, else
  `wa.me` link — ported unchanged), `copy()` (clipboard write with the same
  success/failure status text).
- Template: the collapsible `<details>` preview with the chevron already
  built, the two action buttons, and the status line — ported 1:1 including
  the not-ready placeholder text `בחרו משימה והוסיפו לפחות אדם אחד עם שם
  ותפקיד.`.

## `src/lib/person.js`

Framework-agnostic module, ported unchanged from the current
`components/person-row/person-row.js` exports:

```js
export const NO_ID = 'ללא מ"א';
export function personKey({ id, firstName, lastName }) { /* unchanged */ }
```

## Styling

- `src/style.css`: the `:root` custom properties, `*`/`html`/`body`/`.card`/
  `.app-header`/`.app-error`/shared `input`/`select`/`button` rules, and the
  two `@media` blocks — ported verbatim from the current `style.css` (minus
  the four `@import` lines, since each component now carries its own
  scoped styles).
- Each `.vue` file's `<style scoped>` is a near-verbatim port of its current
  CSS file, with the old custom-element tag selector (e.g. `person-row {
  ... }`, `team-builder { ... }`, `whatsapp-share { ... }`, `task-select {
  ... }`) rewritten to target the SFC's root element (a plain `<div
  class="person-row">` etc., since Vue SFC roots aren't custom elements).

## Error handling

Identical to today: a single `try/catch` around the four `fetch` calls in
`App.vue`, surfacing the same Hebrew message. No other new error states are
introduced by this migration.

## Build & dev workflow

- `npm install` once.
- `npm run dev` — Vite dev server with HMR, replaces `python3 -m
  http.server`.
- `npm run build` — produces a static `dist/` folder (deployable to any
  static host, same deployment model as today).
- `npm run preview` — serves the production build locally for a final
  sanity check.
- `README.md` rewritten to describe these commands and drop the old
  `python3 -m http.server` instructions.

## Testing / verification plan

No automated tests exist today and none are introduced by this migration.
After implementation, manually re-verify (via `npm run dev`) the same
scenarios already validated earlier in this project:

1. Team section is locked (inputs, remove, add-person button all disabled)
   until a mission is chosen; clearing the mission re-locks it while
   keeping entered data.
2. Duplicate-person prevention: picking a person in one row removes them
   from every other row's dropdown; removing that row makes them
   reappear elsewhere.
3. Mandatory fields: an incomplete row (missing name or role) blocks
   WhatsApp share/copy; the red outline + hint text appear after the field
   is visited and left empty.
4. Name field only accepts a person chosen from the dropdown — typed text
   that isn't confirmed via a pick is discarded on blur.
5. Role field is a real `<select>` showing all roles regardless of the
   current selection.
6. WhatsApp share/copy buttons enable only when a mission is chosen, at
   least one person exists, and every row is complete; the message preview
   collapses/expands via the chevron.
7. Visual polish (shadows, gradients, hover/focus states, spacing) looks
   the same as the current vanilla-JS version.

## Out of scope

- No router, no Pinia, no TypeScript, no automated tests, no CI, no git
  initialization — all explicitly declined during brainstorming.
- No behavior changes beyond the mechanical framework port — this is a
  like-for-like migration.
