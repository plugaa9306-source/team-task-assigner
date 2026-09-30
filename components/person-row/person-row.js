export const NO_ID = 'ללא מ"א';
let rowCounter = 0;

/** Identity key for dedup: real DB id when known, else normalized full name. */
export function personKey({ id, firstName, lastName }) {
  return id && id !== NO_ID
    ? `id:${id}`
    : `name:${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

export class PersonRow extends HTMLElement {
  #people = [];
  #roles = [];
  #uid = ++rowCounter;
  #state = { firstName: "", lastName: "", id: NO_ID };
  #matches = [];
  #active = -1;
  #taken = new Set();
  #canRemove = false;
  #locked = false;
  #touched = { name: false, role: false };

  #nameInput; #roleInput; #list; #meta; #removeBtn; #hint;
  #onDocClick = (e) => { if (!this.contains(e.target)) this.#close(); };
  #onReposition = (e) => {
    if (this.#list.hidden || e.target === this.#list) return;
    this.#position();
  };

  set people(v) { this.#people = v; }
  set roles(v) { this.#roles = v; if (this.isConnected) this.#fillRoles(); }
  set canRemove(v) { this.#canRemove = v; this.#applyDisabled(); }
  /** Keys (from personKey) of people already assigned to other rows. */
  set taken(v) { this.#taken = v ?? new Set(); }
  /** Disables all inputs/buttons on this row (e.g. while no mission is chosen yet). */
  set locked(v) { this.#locked = v; this.#applyDisabled(); }

  get value() {
    const s = this.#state;
    const hasName = (s.firstName + s.lastName).trim() !== "";
    return {
      firstName: s.firstName,
      lastName: s.lastName,
      id: s.id,
      role: this.#roleInput.value.trim(),
      filled: hasName,
    };
  }

  focusName() { this.#nameInput?.focus(); }

  connectedCallback() {
    const resId = `pr-res-${this.#uid}`;
    this.innerHTML = `
      <div class="pr-main">
        <div class="pr-name-wrap">
          <input type="text" class="pr-name" placeholder="חיפוש שם פרטי או משפחה" autocomplete="off"
                 role="combobox" aria-expanded="false" aria-controls="${resId}" aria-autocomplete="list"
                 aria-label="שם">
          <ul class="pr-results" id="${resId}" role="listbox" hidden></ul>
        </div>
        <button type="button" class="pr-remove" aria-label="הסר אדם">
          <svg class="pr-remove-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="pr-second">
        <select class="pr-role" aria-label="תפקיד"></select>
        <span class="pr-meta"></span>
      </div>
      <p class="pr-hint" hidden></p>`;

    this.#nameInput = this.querySelector(".pr-name");
    this.#roleInput = this.querySelector(".pr-role");
    this.#list = this.querySelector(".pr-results");
    this.#meta = this.querySelector(".pr-meta");
    this.#removeBtn = this.querySelector(".pr-remove");
    this.#hint = this.querySelector(".pr-hint");

    this.#fillRoles();
    this.#renderMeta();

    this.#nameInput.addEventListener("input", () => this.#onInput());
    this.#nameInput.addEventListener("keydown", (e) => this.#onKey(e));
    this.#nameInput.addEventListener("blur", () => {
      this.#touched.name = true;
      // Only a pick from the list counts; discard any unmatched typed text.
      this.#nameInput.value = `${this.#state.firstName} ${this.#state.lastName}`.trim();
      this.#renderValidity();
    });
    this.#roleInput.addEventListener("change", () => this.#emit());
    this.#roleInput.addEventListener("blur", () => { this.#touched.role = true; this.#renderValidity(); });
    this.#removeBtn.addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("remove-request", { bubbles: true })));

    this.#list.addEventListener("mousedown", (e) => e.preventDefault()); // keep input focus
    this.#list.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-i]");
      if (li) this.#pick(this.#matches[+li.dataset.i]);
    });

    document.addEventListener("click", this.#onDocClick);
    window.addEventListener("scroll", this.#onReposition, true);
    window.addEventListener("resize", this.#onReposition);

    this.#applyDisabled();
    this.#renderValidity();
  }

  disconnectedCallback() {
    document.removeEventListener("click", this.#onDocClick);
    window.removeEventListener("scroll", this.#onReposition, true);
    window.removeEventListener("resize", this.#onReposition);
  }

  #fillRoles() {
    if (!this.#roleInput) return;
    const current = this.#roleInput.value;
    this.#roleInput.innerHTML = `<option value="">בחרו תפקיד…</option>` +
      this.#roles.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
    if (current && this.#roles.includes(current)) this.#roleInput.value = current;
  }

  #onInput() {
    // Typing invalidates any prior pick; only choosing from the list confirms a person.
    if (this.#state.id !== NO_ID) {
      this.#state = { firstName: "", lastName: "", id: NO_ID };
      this.#renderMeta();
    }
    this.#search();
    this.#emit();
  }

  #search() {
    const q = this.#nameInput.value.trim().toLowerCase();
    if (!q) return this.#close();
    this.#matches = this.#people
      .filter((p) => {
        const first = p.firstName.toLowerCase();
        const last = p.lastName.toLowerCase();
        const matchesQuery = first.includes(q) || last.includes(q) || `${first} ${last}`.includes(q);
        return matchesQuery && !this.#taken.has(personKey(p));
      })
      .slice(0, 30);

    if (!this.#matches.length) return this.#close();

    this.#list.innerHTML = this.#matches
      .map((p, i) => `<li role="option" data-i="${i}">
          <span class="pr-res-name">${esc(p.firstName)} ${esc(p.lastName)}</span>
          <span class="pr-res-id">${esc(p.id)}</span>
        </li>`)
      .join("");
    this.#active = -1;
    this.#open();
  }

  #pick(p) {
    this.#state = { firstName: p.firstName, lastName: p.lastName, id: p.id };
    this.#nameInput.value = `${p.firstName} ${p.lastName}`;
    this.#renderMeta();
    this.#close();
    this.#emit();
    this.#roleInput.focus();
  }

  #onKey(e) {
    const open = !this.#list.hidden;
    if (e.key === "ArrowDown" && open) { e.preventDefault(); this.#move(1); }
    else if (e.key === "ArrowUp" && open) { e.preventDefault(); this.#move(-1); }
    else if (e.key === "Enter" && open && this.#active >= 0) { e.preventDefault(); this.#pick(this.#matches[this.#active]); }
    else if (e.key === "Escape") this.#close();
  }

  #move(step) {
    const items = [...this.#list.children];
    this.#active = (this.#active + step + items.length) % items.length;
    items.forEach((li, i) => li.classList.toggle("is-active", i === this.#active));
    items[this.#active].scrollIntoView({ block: "nearest" });
  }

  // Results are position:fixed so the scrolling team list never clips them.
  #open() {
    this.#list.hidden = false;
    this.#nameInput.setAttribute("aria-expanded", "true");
    this.#position();
  }

  #close() {
    if (!this.#list) return;
    this.#list.hidden = true;
    this.#nameInput.setAttribute("aria-expanded", "false");
  }

  #position() {
    const r = this.#nameInput.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 10;
    const above = r.top - 10;
    const flip = below < 160 && above > below;
    const max = Math.max(120, Math.min(260, flip ? above : below));
    Object.assign(this.#list.style, {
      width: `${r.width}px`,
      left: `${r.left}px`,
      maxHeight: `${max}px`,
      top: flip ? "auto" : `${r.bottom + 4}px`,
      bottom: flip ? `${window.innerHeight - r.top + 4}px` : "auto",
    });
  }

  #renderMeta() {
    const s = this.#state;
    const has = (s.firstName + s.lastName).trim() !== "";
    this.#meta.textContent = has ? (s.id === NO_ID ? NO_ID : `מ"א ${s.id}`) : "";
    this.#meta.classList.toggle("is-free", has && s.id === NO_ID);
  }

  #emit() {
    this.#renderValidity();
    this.dispatchEvent(new CustomEvent("person-change", { bubbles: true }));
  }

  #applyDisabled() {
    if (!this.#nameInput) return;
    this.#nameInput.disabled = this.#locked;
    this.#roleInput.disabled = this.#locked;
    this.#removeBtn.disabled = this.#locked || !this.#canRemove;
    if (this.#locked) this.#close();
  }

  /** Red outline + hint text for a field left empty after being visited. */
  #renderValidity() {
    if (!this.#nameInput) return;
    const hasName = (this.#state.firstName + this.#state.lastName).trim() !== "";
    const hasRole = this.#roleInput.value.trim() !== "";
    const nameInvalid = this.#touched.name && !hasName;
    const roleInvalid = this.#touched.role && !hasRole;
    this.#nameInput.classList.toggle("pr-invalid", nameInvalid);
    this.#roleInput.classList.toggle("pr-invalid", roleInvalid);
    if (nameInvalid && roleInvalid) this.#hint.textContent = "יש למלא שם ותפקיד";
    else if (nameInvalid) this.#hint.textContent = "יש למלא שם";
    else if (roleInvalid) this.#hint.textContent = "יש למלא תפקיד";
    else this.#hint.textContent = "";
    this.#hint.hidden = !(nameInvalid || roleInvalid);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

customElements.define("person-row", PersonRow);
