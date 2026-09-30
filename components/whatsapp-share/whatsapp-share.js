export class WhatsappShare extends HTMLElement {
  #template = null;
  #task = "";
  #members = [];
  #allComplete = false;
  #preview; #shareBtn; #copyBtn; #status;

  set template(t) { this.#template = t; this.#refresh(); }

  update({ task, members, allComplete }) {
    if (task !== undefined) this.#task = task;
    if (members !== undefined) this.#members = members;
    if (allComplete !== undefined) this.#allComplete = allComplete;
    this.#refresh();
  }

  /** Builds the message text from data/template.json */
  buildMessage() {
    const t = this.#template;
    if (!t) return "";
    const fill = (str, m = {}) =>
      str
        .replaceAll("{TASK}", this.#task)
        .replaceAll("{FIRST_NAME}", m.firstName ?? "")
        .replaceAll("{LAST_NAME}", m.lastName ?? "")
        .replaceAll("{ID}", m.id ?? "")
        .replaceAll("{ROLE}", m.role ?? "");

    const items = this.#members.map((m) => {
      let line = fill(t.item_format, m);
      if (!m.role) line = line.replace(/\s*-\s*$/, "").replace(/\s{2,}/g, " "); // no dangling " - "
      return line.trim();
    });

    return [fill(t.header), "", fill(t.subheader), ...items, "", fill(t.footer)].join("\n");
  }

  connectedCallback() {
    this.innerHTML = `
      <details class="ws-preview">
        <summary>
          <span>תצוגה מקדימה של ההודעה</span>
          <span class="ws-chevron" aria-hidden="true">▾</span>
        </summary>
        <pre class="ws-text"></pre>
      </details>
      <div class="ws-actions">
        <button type="button" class="ws-share">שתף בוואטסאפ</button>
        <button type="button" class="ws-copy">העתק</button>
      </div>
      <p class="ws-status" role="status" aria-live="polite"></p>`;
    this.#preview = this.querySelector(".ws-text");
    this.#shareBtn = this.querySelector(".ws-share");
    this.#copyBtn = this.querySelector(".ws-copy");
    this.#status = this.querySelector(".ws-status");

    this.#shareBtn.addEventListener("click", () => this.#share());
    this.#copyBtn.addEventListener("click", () => this.#copy());
    this.#refresh();
  }

  #ready() {
    return Boolean(this.#task) && this.#members.length > 0 && this.#allComplete;
  }

  #refresh() {
    if (!this.#preview) return;
    const ok = this.#ready();
    this.#preview.textContent = ok ? this.buildMessage() : "בחרו משימה והוסיפו לפחות אדם אחד עם שם ותפקיד.";
    this.#shareBtn.disabled = !ok;
    this.#copyBtn.disabled = !ok;
    this.#status.textContent = "";
  }

  async #share() {
    const text = this.buildMessage();
    // Native share sheet on touch devices; WhatsApp Web link elsewhere.
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch && navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async #copy() {
    try {
      await navigator.clipboard.writeText(this.buildMessage());
      this.#status.textContent = "ההודעה הועתקה";
    } catch {
      this.#status.textContent = "לא ניתן להעתיק. סמנו את הטקסט ידנית.";
    }
  }
}

customElements.define("whatsapp-share", WhatsappShare);
