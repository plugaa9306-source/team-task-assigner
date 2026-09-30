import "../person-row/person-row.js";
import { personKey } from "../person-row/person-row.js";

export class TeamBuilder extends HTMLElement {
  #people = [];
  #roles = [];
  #locked = true;
  #rowsEl; #countEl; #addBtn;

  setData({ people, roles }) {
    this.#people = people;
    this.#roles = roles;
    this.querySelectorAll("person-row").forEach((r) => { r.people = people; r.roles = roles; });
  }

  /** Disables adding/editing/removing people (e.g. until a mission is chosen). */
  set locked(v) { this.#locked = v; this.#applyLock(); }

  /** Current team: only rows that have a name. */
  get members() {
    return [...this.querySelectorAll("person-row")].map((r) => r.value).filter((v) => v.filled);
  }

  /** True only when every row has both a name and a role filled in. */
  get allComplete() {
    const rows = [...this.querySelectorAll("person-row")];
    return rows.length > 0 && rows.every((r) => { const v = r.value; return v.filled && v.role !== ""; });
  }

  connectedCallback() {
    this.innerHTML = `
      <div class="tb-head">
        <h2>צוות</h2>
        <span class="tb-count" aria-live="polite"></span>
      </div>
      <div class="tb-rows"></div>
      <div class="tb-foot">
        <button type="button" class="tb-add">+ הוסף אדם נוסף</button>
      </div>`;
    this.#rowsEl = this.querySelector(".tb-rows");
    this.#countEl = this.querySelector(".tb-count");
    this.#addBtn = this.querySelector(".tb-add");

    this.#addBtn.addEventListener("click", () => this.#addRow(true));
    this.addEventListener("remove-request", (e) => this.#removeRow(e.target.closest("person-row")));
    this.addEventListener("person-change", () => this.#changed());

    this.#addRow(false);
    this.#applyLock();
  }

  #addRow(focus) {
    const row = document.createElement("person-row");
    row.people = this.#people;
    row.roles = this.#roles;
    row.locked = this.#locked;
    this.#rowsEl.append(row);
    this.#syncRemove();
    this.#changed();
    if (focus) {
      row.focusName();
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  #removeRow(row) {
    if (!row || this.#rowsEl.children.length <= 1) return; // never remove the last row
    row.remove();
    this.#syncRemove();
    this.#changed();
  }

  #syncRemove() {
    const rows = [...this.#rowsEl.children];
    rows.forEach((r) => { r.canRemove = rows.length > 1; });
  }

  #applyLock() {
    if (this.#addBtn) this.#addBtn.disabled = this.#locked;
    [...this.#rowsEl.children].forEach((r) => { r.locked = this.#locked; });
  }

  #changed() {
    this.#syncTaken();
    const n = this.members.length;
    this.#countEl.textContent = n === 1 ? "אדם אחד משובץ" : `${n} אנשים משובצים`;
    this.dispatchEvent(new CustomEvent("team-change", {
      bubbles: true,
      detail: { members: this.members, allComplete: this.allComplete },
    }));
  }

  /** Push each row the set of identity keys already used by *other* rows. */
  #syncTaken() {
    const rows = [...this.#rowsEl.children];
    const values = rows.map((r) => r.value);
    rows.forEach((row, i) => {
      const taken = new Set();
      values.forEach((v, j) => { if (j !== i && v.filled) taken.add(personKey(v)); });
      row.taken = taken;
    });
  }
}

customElements.define("team-builder", TeamBuilder);
