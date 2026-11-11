/* Player-only Support Desk. All identity/access checks remain on the server. */
(() => {
  "use strict";
  const roots = Array.from(document.querySelectorAll("[data-support-desk]"));
  if (!roots.length) return;
  const API = (["localhost", "127.0.0.1"].includes(location.hostname) ? "http://localhost:3000/api" : "https://roadimentary-admin-dashboard.onrender.com/api") + "/player/support";
  const STORAGE = "roadimentary.support.pending.v1";
  const categories = { bug: "Bug report", suggestion: "Suggestion", account_help: "Account help", other: "Other feedback" };
  const areas = { game: "Game", website: "Website", account: "Account", general: "General" };
  const statuses = { open: "Open", in_review: "In Review", needs_reply: "Needs Your Reply", resolved: "Resolved" };
  const fields = ["category", "area", "subject", "description", "steps", "expected", "actual", "gameVersion"];
  const blank = () => ({ category: "bug", area: "game", subject: "", description: "", steps: "", expected: "", actual: "", gameVersion: "" });
  const fresh = () => ({ view: "list", draft: blank(), filter: "", list: [], listLoaded: false, listCursor: null, listBusy: false, listChecked: 0,
    selected: null, ticket: null, messages: [], threadCursor: null, threadBusy: false, threadReady: false,
    writeBusy: false, outbox: null, discard: false, message: "", kind: "info", cooldown: 0, storageWarning: false });
  const q = (root, selector) => root.querySelector(selector);
  const make = (tag, className, value) => { const el = document.createElement(tag); if (className) el.className = className; if (value !== undefined) el.textContent = value; return el; };
  const validId = value => typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
  const cursor = value => value === null || typeof value === "string" && /^[1-9]\d{0,18}$/.test(value);
  const line = (value, max, min = 0) => typeof value === "string" && Array.from(value).length >= min && Array.from(value).length <= max;
  const timestamp = value => typeof value === "string" && value.length <= 64 && Number.isFinite(Date.parse(value));
  const normalize = value => value.replace(/\r\n?/g, "\n").normalize("NFC").trim();
  const malformed = () => new Error("Support returned an unexpected response. Please refresh and try again.");
  let auth = null, epoch = 0, listVersion = 0, threadVersion = 0, state = fresh(), cooldownTimer = null;
  const controllers = new Set(), drafts = new Map();
  function current() {
    if (!auth) return false;
    if (sessionStorage.getItem("pfSessionTicket") === auth.ticket) return true;
    stop("Your session changed. Sign in again to open Support Desk."); return false;
  }
  const same = e => e === epoch && current();
  function notice(message = "", kind = "info") { state.message = message; state.kind = kind; }
  function savePending() {
    try {
      if (!state.outbox) sessionStorage.removeItem(STORAGE);
      else sessionStorage.setItem(STORAGE, JSON.stringify({ owner: auth.id, kind: state.outbox.kind, ticketId: state.outbox.ticketId, payload: state.outbox.payload }));
    } catch (_) { state.storageWarning = Boolean(state.outbox); }
  }
  function reportPayload(value) {
    if (!value || typeof value !== "object" || Object.keys(value).some(key => ![...fields, "requestId"].includes(key)) || !validId(value.requestId)
      || !Object.hasOwn(categories, value.category) || !Object.hasOwn(areas, value.area)) throw malformed();
    for (const [key, max, min] of [["subject", 120, 3], ["description", 5000, 10], ["steps", 2000, 0], ["expected", 2000, 0], ["actual", 2000, 0], ["gameVersion", 40, 0]]) {
      if (!line(value[key], max, min) || normalize(value[key]) !== value[key]) throw malformed();
    }
    if (new TextEncoder().encode(JSON.stringify(value)).length > 32768) throw new Error("This report is too long. Shorten the text and try again.");
    return Object.fromEntries(["requestId", ...fields].map(key => [key, value[key]]));
  }
  function restorePending() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE) || "null");
      if (!saved) return;
      if (saved.owner !== auth.id || !["report", "reply"].includes(saved.kind)) throw malformed();
      const payload = saved.kind === "report" ? reportPayload(saved.payload) : saved.payload;
      if (saved.kind === "reply" && (!validId(saved.ticketId) || !validId(payload?.requestId) || !line(payload.body, 5000, 1)
        || Object.keys(payload).some(key => !["requestId", "body"].includes(key)))) throw malformed();
      state.outbox = { kind: saved.kind, ticketId: saved.kind === "reply" ? saved.ticketId : null, payload, uncertain: true };
      if (saved.kind === "report") { for (const key of fields) state.draft[key] = payload[key]; state.view = "composer"; }
      else { drafts.set(saved.ticketId, payload.body); }
    } catch (_) { try { sessionStorage.removeItem(STORAGE); } catch (_) {} }
  }
  function parseTicket(raw, detail = false) {
    if (!raw || !validId(raw.id) || !/^RD-\d{6,19}$/.test(raw.reference) || !Object.hasOwn(categories, raw.category)
      || !Object.hasOwn(areas, raw.area) || !Object.hasOwn(statuses, raw.status) || !line(raw.subject, 120, 3)
      || !line(raw.gameVersion, 40) || !timestamp(raw.createdAt) || !timestamp(raw.updatedAt)) throw malformed();
    const ticket = Object.fromEntries(["id", "reference", "category", "area", "subject", "status", "gameVersion", "createdAt", "updatedAt"].map(key => [key, raw[key]]));
    if (detail) for (const [key, max] of [["description", 5000], ["steps", 2000], ["expected", 2000], ["actual", 2000]]) {
      if (!line(raw[key], max, key === "description" ? 10 : 0)) throw malformed(); ticket[key] = raw[key];
    }
    return ticket;
  }
  function parseMessage(raw) {
    if (!raw || !validId(raw.id) || !line(raw.body, 5000, 1) || !["player", "admin"].includes(raw.authorRole)
      || !line(raw.authorName, 100, 1) || !timestamp(raw.createdAt) || (raw.visibility !== undefined && raw.visibility !== "public")) throw malformed();
    return { id: raw.id, body: raw.body, authorRole: raw.authorRole, authorName: raw.authorRole === "admin" ? "LNJK Support" : "You", createdAt: raw.createdAt };
  }
  function parsePage(data, field, parse) {
    if (data?.ok !== true || !Array.isArray(data[field]) || data[field].length > 30 || !cursor(data.nextCursor)) throw malformed();
    const rows = data[field].map(parse);
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw malformed();
    return { rows, next: data.nextCursor };
  }
  function sendId() {
    if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
    if (!crypto?.getRandomValues) throw new Error("Couldn’t prepare a safe send. Refresh the page before trying again.");
    const a = crypto.getRandomValues(new Uint8Array(16)); a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128;
    return [...a].map((x, i) => ([4, 6, 8, 10].includes(i) ? "-" : "") + x.toString(16).padStart(2, "0")).join("");
  }
  async function request(path, method = "GET", payload) {
    if (!current()) throw Object.assign(new Error("Sign in again to open Support Desk."), { expired: true });
    const e = epoch, session = auth, controller = new AbortController(); controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      let response, data;
      try {
        response = await fetch(API + path, { method, cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal,
          headers: { Authorization: "Bearer " + session.ticket, ...(payload ? { "Content-Type": "application/json" } : {}) },
          ...(payload ? { body: JSON.stringify(payload) } : {}) });
        if (!same(e)) throw { stale: true };
        if ([401, 403].includes(response.status)) {
          const callback = auth.onExpired;
          stop("Your session expired. Sign in again to open Support Desk.");
          callback?.("Your session expired. Sign in again to open Support Desk.");
          throw { expired: true };
        }
        try { data = await response.json(); } catch (_) { throw Object.assign(malformed(), { uncertain: method !== "GET" }); }
      } catch (error) {
        if (error.stale || error.expired || error.uncertain) throw error;
        throw Object.assign(new Error("Couldn’t reach Support Desk. Check your connection and try again."), { uncertain: method !== "GET" });
      }
      if (!same(e)) throw { stale: true };
      if (!response.ok || data?.ok !== true) {
        const messages = { 400: "Please check the report fields and try again.", 404: "This report is no longer available. Refresh My Reports.",
          409: "Couldn’t confirm this send. Check My Reports before starting another.", 413: "This report is too long. Shorten the text and try again.",
          429: "You’ve sent several requests recently. Please wait before trying again." };
        const error = Object.assign(new Error(messages[response.status] || "Support Desk is temporarily unavailable. Please try again later."), {
          status: response.status, uncertain: response.status >= 500 || response.status === 409 || response.ok,
          retryAfter: response.status === 429 ? Math.min(3600, Math.max(1, Number(response.headers.get("Retry-After")) || 60)) : 0
        });
        throw error;
      }
      return data;
    } finally { clearTimeout(timer); controllers.delete(controller); }
  }

  roots.forEach(root => {
    const prefix = root.dataset.supportDesk + "-support";
    // Fixed UI and internal prefixes only. Service/user text always uses textContent.
    root.innerHTML = `
      <header class="support-heading"><div><p class="office-kicker">Roadimentary / crew support</p><h2 data-support-heading tabindex="-1">Support Desk</h2><p>Send a work-order slip to the team. Your reports stay private.</p></div><button type="button" class="office-button" data-support-action="account">← Account</button></header>
      <div class="support-pending" data-support-pending hidden><p data-support-pending-copy role="status"></p><div class="support-actions"><button type="button" class="office-button" data-support-action="pending">Return to pending send</button><button type="button" class="paper-link" data-support-action="discard">Set this send aside</button></div><div class="support-discard" data-support-discard hidden><p>This send may already have arrived. Check My Reports before sending a new copy. Keep your draft and set this pending send aside?</p><button type="button" class="office-button" data-support-action="keep">Keep pending send</button><button type="button" class="office-button office-button-danger" data-support-action="confirm-discard">Set aside</button></div></div>
      <nav class="support-view-switch" aria-label="Support Desk sections"><button type="button" class="office-button" data-support-action="list" aria-pressed="true">My Reports</button><button type="button" class="office-button office-button-primary" data-support-action="new" aria-pressed="false">New report</button></nav>
      <p class="support-notice" data-support-status role="status" aria-live="polite" hidden></p>
      <section data-support-view="list" class="office-paper support-paper">
        <div class="support-section-heading"><h3>My Reports</h3><button type="button" class="office-button" data-support-action="refresh-list">Refresh reports</button></div>
        <label class="support-filter">Status<select data-support-filter aria-label="Filter reports by status"><option value="">All reports</option><option value="open">Open</option><option value="in_review">In Review</option><option value="needs_reply">Needs Your Reply</option><option value="resolved">Resolved</option></select></label>
        <ul class="support-report-list" data-support-list aria-label="Your private reports" aria-busy="false"></ul>
        <button type="button" class="office-button" data-support-action="more-list" hidden>Load more reports</button>
      </section>
      <section data-support-view="composer" class="office-paper support-paper" hidden>
        <p class="office-kicker">New work-order slip</p><h3>Tell us what happened</h3>
        <form data-support-form="report" class="support-form">
          <div class="support-form-row"><label for="${prefix}-category">Type<select id="${prefix}-category" data-support-field="category"><option value="bug">Bug report</option><option value="suggestion">Suggestion</option><option value="account_help">Account help</option><option value="other">Other feedback</option></select></label><label for="${prefix}-area">Where?<select id="${prefix}-area" data-support-field="area"><option value="game">Game</option><option value="website">Website</option><option value="account">Account</option><option value="general">General</option></select></label></div>
          <label for="${prefix}-subject">Subject<input id="${prefix}-subject" type="text" minlength="3" maxlength="120" required data-support-field="subject" placeholder="A short summary of the issue" /></label>
          <label for="${prefix}-description">Description<textarea id="${prefix}-description" rows="5" minlength="10" maxlength="5000" required data-support-field="description" placeholder="Describe the issue or share your suggestion." aria-describedby="${prefix}-privacy"></textarea></label>
          <details class="support-bug-details" data-support-bug-fields><summary>Reproduction details (optional)</summary><div class="support-form"><label for="${prefix}-steps">Steps to reproduce<textarea id="${prefix}-steps" rows="3" maxlength="2000" data-support-field="steps" placeholder="What did you do before the issue happened?"></textarea></label><label for="${prefix}-expected">Expected result<textarea id="${prefix}-expected" rows="2" maxlength="2000" data-support-field="expected"></textarea></label><label for="${prefix}-actual">Actual result<textarea id="${prefix}-actual" rows="2" maxlength="2000" data-support-field="actual"></textarea></label><label for="${prefix}-version">Game version (if known)<input id="${prefix}-version" type="text" maxlength="40" data-support-field="gameVersion" /></label></div></details>
          <p class="support-privacy" id="${prefix}-privacy">Only you and authorized admins can view this report. Don’t include passwords, sign-in codes, payment details, or session tokens. Text only for now.</p>
          <button type="submit" class="office-button office-button-primary" data-support-submit>Send report</button>
        </form>
      </section>
      <section data-support-view="thread" hidden>
        <div class="support-thread-tools"><button type="button" class="paper-link" data-support-action="list">← My Reports</button><button type="button" class="office-button" data-support-action="refresh-thread">Refresh conversation</button></div>
        <article class="office-paper support-paper" data-support-original></article>
        <section class="office-paper support-paper"><h3>Conversation</h3><ul class="support-messages" data-support-messages aria-label="Report conversation" aria-busy="false"></ul><button type="button" class="office-button" data-support-action="more-thread" hidden>Load later replies</button>
          <form class="support-form support-reply-form" data-support-form="reply"><label for="${prefix}-reply">Your follow-up<textarea id="${prefix}-reply" rows="3" maxlength="5000" required data-support-reply placeholder="Add a detail or respond to Support."></textarea></label><p class="support-privacy" data-support-reply-note></p><button type="submit" class="office-button office-button-primary" data-support-send-reply>Send reply</button></form>
        </section>
      </section>`;
    root.addEventListener("input", event => {
      const field = event.target.dataset.supportField;
      if (fields.includes(field)) { state.draft[field] = event.target.value; syncInputs(); }
      if (event.target.matches("[data-support-reply]") && state.selected) {
        drafts.set(state.selected, event.target.value); syncInputs();
      }
    });
    root.addEventListener("change", event => {
      const field = event.target.dataset.supportField;
      if (fields.includes(field)) {
        state.draft[field] = event.target.value;
        if (field === "category" && state.draft.category === "account_help") state.draft.area = "account";
        syncInputs();
      }
      if (event.target.matches("[data-support-filter]")) {
        state.filter = event.target.value; state.list = []; state.listLoaded = false; state.listCursor = null;
        notice(); void readList();
      }
    });
    root.addEventListener("submit", event => {
      if (!event.target.dataset.supportForm) return;
      event.preventDefault();
      void send(event.target.dataset.supportForm === "report" ? "report" : "reply");
    });
    root.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      if (button.dataset.supportTicket) { void selectTicket(button.dataset.supportTicket); return; }
      const action = button.dataset.supportAction;
      if (action === "account") document.dispatchEvent(new CustomEvent("roadimentary:support-back"));
      else if (action === "new") { state.view = "composer"; notice(); paint(); }
      else if (action === "list") { state.view = "list"; notice(); paint(); if (!state.listLoaded || Date.now() - state.listChecked > 60000) void readList(); }
      else if (action === "refresh-list") void readList();
      else if (action === "more-list") void readList(true);
      else if (action === "refresh-thread") void readThread();
      else if (action === "more-thread") void readThread(true);
      else if (action === "pending") {
        if (state.outbox?.kind === "report") { state.view = "composer"; paint(); }
        else if (state.outbox) void selectTicket(state.outbox.ticketId);
      } else if (action === "discard") { state.discard = true; paint(); }
      else if (action === "keep") { state.discard = false; paint(); }
      else if (action === "confirm-discard" && state.outbox && !state.writeBusy) {
        state.outbox = null; state.discard = false; savePending();
        notice("Pending send set aside. Your draft is kept. Check My Reports before sending another copy."); paint();
      }
    });
  });

  function syncInputs() {
    for (const root of roots) {
      for (const key of fields) { const el = q(root, `[data-support-field="${key}"]`); if (el.value !== state.draft[key]) el.value = state.draft[key]; }
      const reply = q(root, "[data-support-reply]"); const value = drafts.get(state.selected) || "";
      if (reply.value !== value) reply.value = value;
      q(root, "[data-support-filter]").value = state.filter;
      q(root, "[data-support-bug-fields]").hidden = state.draft.category !== "bug";
    }
  }
  function statusBadge(status) { const badge = make("span", "support-status-badge", statuses[status]); badge.dataset.status = status; return badge; }
  function time(value) { const el = make("time", "", new Date(value).toLocaleString()); el.dateTime = new Date(value).toISOString(); return el; }
  function paint() {
    const signedIn = Boolean(auth && sessionStorage.getItem("pfSessionTicket") === auth.ticket);
    syncInputs();
    for (const root of roots) {
      root.querySelectorAll("[data-support-view]").forEach(view => { view.hidden = view.dataset.supportView !== state.view; });
      for (const action of ["list", "new"]) root.querySelectorAll(`[data-support-action="${action}"]`).forEach(button => button.setAttribute("aria-pressed", String(state.view === (action === "new" ? "composer" : "list"))));
      const status = q(root, "[data-support-status]"); status.textContent = state.message; status.dataset.kind = state.kind; status.hidden = !state.message;
      const pending = q(root, "[data-support-pending]"); pending.hidden = !state.outbox;
      q(root, "[data-support-pending-copy]").textContent = state.writeBusy ? "Sending your " + (state.outbox?.kind === "report" ? "report…" : "reply…")
        : state.outbox ? "This send still needs confirmation. Retry it using the same send button; don’t start a new copy." + (state.storageWarning ? " Keep this tab open until it is confirmed." : "") : "";
      q(root, "[data-support-discard]").hidden = !state.discard;
      for (const action of ["pending", "discard", "confirm-discard"]) q(root, `[data-support-action="${action}"]`).disabled = state.writeBusy;
      q(root, "[data-support-filter]").disabled = !signedIn || state.writeBusy;
      const list = q(root, "[data-support-list]"); list.replaceChildren(); list.setAttribute("aria-busy", String(state.listBusy));
      if (!state.list.length) list.append(make("li", "support-empty", state.listBusy ? "Opening your report file…" : state.listLoaded ? (state.filter ? "No reports match this status." : "No reports yet. Use New report to contact the team.") : "Use Refresh reports to open your report file."));
      for (const ticket of state.list) {
        const item = make("li", "support-report-row"), button = make("button", "support-report-button");
        button.type = "button"; button.dataset.supportTicket = ticket.id;
        button.disabled = state.writeBusy;
        const copy = make("span", "support-report-copy"); copy.append(make("small", "support-reference", ticket.reference + " / " + categories[ticket.category]), make("strong", "", ticket.subject), time(ticket.createdAt));
        button.append(copy, statusBadge(ticket.status), make("span", "support-open-arrow", "→")); item.append(button); list.append(item);
      }
      const refreshList = q(root, '[data-support-action="refresh-list"]'); refreshList.disabled = !signedIn || state.listBusy || state.writeBusy; refreshList.textContent = state.listBusy ? "Checking…" : "Refresh reports";
      root.querySelectorAll('[data-support-action="new"], [data-support-action="list"]').forEach(button => { button.disabled = state.writeBusy; });
      const moreList = q(root, '[data-support-action="more-list"]'); moreList.hidden = !state.listCursor; moreList.disabled = !signedIn || state.listBusy || state.writeBusy;
      const reportPending = state.outbox?.kind === "report";
      root.querySelectorAll("[data-support-field]").forEach(field => { field.disabled = !signedIn || state.writeBusy || reportPending; });
      const submit = q(root, "[data-support-submit]"); submit.textContent = state.writeBusy && reportPending ? "Sending…" : reportPending ? "Retry report" : "Send report";
      submit.disabled = !signedIn || state.writeBusy || state.cooldown > Date.now() || Boolean(state.outbox && !reportPending);
      const original = q(root, "[data-support-original]"); original.replaceChildren();
      if (state.ticket) {
        const ticket = state.ticket, meta = make("div", "support-ticket-meta");
        meta.append(make("span", "support-reference", ticket.reference), statusBadge(ticket.status));
        original.append(meta, make("h3", "support-ticket-title", ticket.subject));
        const context = make("p", "support-ticket-context", categories[ticket.category] + " · " + areas[ticket.area] + (ticket.gameVersion ? " · Version " + ticket.gameVersion : ""));
        original.append(context, time(ticket.createdAt));
        if (ticket.description) original.append(make("p", "support-original-text", ticket.description));
        for (const [key, label] of [["steps", "Steps to reproduce"], ["expected", "Expected result"], ["actual", "Actual result"]]) if (ticket[key]) {
          const block = make("section", "support-repro-block"); block.append(make("h4", "", label), make("p", "", ticket[key])); original.append(block);
        }
      } else original.append(make("p", "support-empty", state.threadBusy ? "Opening the report…" : "This report could not be opened. Refresh the conversation to try again."));
      const messages = q(root, "[data-support-messages]"); messages.replaceChildren(); messages.setAttribute("aria-busy", String(state.threadBusy));
      if (!state.messages.length) messages.append(make("li", "support-empty", state.threadBusy ? "Checking the conversation…" : state.threadReady ? "No replies yet. The team’s response will appear here." : "Replies haven’t loaded. Try Refresh conversation."));
      for (const message of state.messages) {
        const row = make("li", "support-message" + (message.authorRole === "admin" ? " is-support" : ""));
        const heading = make("header"); heading.append(make("strong", "", message.authorName), time(message.createdAt));
        row.append(heading, make("p", "", message.body)); messages.append(row);
      }
      const moreThread = q(root, '[data-support-action="more-thread"]'); moreThread.hidden = !state.threadCursor; moreThread.disabled = state.threadBusy || state.writeBusy || !signedIn;
      const refreshThread = q(root, '[data-support-action="refresh-thread"]'); refreshThread.disabled = !signedIn || state.threadBusy || state.writeBusy; refreshThread.textContent = state.threadBusy ? "Checking…" : "Refresh conversation";
      const ownReplyPending = state.outbox?.kind === "reply" && state.outbox.ticketId === state.selected;
      q(root, "[data-support-reply]").disabled = !signedIn || !state.threadReady || state.writeBusy || ownReplyPending;
      q(root, "[data-support-send-reply]").disabled = !signedIn || !state.threadReady || state.threadBusy || state.writeBusy || state.cooldown > Date.now() || Boolean(state.outbox && !ownReplyPending);
      q(root, "[data-support-send-reply]").textContent = state.writeBusy && ownReplyPending ? "Sending…" : ownReplyPending ? "Retry reply" : "Send reply";
      q(root, "[data-support-reply-note]").textContent = state.ticket?.status === "resolved" ? "Still having trouble? A follow-up will reopen this report." : "Replies go only to you and the authorized support team.";
    }
  }

  async function readList(more = false) {
    if (!current() || state.writeBusy || (more && (!state.listCursor || state.listBusy))) return;
    const e = epoch, v = ++listVersion, filter = state.filter;
    state.listBusy = true; notice(); paint();
    try {
      const params = new URLSearchParams({ limit: "30", ...(filter ? { status: filter } : {}) });
      if (more) params.set("before", state.listCursor);
      const data = parsePage(await request("?" + params), "tickets", raw => parseTicket(raw));
      if (!same(e) || v !== listVersion || filter !== state.filter) return;
      state.list = more ? [...new Map([...state.list, ...data.rows].map(row => [row.id, row])).values()] : data.rows;
      state.listCursor = data.next; state.listLoaded = true; state.listChecked = Date.now();
    } catch (error) {
      if (!same(e) || v !== listVersion || error.expired || error.stale) return;
      if (state.view === "list") notice("Couldn’t load your reports. Try Refresh reports." + (state.list.length ? " Showing the previous list." : ""), "error");
    } finally { if (same(e) && v === listVersion) { state.listBusy = false; paint(); } }
  }
  async function selectTicket(id, known) {
    if (!validId(id) || !current()) return;
    state.selected = id; state.view = "thread"; state.ticket = known || null; state.messages = []; state.threadCursor = null; state.threadReady = false;
    notice(); paint(); await readThread();
  }
  async function readThread(more = false, keepNotice = false) {
    if (!current() || !state.selected || state.writeBusy || (more && (!state.threadCursor || state.threadBusy))) return;
    const e = epoch, v = ++threadVersion, id = state.selected;
    state.threadBusy = true; if (!keepNotice) notice(); paint();
    try {
      const query = new URLSearchParams({ limit: "30" }); if (more) query.set("after", state.threadCursor);
      const [detail, thread] = await Promise.all([request("/" + id), request("/" + id + "/messages?" + query)]);
      const ticket = parseTicket(detail.ticket, true); if (ticket.id !== id) throw malformed();
      const data = parsePage(thread, "messages", parseMessage);
      if (!same(e) || v !== threadVersion || id !== state.selected) return;
      state.ticket = ticket; state.messages = more ? [...new Map([...state.messages, ...data.rows].map(row => [row.id, row])).values()] : data.rows;
      state.threadCursor = data.next; state.threadReady = true;
    } catch (error) {
      if (!same(e) || v !== threadVersion || error.expired || error.stale) return;
      state.threadReady = false;
      if (error.status === 404) { state.ticket = null; state.messages = []; state.threadCursor = null; }
      if (state.view === "thread") notice(error.status === 404 ? "This report is no longer available. Return to My Reports and refresh the list." : "Couldn’t refresh this conversation. Try again before sending a follow-up.", "error");
    } finally { if (same(e) && v === threadVersion) { state.threadBusy = false; paint(); } }
  }
  function captureReport() {
    const payload = { requestId: sendId() };
    for (const key of fields) payload[key] = normalize(state.draft[key]);
    if (!line(payload.subject, 120, 3)) throw new Error("Add a subject with 3–120 characters.");
    if (!line(payload.description, 5000, 10)) throw new Error("Add a description with 10–5000 characters.");
    if (payload.category !== "bug") for (const key of ["steps", "expected", "actual", "gameVersion"]) payload[key] = "";
    return reportPayload(payload);
  }
  async function send(kind) {
    if (!current() || state.writeBusy || state.cooldown > Date.now()) return;
    if (state.outbox && (state.outbox.kind !== kind || (kind === "reply" && state.outbox.ticketId !== state.selected))) return;
    const e = epoch;
    try {
      if (!state.outbox) {
        const body = normalize(drafts.get(state.selected) || "");
        if (kind === "reply" && (!state.threadReady || !line(body, 5000, 1))) throw new Error("Enter a reply of 1–5000 characters.");
        state.outbox = { kind, ticketId: kind === "reply" ? state.selected : null, payload: kind === "report" ? captureReport() : { requestId: sendId(), body }, uncertain: false };
      }
    } catch (error) { notice(error.message || "Check the report fields and try again.", "error"); paint(); return; }
    const outbox = state.outbox;
    let replayedReport = false;
    state.writeBusy = true; state.discard = false; notice(); savePending(); paint();
    try {
      const data = await request(kind === "report" ? "" : "/" + outbox.ticketId + "/replies", "POST", outbox.payload);
      let ticket, message;
      try {
        ticket = parseTicket(data.ticket, kind === "report");
        message = kind === "reply" ? parseMessage(data.message) : null;
        if (typeof data.replayed !== "boolean" || (kind === "reply" && (ticket.id !== outbox.ticketId || message.body !== outbox.payload.body || message.authorRole !== "player"))) throw malformed();
        if (kind === "report" && fields.some(key => ticket[key] !== outbox.payload[key])) throw malformed();
      } catch (_) { throw Object.assign(malformed(), { uncertain: true }); }
      if (!same(e) || state.outbox !== outbox) return;
      state.outbox = null; state.storageWarning = false; savePending();
      state.list = state.list.map(row => row.id === ticket.id ? ticket : row).filter(row => !state.filter || row.status === state.filter); state.listChecked = 0;
      if (kind === "report") {
        replayedReport = data.replayed;
        state.draft = blank(); state.selected = ticket.id; state.view = "thread"; state.ticket = ticket;
        state.messages = []; state.threadCursor = null; state.threadReady = !replayedReport;
        notice("Report " + ticket.reference + " sent. You can follow up here.", "success");
      } else {
        drafts.delete(outbox.ticketId);
        if (state.selected === ticket.id) {
          state.ticket = { ...state.ticket, ...ticket };
          if (!state.threadCursor && !state.messages.some(row => row.id === message.id)) state.messages.push(message);
        }
        notice(state.threadCursor ? "Reply sent. Load later replies to see the newest messages." : "Reply sent.", "success");
      }
    } catch (error) {
      if (!same(e) || error.expired || error.stale || state.outbox !== outbox) return;
      outbox.uncertain = outbox.uncertain || Boolean(error.uncertain);
      if (!outbox.uncertain) { state.outbox = null; savePending(); }
      else savePending();
      if (error.retryAfter) {
        state.cooldown = Date.now() + error.retryAfter * 1000; clearTimeout(cooldownTimer);
        cooldownTimer = setTimeout(() => { if (same(e)) { state.cooldown = 0; paint(); } }, error.retryAfter * 1000);
      }
      notice(error.message || "Couldn’t confirm delivery. Retry the same send.", "error");
    } finally {
      if (same(e)) {
        state.writeBusy = false; paint();
        if (replayedReport) void readThread(false, true);
      }
    }
  }
  function show(visible) {
    roots.forEach(root => { root.hidden = !visible; });
    document.querySelectorAll("[data-account-settings]").forEach(el => { el.hidden = visible; });
    if (!visible) return;
    paint();
    if (!current()) return;
    if (state.view === "list" && (!state.listLoaded || Date.now() - state.listChecked > 60000)) void readList();
    if (state.view === "thread" && state.selected) void readThread();
  }
  function stop(message = "Sign in to open Support Desk.", erase = true) {
    epoch++; listVersion++; threadVersion++; auth = null;
    for (const controller of controllers) controller.abort(); controllers.clear(); clearTimeout(cooldownTimer);
    state = fresh(); drafts.clear(); notice(message, "info");
    if (erase) { try { sessionStorage.removeItem(STORAGE); } catch (_) {} }
    paint();
  }
  window.RoadimentarySupport = Object.freeze({
    show, stop, unavailable(message) { stop(message); },
    init(options) {
      stop("", false);
      if (!/^[a-f0-9]{3,64}$/i.test(options?.currentId || "") || !options?.sessionTicket || sessionStorage.getItem("pfSessionTicket") !== options.sessionTicket) { stop(); return; }
      auth = { id: options.currentId.toUpperCase(), ticket: options.sessionTicket, onExpired: options.onExpired };
      restorePending(); notice(); paint();
      if (roots.some(root => !root.hidden && root.getClientRects().length)) show(true);
    }
  });
  const checkSession = () => { if (auth && sessionStorage.getItem("pfSessionTicket") !== auth.ticket) stop("Your session changed. Sign in again to open Support Desk."); };
  document.addEventListener("visibilitychange", checkSession); window.addEventListener("storage", checkSession); window.addEventListener("pageshow", checkSession);
  paint();
})();
