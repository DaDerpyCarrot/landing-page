(() => {
  "use strict";
  const roots = Array.from(document.querySelectorAll("[data-ledger-board]"));
  if (!roots.length) return;
  const API = ["localhost", "127.0.0.1"].includes(location.hostname) ? "http://localhost:3000/api" : "https://roadimentary-admin-dashboard.onrender.com/api";
  const q = (root, selector) => root.querySelector(selector);
  const node = (tag, className, value) => { const item = document.createElement(tag); if (className) item.className = className; if (value !== undefined) item.textContent = value; return item; };
  let auth = null, epoch = 0, version = 0, controller = null, busy = false, loaded = false;
  let rows = [], next = null, currencies = [], lastLoaded = 0, pending = null, syncWarning = "";
  let message = "Sign in to view your purchase ledger.", kind = "info";
  let draft = { currency: "", from: "", to: "", q: "" }, applied = {};
  const mobileFilters = window.matchMedia("(max-width: 1023px)");
  let filtersOpen = false;
  function paintFilters() {
    const hasApplied = Object.keys(applied).length > 0;
    const canClear = hasApplied || Object.values(draft).some(value => value.trim());
    roots.forEach(root => {
      const expanded = !mobileFilters.matches || filtersOpen;
      const panel = q(root, "[data-ledger-filter-panel]");
      const toggle = q(root, "[data-ledger-toggle]");
      if (!expanded && panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
      panel.hidden = !expanded;
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.textContent = (expanded ? "Hide filters" : "Filter purchases") + (hasApplied ? " · active" : "");
      q(root, "[data-ledger-clear]").hidden = !canClear;
      q(root, "[data-ledger-clear]").disabled = busy || !auth;
    });
  }
  function current() {
    if (!auth) return false;
    if (sessionStorage.getItem("pfSessionTicket") !== auth.ticket) { stop(); return false; }
    return true;
  }
  function same(e, v) { return e === epoch && v === version && current(); }
  function visible() { return roots.some(root => !root.closest('[aria-hidden="true"]') && root.getClientRects().length); }
  roots.forEach(root => {
    const prefix = root.dataset.ledgerBoard === "mobile" ? "mobile-ledger" : "desktop-ledger";
    root.innerHTML = `
      <header class="ledger-heading"><div><p class="office-kicker">Operations / purchase records</p><h2>Wallet &amp; Transactions</h2></div></header>
      <p class="ledger-intro">This history shows completed purchases made with in-game currency. It doesn’t include real-money payments or spending from a contract budget.</p>
      <div class="ledger-tools"><span data-ledger-count></span><button class="office-button" type="button" data-ledger-action="refresh" disabled>Refresh ledger</button></div>
      <button class="office-button ledger-filter-toggle" type="button" data-ledger-toggle aria-expanded="false" aria-controls="${prefix}-filters">Filter purchases</button>
      <div id="${prefix}-filters" data-ledger-filter-panel>
      <form class="ledger-filters" data-ledger-form>
        <div class="ledger-field"><label for="${prefix}-currency">Currency</label><select id="${prefix}-currency" data-ledger-field="currency"><option value="">All currencies</option></select></div>
        <div class="ledger-field"><label for="${prefix}-from">From date</label><input id="${prefix}-from" type="date" data-ledger-field="from"></div>
        <div class="ledger-field"><label for="${prefix}-to">Through date</label><input id="${prefix}-to" type="date" data-ledger-field="to"></div>
        <div class="ledger-field"><label for="${prefix}-q">Item ID or purchase ID</label><input id="${prefix}-q" type="search" maxlength="100" data-ledger-field="q"></div>
        <button class="office-button office-button-primary" type="submit" data-ledger-apply disabled>Apply filters</button>
        <button class="office-button ledger-clear" type="button" data-ledger-clear hidden>Clear filters</button>
      </form>
      </div>
      <p class="ledger-status" data-ledger-status role="status" aria-live="polite"></p>
      <p class="ledger-pending" data-ledger-pending hidden></p>
      <ul class="ledger-list" data-ledger-list aria-label="Recorded purchases" aria-busy="false"></ul>
      <footer class="ledger-footer" hidden><button class="office-button" type="button" data-ledger-action="more" hidden>Load more</button></footer>`;
    root.addEventListener("input", event => {
      if (!event.target.dataset.ledgerField) return;
      draft[event.target.dataset.ledgerField] = event.target.value;
      roots.forEach(other => { q(other, `[data-ledger-field="${event.target.dataset.ledgerField}"]`).value = event.target.value; });
      paintFilters();
    });
    root.addEventListener("change", event => {
      if (event.target.dataset.ledgerField === "currency") {
        draft.currency = event.target.value;
        roots.forEach(other => { q(other, '[data-ledger-field="currency"]').value = draft.currency; });
        paintFilters();
      }
    });
    root.addEventListener("submit", event => {
      if (!event.target.matches("[data-ledger-form]")) return;
      event.preventDefault();
      if (busy || !current()) return;
      try { applied = filters(); if (mobileFilters.matches) filtersOpen = false; paintFilters(); void load(false, false); }
      catch (error) { message = error.message; kind = "error"; paint(); }
    });
    root.addEventListener("click", event => {
      if (event.target.closest("[data-ledger-toggle]")) { filtersOpen = !filtersOpen; paintFilters(); return; }
      if (event.target.closest("[data-ledger-clear]")) {
        if (busy || !current()) return;
        draft = { currency: "", from: "", to: "", q: "" }; applied = {};
        roots.forEach(other => other.querySelectorAll("[data-ledger-field]").forEach(field => { field.value = ""; }));
        if (mobileFilters.matches) filtersOpen = false;
        paintFilters(); void load(false, false); return;
      }
      const button = event.target.closest("[data-ledger-action]");
      if (!button || button.disabled || busy || !current()) return;
      void load(button.dataset.ledgerAction === "more", button.dataset.ledgerAction === "refresh");
    });
  });
  mobileFilters.addEventListener("change", paintFilters);

  function date(value, end) {
    if (!value) return "";
    if (!/^\d{4}-\d\d-\d\d$/.test(value)) throw new Error("Choose a valid date.");
    const time = new Date(value + "T00:00:00");
    const expected = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, "0")}-${String(time.getDate()).padStart(2, "0")}`;
    if (!Number.isFinite(time.getTime()) || expected !== value) throw new Error("Choose a valid date.");
    if (end) time.setDate(time.getDate() + 1);
    return time.toISOString();
  }
  function filters() {
    if (draft.from && draft.to && draft.from > draft.to) throw new Error("The end date must not precede the start date.");
    const value = {};
    if (draft.currency) value.currency = draft.currency;
    if (draft.from) value.from = date(draft.from, false);
    if (draft.to) value.before = date(draft.to, true);
    if (draft.q.trim()) value.q = draft.q.trim();
    return value;
  }
  function integer(value) { return typeof value === "string" && /^\d{1,30}$/.test(value); }
  function normalize(data) {
    if (data?.ok !== true || String(data.playerId).toUpperCase() !== auth.id.toUpperCase()
      || !Array.isArray(data.transactions) || data.coverage?.type !== "legacy_virtual_currency_purchase"
      || (data.nextCursor !== null && typeof data.nextCursor !== "string")) throw new Error("The backend returned an unexpected ledger. No new history was displayed.");
    data.transactions.forEach(row => {
      if (!row || typeof row.id !== "string" || !/^\d{1,19}$/.test(row.id)
        || typeof row.itemId !== "string" || typeof row.purchaseId !== "string"
        || typeof row.currency !== "string" || !/^[A-Z0-9_-]{1,8}$/.test(row.currency)
        || !integer(row.unitPrice) || !integer(row.quantity) || !integer(row.total)
        || BigInt(row.quantity) < 1n || BigInt(row.unitPrice) * BigInt(row.quantity) !== BigInt(row.total)
        || !Number.isFinite(Date.parse(row.occurredAt)) || row.status !== "recorded_purchase") {
        throw new Error("A purchase record had invalid details. No new history was displayed.");
      }
    });
    return data;
  }
  function format(value) { return new Intl.NumberFormat().format(BigInt(value)); }
  function paint() {
    roots.forEach(root => {
      const status = q(root, "[data-ledger-status]"); status.textContent = message; status.dataset.kind = kind; status.hidden = !message;
      q(root, "[data-ledger-count]").textContent = loaded && rows.length ? `${rows.length} ${rows.length === 1 ? "purchase" : "purchases"} shown` : "";
      q(root, '[data-ledger-action="refresh"]').disabled = !current() || busy;
      q(root, '[data-ledger-action="refresh"]').textContent = busy ? "Loading…" : "Refresh ledger";
      q(root, "[data-ledger-apply]").disabled = !current() || busy;
      root.querySelectorAll("[data-ledger-field]").forEach(input => { input.disabled = !current(); });
      const select = q(root, '[data-ledger-field="currency"]');
      select.replaceChildren(node("option", "", "All currencies")); select.firstChild.value = "";
      [...new Set([...currencies, draft.currency].filter(Boolean))].forEach(code => { const option = node("option", "", code); option.value = code; select.append(option); });
      select.value = draft.currency;
      const pendingNode = q(root, "[data-ledger-pending]");
      pendingNode.hidden = !(pending > 0 || syncWarning);
      pendingNode.textContent = pendingNode.hidden ? "" : "Recent purchases may take a moment to appear. Try refreshing again later.";
      const list = q(root, "[data-ledger-list]"); list.replaceChildren(); list.setAttribute("aria-busy", String(busy));
      if (!rows.length && kind !== "error") list.append(node("li", "ledger-empty", busy ? "Loading purchases…" : loaded
        ? (Object.keys(applied).length ? "No purchases match these filters." : "No purchases to show yet.")
        : "Purchase history is not available yet."));
      rows.forEach(row => {
        const card = node("li", "ledger-row");
        const item = node("div", "ledger-item");
        item.append(node("h3", "", typeof row.itemName === "string" && row.itemName ? row.itemName : row.itemId));
        if (row.itemName) item.append(node("p", "", `Item ID: ${row.itemId}`));
        const when = node("div", "ledger-date");
        const timestamp = new Date(row.occurredAt);
        const time = node("time", "", timestamp.toLocaleString()); time.dateTime = timestamp.toISOString();
        when.append(node("span", "ledger-label", "Purchase date · your local time"), time);
        when.append(node("p", "ledger-reference", `Purchase ID: ${row.purchaseId}`));
        const cost = node("div", "ledger-cost");
        cost.append(node("span", "ledger-label", "Game-currency cost"), node("strong", "", `${format(row.total)} ${row.currency}`));
        cost.append(node("p", "", `Quantity ${format(row.quantity)} · ${format(row.unitPrice)} ${row.currency} each`));
        card.append(item, when, cost); list.append(card);
      });
      const more = q(root, '[data-ledger-action="more"]'); more.hidden = !next; more.disabled = busy || !current();
      more.parentElement.hidden = !next;
    });
    paintFilters();
  }
  function flush(e, v) {
    return new Promise(resolve => {
      let done = false;
      const finish = (value, warning = "") => {
        if (done) return; done = true; clearTimeout(timer);
        if (same(e, v)) { pending = value; syncWarning = warning; }
        resolve();
      };
      const timer = setTimeout(() => finish(null, "Purchase-event synchronization could not be confirmed. Saved ledger records can still be read."), 20000);
      try {
        auth.sdk.ExecuteCloudScript({ FunctionName: "RetryRoadPurchaseEvents", FunctionParameter: {}, RevisionSelection: "Live", GeneratePlayStreamEvent: false }, (result, error) => {
          if (!same(e, v)) return finish(null);
          if (error && ["SessionTicketExpired", "InvalidSessionTicket", "NotAuthenticated"].includes(error.error)) {
            const callback = auth.onExpired; unavailable("Your player login expired. Sign in again."); callback?.("Your player login expired. Sign in again."); return finish(null);
          }
          const value = result?.data?.FunctionResult;
          if (error || result?.data?.Error || !value || !Number.isInteger(value.pending) || value.pending < 0) {
            return finish(null, "Automatic capture/retry is not ready. Publish the ledger CloudScript and rule; historical imports can still be viewed.");
          }
          finish(value.pending);
        });
      } catch (_) { finish(null, "Purchase-event synchronization is unavailable. Existing imported records can still be read."); }
    });
  }
  async function load(more = false, synchronize = false) {
    if (!current() || busy || (more && !next)) return;
    const e = epoch, v = ++version;
    controller?.abort(); controller = new AbortController(); const requestController = controller;
    busy = true; kind = "info"; message = "";
    if (!more) { rows = []; next = null; loaded = false; }
    paint();
    try {
      if (synchronize) await flush(e, v);
      if (!same(e, v)) return;
      const params = new URLSearchParams({ ...applied, limit: "20" });
      if (more) params.set("cursor", next);
      const timer = setTimeout(() => requestController.abort(), 30000);
      let response, data;
      try {
        response = await fetch(`${API}/player/transactions?${params}`, { headers: { Authorization: `Bearer ${auth.ticket}` }, signal: requestController.signal, cache: "no-store" });
        try { data = await response.json(); }
        catch (_) { throw new Error(response.status === 404 ? "The ledger endpoint is unavailable. Deploy the backend update first." : "The backend could not return purchase history. Check its deployment and retry."); }
      } finally { clearTimeout(timer); }
      if (!same(e, v)) return;
      if (response.status === 401 || response.status === 403) {
        const callback = auth.onExpired; unavailable("Your player login expired or could not be verified. Sign in again."); callback?.("Your player login expired. Sign in again."); return;
      }
      if (!response.ok) throw new Error(data?.message || `History request failed (${response.status}).`);
      normalize(data);
      rows = more ? [...new Map([...rows, ...data.transactions].map(row => [row.id, row])).values()] : data.transactions;
      next = data.nextCursor; loaded = true; lastLoaded = Date.now();
      currencies = Array.isArray(data.currencies) ? data.currencies.filter(code => typeof code === "string" && /^[A-Z0-9_-]{1,8}$/.test(code)) : [];
    } catch (error) {
      if (!same(e, v)) return;
      message = "Couldn’t load purchase history. Try Refresh ledger again.";
      kind = "error";
    } finally { if (same(e, v)) { busy = false; controller = null; paint(); } }
  }
  function stop() {
    epoch++; version++; controller?.abort(); controller = null; auth = null;
    rows = []; next = null; currencies = []; lastLoaded = 0; pending = null; syncWarning = "";
    busy = loaded = false; draft = { currency: "", from: "", to: "", q: "" }; applied = {}; filtersOpen = false;
    roots.forEach(root => root.querySelectorAll("[data-ledger-field]").forEach(input => { input.value = ""; }));
    message = "Sign in to view your purchase ledger."; kind = "info"; paint();
  }
  function unavailable(value) { stop(); message = value; kind = "error"; paint(); }
  window.RoadimentaryLedger = Object.freeze({
    init(options) {
      stop();
      if (!options?.sdk || !options.currentId || sessionStorage.getItem("pfSessionTicket") !== options.sessionTicket) return unavailable("Your player session is not ready.");
      auth = { sdk: options.sdk, id: options.currentId, ticket: options.sessionTicket, onExpired: options.onExpired };
      message = ""; paint();
      if (visible()) void load(false, true);
    },
    open() { if (current() && !busy && (!loaded || Date.now() - lastLoaded > 60000)) void load(false, true); },
    stop, unavailable
  });
  document.addEventListener("visibilitychange", () => { if (auth && !current()) stop(); });
  paint();
})();
