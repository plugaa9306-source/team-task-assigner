export class TaskSelect extends HTMLElement {
  #tasks = [];

  set tasks(list) {
    this.#tasks = list;
    if (this.isConnected) this.#render();
  }

  get value() {
    return this.querySelector("select")?.value ?? "";
  }

  connectedCallback() {
    this.#render();
  }

  #render() {
    const current = this.value;
    this.innerHTML = `
      <label class="ts-label" for="ts-select">משימה</label>
      <select id="ts-select">
        <option value="">בחרו משימה…</option>
        ${this.#tasks.map((t) => `<option>${escapeHtml(t)}</option>`).join("")}
      </select>`;
    const select = this.querySelector("select");
    if (current) select.value = current;
    select.addEventListener("change", () => {
      this.dispatchEvent(new CustomEvent("task-change", { bubbles: true, detail: { task: select.value } }));
    });
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

customElements.define("task-select", TaskSelect);
