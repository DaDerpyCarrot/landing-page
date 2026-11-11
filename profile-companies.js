/* Website-only Companies. The backend is the authority for every role and membership. */
(() => {
  "use strict";
  const API = (["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:3000/api" : "https://roadimentary-admin-dashboard.onrender.com/api") + "/player/companies";
  const TIMEOUT = 18000;
  const AVATARS = new Set(["avatar_roadbuilder", "avatar_maplecrew", "avatar_asphaltace", "avatar_pavepaws",
    "avatar_brickbuddy", "avatar_surveyor", "avatar_forewoman", "avatar_uniform_white_khaki", "avatar_uniform_white_khaki_male"]);
  const controllers = new Set();
  const q = (root, selector) => root.querySelector(selector);
  const id = value => typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value) ? value.toLowerCase() : null;
  const player = value => typeof value === "string" && /^[a-f0-9]{3,64}$/i.test(value) ? value.toUpperCase() : null;
  const label = (value, fallback = "Builder") => typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : fallback;
  const count = value => Number.isInteger(value) && value >= 0 && value <= 2147483647 ? value : null;
  const active = context => Boolean(context && context === auth && context.isCurrent()
    && sessionStorage.getItem("pfSessionTicket") === context.sessionTicket);
  const malformed = () => new Error("The Company service returned an unreadable response. Refresh and try again.");
  const initial = message => ({ directory: null, selected: null, roster: null, file: null, confirm: null,
    draftName: "", draftLookup: "", found: null, busy: "", message, kind: "info", blocked: false });
  let roots = [], auth = null, state = initial("Sign in to use Companies.");
  const overviewRoots = Array.from(document.querySelectorAll("[data-company-overview]"));
  const emptyOverview = () => ({ rows: null, next: null, checkedAt: 0, error: "" });
  let overviewState = emptyOverview(), overviewFlight = null, overviewVersion = 0;
  let inviteFlight = null, inviteVersion = 0, invitesCheckedAt = 0;
  function invalidateInvites() {
    inviteVersion++; inviteFlight = null; invitesCheckedAt = 0;
    window.RoadimentaryNotices?.clear("companies");
  }
  function rememberInvites(result, context) {
    if (new Set(result.rows.map(row => row.id)).size !== result.rows.length) throw malformed();
    ensure(context);
    inviteVersion++; inviteFlight = null; invitesCheckedAt = Date.now();
    window.RoadimentaryNotices?.set("companies", result.rows.length, Boolean(result.next), context.sessionTicket);
  }
  async function checkInvites(force = false) {
    if (!active(auth) || inviteFlight || state.busy || (!force && invitesCheckedAt && Date.now() - invitesCheckedAt < 60000)) return;
    const context = auth, version = inviteVersion, flight = inviteFlight = {};
    try {
      const result = await request(context, "/invites");
      ensure(context);
      if (version !== inviteVersion || inviteFlight !== flight) return;
      rememberInvites(page(result, "invites", raw => inbox(raw, context)), context);
    } catch (error) {
      if (context !== auth || version !== inviteVersion || inviteFlight !== flight) return;
      invalidateInvites();
      if (!active(context) || error.expired) stop("Sign in again to check your invitations.");
    } finally { if (inviteFlight === flight) inviteFlight = null; }
  }

  function overviewVisible() {
    return overviewRoots.some(root => !root.closest('[aria-hidden="true"]') && root.getClientRects().length);
  }
  function invalidateOverview() {
    overviewVersion++;
    overviewFlight = null;
    overviewState = emptyOverview();
  }
  function rememberOverview(result) {
    if (new Set(result.rows.map(row => row.id)).size !== result.rows.length) throw malformed();
    overviewVersion++;
    overviewFlight = null;
    overviewState = { ...result, checkedAt: Date.now(), error: "" };
    renderOverview();
  }
  function renderOverview() {
    const signedIn = active(auth), waiting = Boolean(overviewFlight);
    for (const root of overviewRoots) {
      root.setAttribute("aria-busy", String(waiting));
      const list = q(root, "[data-company-overview-list]");
      list.replaceChildren();
      if (signedIn) for (const item of overviewState.rows?.slice(0, 3) || []) {
        const row = node("li", "overview-company-entry");
        const role = node("span", "overview-company-role" + (item.role === "moderator" ? " is-moderator" : ""), item.role === "moderator" ? "Moderator" : "Member");
        const open = node("button", "paper-link", "Open Company →");
        open.type = "button";
        open.dataset.overviewCompanies = item.id;
        open.setAttribute("aria-label", "Open " + item.name);
        row.append(node("h3", "", item.name), role, open);
        list.append(row);
      }
      const note = q(root, "[data-company-overview-note]");
      note.dataset.kind = overviewState.error ? "error" : "info";
      note.textContent = !signedIn ? "Sign in to check your Companies."
        : overviewState.error || (waiting && !overviewState.rows ? "Checking your Companies…"
        : !overviewState.rows ? "Open the Company Desk to check your memberships."
        : !overviewState.rows.length ? "No Company yet. Start your own or accept an invitation at the Company Desk."
        : overviewState.rows.length > 3 || overviewState.next ? "See all your Companies at the Company Desk." : "");
      note.hidden = !note.textContent;
      const refresh = q(root, "[data-company-overview-refresh]");
      refresh.disabled = !signedIn || waiting || Boolean(state.busy);
      refresh.textContent = waiting ? "Checking…" : "Refresh";
      root.querySelectorAll("[data-overview-companies]").forEach(button => {
        button.disabled = !signedIn || Boolean(state.busy);
      });
    }
  }
  async function overview(force = false) {
    if (!active(auth)) { if (auth) stop(); else renderOverview(); return; }
    if (overviewFlight || state.busy || (!force && overviewState.checkedAt && Date.now() - overviewState.checkedAt < 60000)) return;
    const context = auth, version = overviewVersion;
    const flight = overviewFlight = {};
    overviewState.error = "";
    renderOverview();
    try {
      const result = await request(context, "");
      ensure(context);
      if (version !== overviewVersion || overviewFlight !== flight) return;
      rememberOverview(page(result, "companies", raw => company(raw, context)));
    } catch (error) {
      if (context !== auth || version !== overviewVersion || overviewFlight !== flight) return;
      if (!active(context) || error.expired) { stop("Sign in again to check your Companies."); return; }
      overviewState = { ...emptyOverview(), error: "Couldn’t load your Companies. Try Refresh or open the Company Desk." };
    } finally {
      if (overviewFlight === flight) overviewFlight = null;
      renderOverview();
    }
  }
  overviewRoots.forEach(root => q(root, "[data-company-overview-refresh]")?.addEventListener("click", () => { void overview(true); }));

  function ensure(context) {
    if (!active(context)) throw Object.assign(new Error("Player session changed."), { stale: true });
  }
  function node(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  }
  function action(text, code, key = "", style = "") {
    const button = node("button", "office-button" + (style ? " office-button-" + style : ""), text);
    button.type = "button";
    button.dataset.companyAction = code;
    button.dataset.companyKey = key;
    button.disabled = !active(auth) || Boolean(state.busy);
    return button;
  }
  const readyToWrite = () => active(auth) && !state.busy && !state.blocked;
  function writeButton(text, code, key = "", style = "") {
    const button = action(text, code, key, style);
    button.disabled = !readyToWrite();
    return button;
  }
  function badge(role) { return node("span", "company-role" + (role === "moderator" ? " is-moderator" : ""), role === "moderator" ? "Moderator" : "Member"); }
  function paper(title, className = "") {
    const el = node("section", "office-paper company-paper " + className);
    el.append(node("h3", "", title));
    return el;
  }
  function heading(title) {
    const el = node("h3", "company-page-title", title);
    el.tabIndex = -1;
    return el;
  }
  function hint(text) { return node("p", "company-hint", text); }
  function empty(text) { return node("p", "company-empty", text); }
  function row(title, subtitle) {
    const el = node("article", "company-row");
    const copy = node("div", "company-row-copy");
    copy.append(node("h4", "", title));
    if (subtitle) copy.append(hint(subtitle));
    el.append(copy);
    return { el, copy, buttons: node("div", "company-actions") };
  }
  function form(root, type, caption, placeholder, value, buttonText, maxLength) {
    const el = node("form", "company-form");
    el.dataset.companyForm = type;
    const fieldId = "company-" + type + "-" + root.dataset.companyBoard;
    const fieldLabel = node("label", "", caption);
    fieldLabel.htmlFor = fieldId;
    const input = node("input", "crew-input");
    input.id = fieldId;
    input.dataset.companyInput = type;
    input.type = "text";
    input.maxLength = maxLength;
    input.placeholder = placeholder;
    input.value = value;
    input.required = true;
    input.autocomplete = "off";
    input.disabled = !readyToWrite();
    const submit = node("button", "office-button office-button-primary", buttonText);
    submit.type = "submit";
    submit.disabled = !readyToWrite();
    el.append(fieldLabel, input, submit);
    return el;
  }
  function expiry(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? "Expires " + date.toLocaleDateString() : "";
  }

  async function request(context, path, method = "GET", data, operation) {
    ensure(context);
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    if (method !== "GET") { operation.sent = true; invalidateOverview(); invalidateInvites(); }
    try {
      let response, result;
      try {
        response = await fetch(API + path, {
          method, signal: controller.signal, cache: "no-store", redirect: "error", credentials: "omit",
          headers: { Authorization: "Bearer " + context.sessionTicket,
            ...(data === undefined ? {} : { "Content-Type": "application/json" }) },
          ...(data === undefined ? {} : { body: JSON.stringify(data) })
        });
        ensure(context);
        if (response.status === 401) throw Object.assign(new Error("Sign in again to use Companies."), { expired: true });
        result = await response.json();
      } catch (error) {
        ensure(context);
        if (error.expired) throw error;
        throw Object.assign(new Error(controller.signal.aborted
          ? "The Company service took too long. Please refresh and try again."
          : "Could not read the Company service response. Please refresh and try again."), { uncertain: true });
      }
      ensure(context);
      if (!response.ok || result?.ok !== true) {
        throw Object.assign(new Error(label(result?.message, "The Company request could not be completed.")),
          { status: response.status, uncertain: response.ok || response.status >= 500 });
      }
      if (method !== "GET") operation.saved = true;
      return result;
    } finally { clearTimeout(timer); controllers.delete(controller); }
  }
  function company(raw, context) {
    const companyId = id(raw?.id), moderator = player(raw?.moderatorId);
    const role = moderator === context.currentId ? "moderator" : "member";
    if (!companyId || !moderator || raw.role !== role || !label(raw.name, "")) throw malformed();
    return { id: companyId, role, moderator, name: label(raw.name), moderatorName: label(raw.moderatorDisplayName) };
  }
  function invite(raw) {
    const inviteId = id(raw?.id), companyId = id(raw?.companyId), playerId = player(raw?.playerId);
    if (!inviteId || !companyId || !playerId) throw malformed();
    return { id: inviteId, companyId, playerId, name: label(raw.displayName),
      companyName: label(raw.companyName, "Company"), moderatorName: label(raw.moderatorDisplayName), expiresAt: raw.expiresAt };
  }
  function page(result, field, parse) {
    const next = result.nextCursor === null ? null : id(result.nextCursor);
    if (!Array.isArray(result[field]) || result[field].length > 30 || (result.nextCursor !== null && !next)) throw malformed();
    return { rows: result[field].map(parse), next };
  }
  function inbox(raw, context) {
    const row = invite(raw);
    if (row.playerId !== context.currentId) throw malformed();
    return row;
  }
  async function directory(context) {
    state.directory = null;
    invalidateInvites();
    const [list, invites] = await Promise.all([request(context, ""), request(context, "/invites")]);
    ensure(context);
    state.directory = {
      companies: page(list, "companies", raw => company(raw, context)),
      invites: page(invites, "invites", raw => inbox(raw, context))
    };
    rememberOverview(state.directory.companies);
    rememberInvites(state.directory.invites, context);
    state.blocked = false;
  }
  async function roster(context) {
    const selected = state.selected;
    state.roster = state.file = state.confirm = state.found = null;
    const result = await request(context, "/" + selected);
    ensure(context);
    const summary = company(result.company, context);
    if (summary.id !== selected || !Array.isArray(result.members) || result.members.length > 50) throw malformed();
    const members = result.members.map(raw => {
      const playerId = player(raw?.playerId);
      const role = playerId === summary.moderator ? "moderator" : "member";
      if (!playerId || raw.role !== role) throw malformed();
      return { id: playerId, role, name: label(raw.displayName) };
    });
    const unique = new Set(members.map(row => row.id));
    if (unique.size !== members.length || !unique.has(context.currentId) || !unique.has(summary.moderator)) throw malformed();
    let pending = [];
    if (summary.role === "moderator") {
      if (!Array.isArray(result.pendingInvites) || result.pendingInvites.length > 50) throw malformed();
      pending = result.pendingInvites.map(invite);
      if (pending.some(row => row.companyId !== selected)) throw malformed();
    }
    state.roster = { company: summary, members, pending };
    state.blocked = false;
  }
  function resetView(selected = null) {
    state.selected = selected;
    state.roster = state.file = state.found = state.confirm = null;
    state.draftLookup = "";
  }
  function open(companyId) {
    if (!active(auth)) { if (auth) stop(); else render(); return; }
    if (state.busy) return;
    if (companyId !== undefined) {
      const selected = companyId === null ? null : id(companyId);
      if (companyId !== null && !selected) return;
      resetView(selected);
    }
    const root = roots.find(root => !root.hidden && root.getClientRects().length);
    void run("Opening Company records…", context => state.selected ? roster(context) : directory(context), root, ".company-page-title");
  }
  function focusAt(root, selector) {
    const target = root && !root.hidden && root.getClientRects().length ? q(root, selector) : null;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
  async function run(progress, work, root, focus) {
    if (!active(auth)) { stop(); return; }
    if (state.busy) return;
    const context = auth;
    const operation = { sent: false, saved: false };
    state.busy = progress; state.message = ""; state.kind = "info";
    render();
    try { await work(context, operation); }
    catch (error) {
      if (context !== auth) return;
      if (!active(context) || error.expired) {
        stop(error.expired ? "Your player session expired. Sign in again to use Companies." : "Your player session changed. Sign in again.");
        return;
      }
      state.kind = "error";
      if (operation.sent && (operation.saved || error.uncertain)) {
        state.blocked = true;
        state.roster = state.file = state.found = state.confirm = null;
        state.directory = null;
        state.message = operation.saved
          ? "The change was saved, but the board could not reload. Refresh Companies before making another change."
          : "The result was not confirmed. Refresh Companies and check the roster or invites before trying again.";
      } else {
        state.message = label(error.message, "The Company request failed.");
        if ([403, 404].includes(error.status) && state.selected) {
          state.roster = state.file = state.found = state.confirm = null;
        }
      }
    } finally {
      if (context === auth && !active(context)) stop("Your player session changed. Sign in again.");
      else if (active(context)) {
        state.busy = "";
        render();
        if (operation.sent && !invitesCheckedAt) void checkInvites(true);
        if (focus) focusAt(root, focus);
      }
    }
  }
  function done(message) { state.message = message; state.kind = "success"; }

  function renderDirectory(root, target) {
    target.append(heading("Your Companies"));
    const columns = node("div", "company-columns");
    const main = node("div", "company-stack");
    const list = paper("Company files");
    const inboxPanel = paper("Received invitations");
    const setup = paper("Start a Company", "company-setup");
    setup.append(hint("Any signed-in builder can create a Company. You'll be its Moderator and can invite other builders."));
    setup.append(form(root, "create", "Company name", "e.g. Pave Paws Roadworks", state.draftName, "Create Company", 60));
    const data = state.directory;
    if (!data) {
      list.append(empty(state.busy ? "Loading your Company files…" : "Refresh Companies to load your files."));
      inboxPanel.append(hint("Invites will appear here when loaded."));
    } else {
      if (!data.companies.rows.length) list.append(empty("No Companies yet. Start one or accept an invitation below."));
      for (const item of data.companies.rows) {
        const line = row(item.name, "Moderated by " + item.moderatorName);
        line.copy.append(badge(item.role));
        line.buttons.append(action("Open roster", "roster", item.id, "primary"));
        line.el.append(line.buttons); list.append(line.el);
      }
      if (data.companies.next) list.append(action("Load more Companies", "more", "companies"));
      if (!data.invites.rows.length) inboxPanel.append(empty("No pending Company invitations."));
      for (const item of data.invites.rows) {
        const line = row(item.companyName, "Invited by " + item.moderatorName);
        line.copy.append(hint(expiry(item.expiresAt)), hint("Joining lets this Company's Moderator open your public operator file: avatar, bio, level, XP, and recorded job counts."));
        line.buttons.append(writeButton("Accept invite", "accept", item.id, "primary"),
          writeButton("Decline", "decline", item.id));
        line.el.append(line.buttons); inboxPanel.append(line.el);
      }
      if (data.invites.next) inboxPanel.append(action("Load more invitations", "more", "invites"));
    }
    main.append(list, inboxPanel); columns.append(main, setup); target.append(columns);
  }
  function confirmation(message, code, key) {
    const box = node("div", "company-confirm");
    const controls = node("div", "company-actions");
    controls.append(writeButton(code === "leave" ? "Confirm leave" : "Confirm removal", code, key, "danger"),
      action("Keep membership", "cancel-confirm"));
    box.append(hint(message), controls);
    return box;
  }
  function renderFile(summary, target) {
    const file = paper("Public operator file", "company-file");
    const head = node("div", "crew-file-heading");
    const title = node("h3", "company-file-title", summary.name);
    title.tabIndex = -1;
    head.append(title, action("Close file", "close-file"));
    file.replaceChildren(head);
    const body = node("div", "crew-file-body");
    const img = node("img", "crew-avatar crew-file-avatar");
    img.alt = ""; img.src = "assets/crew-avatars/" + summary.avatar + ".png";
    img.addEventListener("error", () => { img.hidden = true; }, { once: true });
    const copy = node("div", "crew-file-copy");
    const stats = node("dl", "crew-public-stats");
    const level = window.RoadimentaryStats?.levelFor(summary.xp)?.level;
    for (const [name, value] of [["Operator level", level ?? null], ["Total XP", summary.xp],
      ["Jobs completed", summary.completed], ["Jobs attempted", summary.attempted]]) {
      const item = node("div");
      item.append(node("dt", "", name), node("dd", "", value === null ? "—" : value.toLocaleString()));
      stats.append(item);
    }
    copy.append(node("p", "crew-full-bio", summary.bio || "This builder hasn't shared a public bio yet."),
      stats, hint("Public game summaries may lag behind. A dash means the value isn't available; individual contract runs aren't shown."));
    body.append(img, copy); file.append(body); target.append(file);
  }
  function renderRoster(root, target) {
    target.append(action("← All Companies", "back"));
    const data = state.roster;
    if (!data) {
      target.append(heading("Company roster"), empty(state.busy ? "Opening the Company roster…" : "Refresh Companies to load this roster, or go back to your Company files."));
      return;
    }
    const bar = node("div", "company-title-bar");
    bar.append(heading(data.company.name), badge(data.company.role));
    target.append(bar);
    const columns = node("div", "company-columns");
    const list = paper("Company roster");
    list.append(hint(data.members.length + (data.members.length === 1 ? " builder" : " builders") + " · Private roster"));
    const moderator = data.company.role === "moderator";
    for (const member of data.members) {
      const line = row(member.name);
      line.copy.append(badge(member.role));
      if (moderator && member.role === "member") {
        line.buttons.append(action("View public file", "file", member.id),
          writeButton("Remove member", "ask-remove", member.id));
        line.el.append(line.buttons);
        if (state.confirm?.key === member.id) line.el.append(confirmation("Remove " + member.name + " from this Company?", "remove", member.id));
      }
      list.append(line.el);
    }
    if (moderator && data.members.length === 1) list.append(empty("No members yet. Invite a builder to start your roster."));
    const side = node("div", "company-stack");
    if (moderator) {
      const recruit = paper("Recruit a Builder");
      recruit.append(hint("Search by exact in-game display name or username. You don't need to be friends."),
        form(root, "lookup", "Player name", "e.g. RoadBuilder", state.draftLookup, "Find builder", 100));
      const found = node("div", "company-found");
      found.dataset.companyFound = "";
      if (state.found) found.append(node("p", "", state.found.name), writeButton("Send Company invite", "invite", state.found.id, "primary"));
      recruit.append(found);
      const pending = paper("Pending invites");
      if (!data.pending.length) pending.append(empty("No pending invites."));
      for (const item of data.pending) {
        const line = row(item.name, expiry(item.expiresAt));
        line.buttons.append(writeButton("Revoke invite", "revoke", item.id));
        line.el.append(line.buttons); pending.append(line.el);
      }
      side.append(recruit, pending);
    } else {
      const membership = paper("Membership");
      membership.append(hint("The Moderator can open your standard public operator file through this roster."));
      membership.append(state.confirm?.key === "leave"
        ? confirmation("Leave this Company? You'll need another invite to rejoin.", "leave", "leave")
        : writeButton("Leave Company", "ask-leave"));
      side.append(membership);
    }
    const rosterStack = node("div", "company-stack");
    if (state.file) renderFile(state.file, rosterStack);
    rosterStack.append(list);
    columns.append(rosterStack, side); target.append(columns);
  }
  function render() {
    renderOverview();
    roots.forEach(root => {
      const status = q(root, "[data-company-status]");
      status.textContent = state.busy || state.message;
      status.dataset.kind = state.busy ? "info" : state.kind;
      q(root, "[data-company-refresh]").disabled = !active(auth) || Boolean(state.busy);
      const target = q(root, "[data-company-content]");
      target.setAttribute("aria-busy", String(Boolean(state.busy)));
      target.replaceChildren();
      if (!active(auth)) return;
      if (state.selected) renderRoster(root, target);
      else renderDirectory(root, target);
    });
  }

  function submit(event, root) {
    const type = event.target.dataset.companyForm;
    if (!type) return;
    event.preventDefault();
    if (!readyToWrite()) return;
    if (type === "create" && !state.selected) {
      const name = state.draftName.normalize("NFC").trim();
      if (Array.from(name).length < 3 || Array.from(name).length > 60 || /[<>]/.test(name)) {
        state.message = "Enter a Company name of 3–60 characters, without angle brackets.";
        state.kind = "error"; render(); focusAt(root, "[data-company-input='create']"); return;
      }
      void run("Creating your Company…", async (context, operation) => {
        const created = company((await request(context, "", "POST", { name }, operation)).company, context);
        ensure(context);
        if (created.role !== "moderator") throw malformed();
        state.draftName = ""; state.directory = null; resetView(created.id);
        await roster(context); done("Company created. Invite builders to fill your roster.");
      }, root, ".company-page-title");
    } else if (type === "lookup" && state.roster?.company.role === "moderator") {
      const name = state.draftLookup.trim();
      state.found = null;
      if (!name || name.length > 100 || name.includes("@")) {
        state.message = "Enter an exact display name or username, not an email address.";
        state.kind = "error"; render(); focusAt(root, "[data-company-input='lookup']"); return;
      }
      void run("Looking up this builder…", async context => {
        let result;
        try { result = await context.findBuilder(name); }
        catch (error) {
          if (error.code === "AccountNotFound") throw new Error("No builder found. Check the exact display name or username.");
          throw error;
        }
        ensure(context);
        const foundId = player(result?.id);
        if (!foundId) throw malformed();
        if (state.roster.members.some(row => row.id === foundId)) throw new Error("That builder is already in this Company.");
        if (state.roster.pending.some(row => row.playerId === foundId)) throw new Error("That builder already has a pending invite.");
        state.found = { id: foundId, name: label(result.displayName) };
        done("Builder found. Check the name before sending an invite.");
      }, root, "[data-company-action='invite']");
    }
  }
  function click(event, root) {
    const button = event.target.closest("button[data-company-action]");
    if (!button || button.disabled || !active(auth) || state.busy) return;
    const { companyAction: code, companyKey: key } = button.dataset;
    const selected = state.selected;
    const record = state.roster;
    const member = record?.members.find(row => row.id === key && row.role === "member");
    const moderator = record?.company.role === "moderator";
    if (code === "refresh") { open(); return; }
    if (code === "back") {
      resetView(); void run("Opening your Company files…", directory, root, ".company-page-title"); return;
    }
    if (code === "roster" && state.directory?.companies.rows.some(row => row.id === key)) {
      resetView(key); void run("Opening the Company roster…", roster, root, ".company-page-title"); return;
    }
    if (code === "more" && ["companies", "invites"].includes(key) && state.directory?.[key].next) {
      const existing = state.directory[key];
      void run("Loading more records…", async context => {
        const result = await request(context, (key === "invites" ? "/invites" : "") + "?after=" + encodeURIComponent(existing.next));
        const next = page(result, key, raw => key === "invites" ? inbox(raw, context) : company(raw, context));
        if (next.next === existing.next) throw malformed();
        ensure(context);
        state.directory[key] = { rows: [...new Map([...existing.rows, ...next.rows].map(row => [row.id, row])).values()], next: next.next };
        if (key === "invites") rememberInvites(state.directory.invites, context);
      }, root, ".company-page-title"); return;
    }
    if (code === "close-file") {
      const previous = state.file?.id;
      state.file = null; render();
      if (previous) focusAt(root, "[data-company-action='file'][data-company-key='" + previous + "']");
      return;
    }
    if (code === "file" && moderator && member) {
      state.file = null; state.confirm = null;
      void run("Opening the public operator file…", async context => {
        const response = await request(context, "/" + selected + "/members/" + member.id + "/summary");
        const data = response.member;
        if (player(data?.playerId) !== member.id) throw malformed();
        ensure(context);
        state.file = { id: member.id, name: label(data.displayName, member.name),
          avatar: AVATARS.has(data.avatar) ? data.avatar : "avatar_roadbuilder",
          bio: typeof data.bio === "string" ? data.bio.slice(0, 1000) : "",
          xp: count(data.xp), completed: count(data.completed), attempted: count(data.attempted) };
      }, root, ".company-file-title"); return;
    }
    if (code === "cancel-confirm") {
      const previous = state.confirm?.key;
      state.confirm = null; render();
      focusAt(root, previous === "leave" ? "[data-company-action='ask-leave']" :
        "[data-company-action='ask-remove'][data-company-key='" + previous + "']");
      return;
    }
    if (!readyToWrite()) return;
    if ((code === "ask-remove" && moderator && member) || (code === "ask-leave" && record?.company.role === "member")) {
      state.confirm = { key: code === "ask-leave" ? "leave" : member.id };
      render(); focusAt(root, ".company-confirm [data-company-action]"); return;
    }
    const inboxItem = state.directory?.invites.rows.find(row => row.id === key);
    if (["accept", "decline"].includes(code) && inboxItem && !selected) {
      void run(code === "accept" ? "Joining Company…" : "Declining invitation…", async (context, operation) => {
        const result = await request(context, "/invites/" + key + "/respond", "POST", { decision: code }, operation);
        ensure(context);
        if (id(result.companyId) !== inboxItem.companyId || result.decision !== code) throw malformed();
        state.directory = null;
        if (code === "accept") { resetView(inboxItem.companyId); await roster(context); }
        else await directory(context);
        done(code === "accept" ? "You joined the Company." : "Invitation declined.");
      }, root, ".company-page-title"); return;
    }
    if (code === "invite" && moderator && state.found?.id === key) {
      void run("Sending Company invite…", async (context, operation) => {
        const sent = invite((await request(context, "/" + selected + "/invites", "POST", { playerId: key }, operation)).invite);
        ensure(context);
        if (sent.companyId !== selected || sent.playerId !== key) throw malformed();
        state.draftLookup = ""; await roster(context); done("Company invite sent to " + sent.name + ".");
      }, root, ".company-page-title"); return;
    }
    let path, message;
    if (code === "revoke" && moderator && record.pending.some(row => row.id === key)) {
      path = "/" + selected + "/invites/" + key; message = "Invitation revoked.";
    } else if (code === "remove" && moderator && member && state.confirm?.key === key) {
      path = "/" + selected + "/members/" + key; message = "Member removed.";
    } else if (code === "leave" && record?.company.role === "member" && state.confirm?.key === "leave") {
      path = "/" + selected + "/membership"; message = "You left the Company.";
    }
    if (!path) return;
    void run("Updating membership records…", async (context, operation) => {
      await request(context, path, "DELETE", undefined, operation);
      ensure(context);
      state.directory = null; state.confirm = null;
      if (code === "leave") { resetView(); await directory(context); }
      else await roster(context);
      done(message);
    }, root, ".company-page-title");
  }

  function mount() {
    if (roots.length) return;
    roots = Array.from(document.querySelectorAll("[data-company-board]"));
    roots.forEach(root => {
      root.dataset.companyBoard = root.closest("[data-crew-board]")?.dataset.crewBoard || "board";
      // Fixed UI only; all player/API text is added through textContent.
      root.innerHTML = '<header class="company-desk"><div><p class="office-kicker">Roadimentary / group operations</p><h2>Company Desk</h2><p class="company-hint">Private rosters for builders. Website only.</p></div><button class="office-button" type="button" data-company-refresh data-company-action="refresh">Refresh Companies</button></header><p class="crew-notice company-notice" data-company-status role="status"></p><div class="company-content" data-company-content></div>';
      root.addEventListener("click", event => click(event, root));
      root.addEventListener("submit", event => submit(event, root));
      root.addEventListener("input", event => {
        const type = event.target.dataset.companyInput;
        if (!["create", "lookup"].includes(type) || !readyToWrite()) return;
        if (type === "create") state.draftName = event.target.value;
        else { state.draftLookup = event.target.value; state.found = null; }
        roots.forEach(other => {
          const input = q(other, "[data-company-input='" + type + "']");
          if (input && input !== event.target) input.value = event.target.value;
          if (type === "lookup") q(other, "[data-company-found]")?.replaceChildren();
        });
      });
    });
    render();
  }
  function stop(message = "Sign in to use Companies.") {
    auth = null;
    invalidateOverview();
    invalidateInvites();
    for (const controller of controllers) controller.abort();
    controllers.clear();
    state = initial(message);
    render();
  }
  window.addEventListener("storage", event => {
    if ((event.key === "pfSessionTicket" || event.key === null) && auth && !active(auth)) stop();
  });
  window.addEventListener("pageshow", () => { if (auth && !active(auth)) stop(); });
  document.addEventListener("visibilitychange", () => { if (auth && !active(auth)) stop(); });
  window.RoadimentaryCompanies = Object.freeze({
    mount, open, stop, overview, checkInvites,
    init(options) {
      stop();
      const currentId = player(options?.currentId);
      if (!currentId || typeof options.isCurrent !== "function" || !options.isCurrent()
        || typeof options.findBuilder !== "function" || !options.sessionTicket) return;
      auth = { ...options, currentId };
      state.message = "";
      render();
      void checkInvites();
      if (overviewVisible()) void overview();
    }
  });
  renderOverview();
})();
