/* Crew uses the same live Classic CloudScript handlers as the Unity game.
   No title secret, admin JWT, direct AddFriend call, or private player data. */
(() => {
  "use strict";

  const roots = Array.from(document.querySelectorAll("[data-crew-board]"));
  if (!roots.length) return;

  const PUBLIC_KEYS = ["ProfileAvatar", "ProfileAboutMe", "ProfileTotalXP", "ProfileJobsCompleted", "ProfileJobsAttempted"];
  const AVATARS = new Set(["avatar_roadbuilder", "avatar_maplecrew", "avatar_asphaltace", "avatar_pavepaws", "avatar_brickbuddy", "avatar_surveyor", "avatar_forewoman", "avatar_uniform_white_khaki", "avatar_uniform_white_khaki_male"]);
  const CACHE_MS = 30000;
  const API_TIMEOUT_MS = 20000;
  const groups = { friends: "Friends", incoming: "Received", outgoing: "Sent" };
  const emptyHub = () => ({ friends: [], incoming: [], outgoing: [] });
  let epoch = 0;
  let auth = null;
  let hub = emptyHub();
  let hasHub = false;
  let loading = false;
  let syncError = "";
  let notice = "Verifying your player session…";
  let noticeKind = "info";
  let lastSync = 0;
  let view = "friends";
  let filter = "";
  let query = "";
  let searchedQuery = "";
  let searchResult = null;
  let searchBusy = false;
  let searchMessage = "";
  let searchVersion = 0;
  let selectedId = "";
  let confirmRemoveId = "";
  let busy = false;
  let writesBlocked = false;
  let refreshPromise = null;
  const profiles = new Map();
  const profileRequests = new Map();

  const validId = id => typeof id === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(id);
  const sameSession = version => version === epoch && auth && sessionStorage.getItem("pfSessionTicket") === auth.sessionTicket;
  const canWrite = () => Boolean(sameSession(epoch) && hasHub && !loading && !busy && !writesBlocked && !syncError);
  const q = (root, selector) => root.querySelector(selector);
  const text = (root, selector, value) => { const node = q(root, selector); if (node) node.textContent = value; };

  // This template contains only fixed interface text and an internal mobile/desktop prefix.
  // All names, bios, and service messages below are inserted with textContent.
  roots.forEach(root => {
    const prefix = root.dataset.crewBoard === "mobile" ? "mobile-crew" : "desktop-crew";
    root.innerHTML = `
      <header class="crew-board-heading">
        <div><p class="office-kicker">Roadimentary / operator contacts</p><h2>Your Crew Board</h2><p class="crew-board-intro">Same builders. Same crew. In game and on the web.</p></div>
        <div class="crew-sync-tools"><span class="crew-sync-badge" data-crew-sync>Checking session</span><button class="office-button" type="button" data-crew-action="refresh" disabled>Refresh board</button></div>
      </header>
      <p class="crew-notice" data-crew-notice role="status" aria-live="polite"></p>
      <section class="crew-chat office-paper" data-crew-chat hidden aria-labelledby="${prefix}-chat-title"></section>
      <div class="crew-workspace">
        <section class="crew-directory" aria-labelledby="${prefix}-directory-title">
          <div class="crew-list-switch" role="group" aria-label="Crew lists">
            <button type="button" data-crew-view="friends" aria-pressed="true">Friends <span data-crew-count="friends">—</span></button>
            <button type="button" data-crew-view="incoming" aria-pressed="false">Received <span data-crew-count="incoming">—</span></button>
            <button type="button" data-crew-view="outgoing" aria-pressed="false">Sent <span data-crew-count="outgoing">—</span></button>
          </div>
          <div class="crew-directory-heading"><h3 id="${prefix}-directory-title" data-crew-list-title tabindex="-1">Friends</h3><span data-crew-list-summary></span></div>
          <label class="crew-filter-label" for="${prefix}-filter">Filter this list</label>
          <input class="crew-input" id="${prefix}-filter" type="search" maxlength="100" placeholder="Type a builder's name…" data-crew-filter autocomplete="off" disabled>
          <div class="crew-contact-grid" data-crew-list aria-busy="false"></div>
          <p class="crew-sync-caption" data-crew-updated>Friendships require an accepted request.</p>
        </section>
        <aside class="crew-finder office-paper" aria-labelledby="${prefix}-find-title">
          <p class="office-kicker">Recruitment desk</p><h3 id="${prefix}-find-title">Find a Builder</h3>
          <p class="crew-search-help" id="${prefix}-search-help">Enter their exact in-game display name or account username. Email lookup is not used.</p>
          <form data-crew-search-form>
            <label for="${prefix}-search">Player name</label>
            <input class="crew-input" id="${prefix}-search" type="search" maxlength="100" placeholder="e.g. RoadBuilder" data-crew-search autocomplete="off" aria-describedby="${prefix}-search-help" disabled>
            <button class="office-button office-button-primary" type="submit" data-crew-search-button disabled>Search player</button>
          </form>
          <p class="crew-search-status" data-crew-search-status role="status" aria-live="polite"></p>
          <div data-crew-search-result></div>
          <p class="crew-presence-help">“In game” means the game recently sent a presence update. This page does not change your in-game presence.</p>
        </aside>
      </div>
      <section class="crew-public-file office-paper" data-crew-detail hidden aria-labelledby="${prefix}-file-title"></section>`;

    root.addEventListener("submit", event => {
      if (!event.target.matches("[data-crew-search-form]")) return;
      event.preventDefault();
      searchPlayer();
    });
    root.addEventListener("input", event => {
      if (event.target.matches("[data-crew-filter]")) {
        filter = event.target.value;
        roots.forEach(other => { q(other, "[data-crew-filter]").value = filter; });
        renderLists();
        hydrateVisibleProfiles();
      }
      if (event.target.matches("[data-crew-search]")) {
        query = event.target.value;
        roots.forEach(other => { q(other, "[data-crew-search]").value = query; });
      }
    });
    root.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button || !root.contains(button) || button.disabled) return;
      if (button.dataset.crewView && groups[button.dataset.crewView]) {
        view = button.dataset.crewView;
        confirmRemoveId = "";
        render();
        hydrateVisibleProfiles();
        return;
      }
      const action = button.dataset.crewAction;
      const id = button.dataset.crewId;
      if (action === "refresh") { if (!busy) refreshHub({ manual: true }); }
      else if (action === "view") showPublicFile(id, root);
      else if (action === "message" && canWrite() && relation(id) === "friends") window.RoadimentaryMessages?.open(id, root);
      else if (action === "close-file") { selectedId = ""; renderDetails(); q(root, "[data-crew-list-title]")?.focus({ preventScroll: true }); }
      else if (action === "remove") { confirmRemoveId = id; render(); }
      else if (action === "keep") { confirmRemoveId = ""; render(); }
      else if (["send", "accept", "decline", "cancel", "confirm-remove"].includes(action)) performAction(action, id, root);
    });
  });

  function api(method, parameters, version = epoch) {
    return new Promise((resolve, reject) => {
      if (!sameSession(version)) { reject(Object.assign(new Error("Session changed."), { stale: true })); return; }
      let finished = false;
      const settle = (error, value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (!sameSession(version)) reject(Object.assign(new Error("Session changed."), { stale: true }));
        else if (error) reject(error);
        else resolve(value);
      };
      const timer = setTimeout(() => settle(Object.assign(new Error("PlayFab took too long to respond. Try refreshing the board."), { timedOut: true })), API_TIMEOUT_MS);
      try {
        if (typeof auth.sdk[method] !== "function") throw new Error("The PlayFab client is missing a required method. Refresh the page.");
        auth.sdk[method](parameters, (result, error) => {
          if (error) {
            const code = error.error || "";
            const expired = ["InvalidSessionTicket", "SessionTicketExpired", "NotAuthenticated"].includes(code);
            settle(Object.assign(new Error(expired ? "Your session expired. Sign in again from the landing page." : "PlayFab could not complete the request. Try again."), { code, expired }));
          } else if (!result?.data || typeof result.data !== "object") {
            settle(new Error("PlayFab returned an unreadable response. Refresh the board."));
          } else settle(null, result.data);
        });
      } catch (error) { settle(error); }
    });
  }

  async function cloud(functionName, parameters = {}, version = epoch) {
    const response = await api("ExecuteCloudScript", {
      FunctionName: functionName,
      FunctionParameter: parameters,
      RevisionSelection: "Live",
      GeneratePlayStreamEvent: false
    }, version);
    if (response.Error) {
      const missing = response.Error.Error === "CloudScriptNotFound" || /not found|not defined|not a function/i.test(response.Error.Message || "");
      if (["GetWorkerMessages", "SendWorkerMessage"].includes(functionName)) {
        const message = response.Error.Message || "";
        const rules = [
          ["NOT_FRIENDS", /MESSAGING_NOT_FRIENDS|Messaging requires confirmed friendship/i, "This friendship is no longer confirmed. Messaging is unavailable."],
          ["RATE_LIMIT", /MESSAGING_RATE_LIMIT/i, "Please wait a little before sending again (at least 2 seconds between sends, up to 12 per minute)."],
          ["REQUEST_CONFLICT", /MESSAGING_REQUEST_CONFLICT/i, "This send reference conflicts with an existing message. Do not resend it as a new message."],
          ["INVALID_MESSAGE", /MESSAGING_INVALID_MESSAGE|Invalid message request|Messages must contain/i, "Messages must contain 1–300 characters and a valid send reference."]
        ];
        const rule = rules.find(item => item[1].test(message));
        throw Object.assign(new Error(missing ? "Messaging is not available in Live CloudScript. Publish the messaging handlers, then retry."
          : rule ? rule[2] : "The game could not confirm this messaging request. Refresh or retry the same send."), { code: missing ? "NOT_PUBLISHED" : rule ? rule[0] : "MESSAGING_ERROR" });
      }
      throw new Error(missing
        ? "The game's friends functions are not available in the live PlayFab CloudScript. Publish the existing WorkerProfile handlers, then refresh."
        : "The friends service could not confirm this request. Refresh the board before trying again.");
    }
    let value = response.FunctionResult;
    if (typeof value === "string") { try { value = JSON.parse(value); } catch (_) { value = null; } }
    if (!value || typeof value !== "object" || Array.isArray(value) || response.FunctionResultTooLarge) {
      throw new Error("The friends service returned an unreadable response. Refresh the board.");
    }
    return value;
  }

  function normalizeHub(response) {
    const next = emptyHub();
    for (const group of Object.keys(next)) {
      if (!Array.isArray(response[group])) throw new Error("The friends service returned an incomplete crew list. Refresh the board.");
      const seen = new Set();
      next[group] = response[group].filter(item => {
        if (!item || !validId(item.id) || item.id === auth.currentId || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }).map(item => ({ id: item.id, displayName: String(item.displayName || "BUILDER").slice(0, 100), online: item.online === true }));
    }
    const confirmed = new Set(next.friends.map(item => item.id));
    next.incoming = next.incoming.filter(item => !confirmed.has(item.id));
    next.outgoing = next.outgoing.filter(item => !confirmed.has(item.id));
    return next;
  }

  function showNotice(message, kind = "info") {
    notice = message;
    noticeKind = kind;
  }

  function refreshHub(options = {}) {
    if (!sameSession(epoch)) return Promise.resolve(false);
    if (refreshPromise) return refreshPromise;
    const version = epoch;
    loading = true;
    if (options.manual) {
      showNotice("Updating friends and requests…");
      profiles.forEach(profile => { profile.loadedAt = 0; });
    }
    render();
    const operation = (async () => {
      try {
        const response = await cloud("GetWorkerFriendHub", {}, version);
        if (!sameSession(version)) return false;
        hub = normalizeHub(response);
        window.RoadimentaryMessages?.syncFriendships(hub.friends);
        hasHub = true;
        syncError = "";
        lastSync = Date.now();
        if (options.manual) writesBlocked = false;
        if (options.manual || !options.preserveNotice) showNotice("Crew board updated. Requests are shared with the game.", "success");
        return true;
      } catch (error) {
        if (!sameSession(version) || error.stale) return false;
        if (error.expired) { unavailable(error.message); return false; }
        syncError = error.message;
        showNotice(`${error.message}${hasHub ? " Showing the last loaded list; actions are paused until Refresh succeeds." : ""}`, "error");
        return false;
      } finally {
        if (sameSession(version)) {
          loading = false;
          refreshPromise = null;
          render();
          hydrateVisibleProfiles();
        }
      }
    })();
    refreshPromise = operation;
    return operation;
  }

  function knownPlayer(id) {
    return [...hub.friends, ...hub.incoming, ...hub.outgoing, ...(searchResult ? [searchResult] : [])].find(item => item.id === id);
  }
  function relation(id) {
    if (hub.friends.some(item => item.id === id)) return "friends";
    if (hub.incoming.some(item => item.id === id)) return "incoming";
    if (hub.outgoing.some(item => item.id === id)) return "outgoing";
    return "none";
  }
  function getProfile(id) {
    if (!profiles.has(id)) profiles.set(id, { avatar: "avatar_roadbuilder", bio: "", xp: null, completed: null, attempted: null, loadedAt: 0, failed: false });
    return profiles.get(id);
  }
  function numberField(data, key) {
    const value = data?.[key]?.Value;
    if (!/^\d+$/.test(String(value ?? ""))) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number <= 2147483647 ? number : null;
  }
  function levelFor(total) {
    if (total === null) return null;
    let level = 1;
    let needed = 500;
    let current = total;
    while (current >= needed) { current -= needed; level++; needed += 100; }
    return { level, current, needed };
  }

  async function loadPublic(id) {
    if (!validId(id) || !sameSession(epoch)) return;
    const data = getProfile(id);
    if (Date.now() - data.loadedAt < CACHE_MS) return;
    if (profileRequests.has(id)) return profileRequests.get(id);
    const version = epoch;
    const operation = (async () => {
      try {
        const result = await api("GetUserData", { PlayFabId: id, Keys: PUBLIC_KEYS }, version);
        if (!sameSession(version)) return;
        const values = result.Data || {};
        const avatar = values.ProfileAvatar?.Value;
        data.avatar = AVATARS.has(avatar) ? avatar : "avatar_roadbuilder";
        data.bio = typeof values.ProfileAboutMe?.Value === "string" ? values.ProfileAboutMe.Value.slice(0, 1000) : "";
        data.xp = numberField(values, "ProfileTotalXP");
        data.completed = numberField(values, "ProfileJobsCompleted");
        data.attempted = numberField(values, "ProfileJobsAttempted");
        data.failed = false;
        data.loadedAt = Date.now();
      } catch (error) {
        if (!sameSession(version)) return;
        if (error.expired) { unavailable(error.message); return; }
        data.failed = true;
        data.loadedAt = Date.now();
      } finally {
        if (sameSession(version)) { profileRequests.delete(id); paintPublicFields(id); }
      }
    })();
    profileRequests.set(id, operation);
    return operation;
  }

  // Four concurrent public-profile reads at most for a displayed list.
  let hydrationRunning = false;
  let hydrationAgain = false;
  async function hydrateVisibleProfiles() {
    if (!sameSession(epoch)) return;
    if (hydrationRunning) { hydrationAgain = true; return; }
    hydrationRunning = true;
    const version = epoch;
    const needle = filter.trim().toLocaleLowerCase();
    const ids = [...new Set([...hub[view].filter(item => item.displayName.toLocaleLowerCase().includes(needle)).map(item => item.id), searchResult?.id, selectedId].filter(Boolean))];
    let cursor = 0;
    try {
      await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
        while (cursor < ids.length && sameSession(version)) {
          const id = ids[cursor++];
          await loadPublic(id);
        }
      }));
    } finally {
      if (version === epoch) {
        hydrationRunning = false;
        if (hydrationAgain) { hydrationAgain = false; hydrateVisibleProfiles(); }
      }
    }
  }

  async function searchPlayer() {
    if (!sameSession(epoch) || searchBusy || busy) return;
    const name = query.trim();
    if (!name || name.length > 100) { searchMessage = "Enter an exact display name or username."; renderSearch(); return; }
    if (name.includes("@")) { searchMessage = "Search by player name, not an email address."; renderSearch(); return; }
    const version = epoch;
    const request = ++searchVersion;
    searchBusy = true;
    searchResult = null;
    searchedQuery = name;
    searchMessage = "Looking up this builder…";
    renderSearch();
    try {
      let result;
      try { result = await api("GetAccountInfo", { TitleDisplayName: name }, version); }
      catch (error) {
        if (error.code !== "AccountNotFound") throw error;
        result = await api("GetAccountInfo", { Username: name }, version);
      }
      if (!sameSession(version) || request !== searchVersion) return;
      const info = result.AccountInfo;
      if (!validId(info?.PlayFabId)) throw new Error("The player lookup returned an unreadable account.");
      if (info.PlayFabId === auth.currentId) { searchMessage = "That is your own operator file. Try another builder."; return; }
      searchResult = { id: info.PlayFabId, displayName: String(info.TitleInfo?.DisplayName || info.Username || name).slice(0, 100) };
      searchMessage = `Builder found for “${searchedQuery}”.`;
    } catch (error) {
      if (!sameSession(version) || request !== searchVersion) return;
      if (error.expired) { unavailable(error.message); return; }
      searchMessage = error.code === "AccountNotFound" ? "No builder found. Check the exact display name or account username." : error.message;
    } finally {
      if (sameSession(version) && request === searchVersion) {
        searchBusy = false;
        renderSearch();
        hydrateVisibleProfiles();
      }
    }
  }

  async function performAction(action, id, origin) {
    if (!canWrite() || !validId(id) || id === auth.currentId || !knownPlayer(id)) return;
    const status = relation(id);
    const specifications = {
      send: { functionName: "SendWorkerFriendRequest", parameters: { targetId: id }, allowed: status === "none", results: ["pending", "incoming", "accepted"], message: "Friend request sent." },
      accept: { functionName: "RespondWorkerFriendRequest", parameters: { requesterId: id, accept: true }, allowed: status === "incoming", results: ["accepted"], message: "Friend request accepted." },
      decline: { functionName: "RespondWorkerFriendRequest", parameters: { requesterId: id, accept: false }, allowed: status === "incoming", results: ["declined"], message: "Friend request declined." },
      cancel: { functionName: "CancelWorkerFriendRequest", parameters: { targetId: id }, allowed: status === "outgoing", results: ["cancelled", "declined", "accepted"], message: "Sent request updated." },
      "confirm-remove": { functionName: "RemoveWorkerFriend", parameters: { targetId: id }, allowed: status === "friends" && confirmRemoveId === id, results: ["removed"], message: "Friend removed from your crew." }
    };
    const specification = specifications[action];
    if (!specification?.allowed) return;
    const version = epoch;
    busy = true;
    showNotice("Saving this crew action…");
    render();
    try {
      const result = await cloud(specification.functionName, specification.parameters, version);
      if (!sameSession(version)) return;
      if (!specification.results.includes(result.status)) throw new Error("The service did not confirm the expected result.");
      let message = specification.message;
      if (action === "send" && result.status === "incoming") message = "This builder already sent you a request. Open Received to accept it.";
      if (["send", "cancel"].includes(action) && result.status === "accepted") message = "You are already friends. The board has been updated.";
      if (action === "cancel" && result.status === "cancelled") message = "Friend request cancelled.";
      if (action === "cancel" && result.status === "declined") message = "That request was already declined.";
      confirmRemoveId = "";
      showNotice(message, "success");
      const refreshed = await refreshHub({ preserveNotice: true });
      if (sameSession(version) && !refreshed) writesBlocked = true;
    } catch (error) {
      if (!sameSession(version) || error.stale) return;
      if (error.expired) { unavailable(error.message); return; }
      // A timed-out/erroring write may already have changed the game records.
      // Never automatically resend it, or let stale cards drive a second action.
      writesBlocked = true;
      confirmRemoveId = "";
      await refreshHub({ preserveNotice: true });
      if (sameSession(version)) showNotice(`${error.message} Check the current list and use Refresh board before trying another action.`, "error");
    } finally {
      if (sameSession(version)) {
        busy = false;
        render();
        q(origin, "[data-crew-list-title]")?.focus({ preventScroll: true });
      }
    }
  }

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function actionButton(label, action, id, className = "") {
    const button = element("button", `office-button ${className}`, label);
    button.type = "button";
    button.dataset.crewAction = action;
    button.dataset.crewId = id;
    button.disabled = action !== "view" && action !== "keep" && !canWrite();
    return button;
  }
  function actionsFor(player) {
    const row = element("div", "crew-card-actions");
    const status = relation(player.id);
    if (status === "friends") {
      if (confirmRemoveId === player.id) {
        row.append(element("p", "crew-remove-prompt", "Remove this friend in both the website and game?"));
        row.append(actionButton("Yes, remove", "confirm-remove", player.id, "office-button-danger"), actionButton("Keep friend", "keep", player.id));
      } else row.append(actionButton("Message", "message", player.id, "office-button-primary"), actionButton("Remove friend", "remove", player.id, "office-button-danger"));
    } else if (status === "incoming") {
      row.append(actionButton("Accept", "accept", player.id, "office-button-primary"), actionButton("Decline", "decline", player.id));
    } else if (status === "outgoing") row.append(actionButton("Cancel request", "cancel", player.id));
    else row.append(actionButton("Send request", "send", player.id, "office-button-primary"));
    return row;
  }

  function cardFor(player, compact = false) {
    const card = element("article", `crew-contact-card${compact ? " crew-search-card" : ""}`);
    card.dataset.crewContact = player.id;
    const pin = element("span", "note-pin");
    pin.setAttribute("aria-hidden", "true");
    const heading = element("div", "crew-contact-heading");
    const portrait = element("img", "crew-avatar");
    portrait.alt = "";
    portrait.width = portrait.height = 72;
    portrait.loading = "lazy";
    portrait.dataset.crewAvatar = "";
    portrait.addEventListener("error", () => { portrait.hidden = true; });
    const copy = element("div", "crew-contact-copy");
    copy.append(element("h4", "", player.displayName));
    const type = relation(player.id);
    copy.append(element("span", "crew-relation-label", type === "friends" ? "Crew member" : type === "incoming" ? "Wants to join your crew" : type === "outgoing" ? "Awaiting their response" : "Potential crew member"));
    heading.append(portrait, copy);
    const meta = element("div", "crew-contact-meta");
    const level = element("span", "crew-level"); level.dataset.crewLevel = "";
    const presence = element("span", "crew-presence");
    const online = [...hub.friends, ...hub.incoming, ...hub.outgoing].find(item => item.id === player.id)?.online;
    presence.textContent = online === undefined ? "Presence not checked" : online ? "In game" : "Not active in game";
    presence.classList.toggle("is-online", online === true);
    meta.append(level, presence);
    const bio = element("p", "crew-card-bio"); bio.dataset.crewBio = "";
    const footer = element("div", "crew-card-footer");
    footer.append(actionButton("View public file", "view", player.id), actionsFor(player));
    card.append(pin, heading, meta, bio, footer);
    paintCard(card, getProfile(player.id), false);
    return card;
  }

  function paintCard(card, data, detailed) {
    const portrait = q(card, "[data-crew-avatar]");
    if (portrait) {
      const url = `assets/crew-avatars/${data.avatar}.png`;
      if (portrait.getAttribute("src") !== url) { portrait.hidden = false; portrait.src = url; }
    }
    const level = levelFor(data.xp);
    text(card, "[data-crew-level]", level ? `Level ${level.level}` : "Level —");
    let bio = data.failed ? "Public profile unavailable. Refresh to retry." : !data.loadedAt ? "Loading public operator note…" : data.bio || "This builder hasn't shared a public bio yet.";
    if (!detailed && bio.length > 130) bio = `${bio.slice(0, 127)}…`;
    text(card, "[data-crew-bio]", bio);
    text(card, "[data-crew-xp]", data.xp === null ? "—" : data.xp.toLocaleString());
    text(card, "[data-crew-completed]", data.completed === null ? "—" : data.completed.toLocaleString());
    text(card, "[data-crew-attempted]", data.attempted === null ? "—" : data.attempted.toLocaleString());
  }
  function paintPublicFields(id) {
    roots.forEach(root => root.querySelectorAll("[data-crew-contact]").forEach(card => {
      if (card.dataset.crewContact === id) paintCard(card, getProfile(id), card.hasAttribute("data-crew-full-profile"));
    }));
  }
  function emptyCard(title, description) {
    const card = element("div", "crew-empty-state");
    card.append(element("span", "crew-empty-symbol", "+"), element("h4", "", title), element("p", "", description));
    q(card, ".crew-empty-symbol").setAttribute("aria-hidden", "true");
    return card;
  }

  function renderLists() {
    roots.forEach(root => {
      root.querySelectorAll("[data-crew-view]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.crewView === view));
        q(button, "[data-crew-count]").textContent = hasHub ? hub[button.dataset.crewView].length : "—";
      });
      text(root, "[data-crew-list-title]", view === "friends" ? "Your Friends" : view === "incoming" ? "Received Requests" : "Sent Requests");
      const container = q(root, "[data-crew-list]");
      container.replaceChildren();
      container.setAttribute("aria-busy", String(loading));
      const needle = filter.trim().toLocaleLowerCase();
      const list = hub[view].filter(player => player.displayName.toLocaleLowerCase().includes(needle)).sort((a, b) => Number(b.online) - Number(a.online) || a.displayName.localeCompare(b.displayName));
      text(root, "[data-crew-list-summary]", hasHub ? `${list.length} of ${hub[view].length}` : "");
      q(root, "[data-crew-filter]").disabled = !auth || !hasHub;
      if (!hasHub) container.append(emptyCard(loading ? "Opening your crew file…" : "Crew file not loaded", loading ? "Checking the game's shared friends system." : "Use Refresh board to retry once your player session is ready."));
      else if (!list.length) container.append(emptyCard(needle ? "No matching builders" : view === "friends" ? "Your first crew member awaits" : view === "incoming" ? "No received requests" : "No sent requests", needle ? "Try another name or clear the filter." : view === "friends" ? "Use Find a Builder to send your first friend request." : view === "incoming" ? "Requests from other builders will appear here." : "Requests you send will be filed here until answered."));
      else list.forEach(player => container.append(cardFor(player)));
      text(root, "[data-crew-updated]", lastSync ? `Last synced ${new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Use Refresh for new requests and presence.` : "Friendships require an accepted request.");
    });
  }
  function renderSearch() {
    roots.forEach(root => {
      text(root, "[data-crew-search-status]", searchMessage);
      const input = q(root, "[data-crew-search]");
      input.disabled = !auth || searchBusy || busy;
      const button = q(root, "[data-crew-search-button]");
      button.disabled = !auth || searchBusy || busy;
      button.textContent = searchBusy ? "Searching…" : "Search player";
      const container = q(root, "[data-crew-search-result]");
      container.replaceChildren();
      if (searchResult) container.append(cardFor(searchResult, true));
    });
  }
  function renderDetails() {
    roots.forEach(root => {
      const panel = q(root, "[data-crew-detail]");
      const player = knownPlayer(selectedId);
      panel.hidden = !player;
      panel.replaceChildren();
      if (!player) return;
      const prefix = root.dataset.crewBoard === "mobile" ? "mobile-crew" : "desktop-crew";
      const heading = element("div", "crew-file-heading");
      const name = element("div");
      name.append(element("p", "office-kicker", "Public operator file / shared by the player"));
      const title = element("h3", "", player.displayName);
      title.id = `${prefix}-file-title`;
      title.tabIndex = -1;
      name.append(title);
      const close = element("button", "office-button", "Close file");
      close.type = "button";
      close.dataset.crewAction = "close-file";
      heading.append(name, close);
      const body = element("div", "crew-file-body");
      body.dataset.crewContact = player.id;
      body.dataset.crewFullProfile = "";
      const portrait = element("img", "crew-avatar crew-file-avatar");
      portrait.alt = "";
      portrait.dataset.crewAvatar = "";
      portrait.addEventListener("error", () => { portrait.hidden = true; });
      const copy = element("div", "crew-file-copy");
      const bio = element("p", "crew-full-bio"); bio.dataset.crewBio = "";
      copy.append(bio);
      const stats = element("dl", "crew-public-stats");
      for (const [label, key] of [["Operator level", "level"], ["Total XP", "xp"], ["Jobs completed", "completed"], ["Jobs attempted", "attempted"]]) {
        const item = element("div");
        const value = element("dd"); value.setAttribute(`data-crew-${key}`, "");
        item.append(element("dt", "", label), value); stats.append(item);
      }
      copy.append(stats, element("p", "crew-public-note", "Public game summaries may be missing or a little behind. — means this information has not synced yet."), actionsFor(player));
      body.append(portrait, copy);
      panel.append(heading, body);
      paintCard(body, getProfile(player.id), true);
    });
  }
  function showPublicFile(id, origin) {
    if (!knownPlayer(id)) return;
    selectedId = id;
    confirmRemoveId = "";
    render();
    hydrateVisibleProfiles();
    const panel = q(origin, "[data-crew-detail]");
    const heading = q(panel, "h3");
    heading?.focus({ preventScroll: true });
    panel.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function render() {
    roots.forEach(root => {
      const node = q(root, "[data-crew-notice]");
      node.textContent = notice;
      node.dataset.kind = noticeKind;
      node.hidden = !notice;
      const badge = q(root, "[data-crew-sync]");
      badge.textContent = busy ? "Saving…" : loading ? "Syncing…" : !auth ? "Sign-in required" : syncError || writesBlocked ? "Needs refresh" : hasHub ? "Shared with game" : "Not synced";
      badge.classList.toggle("is-loading", loading || busy);
      q(root, "[data-crew-action='refresh']").disabled = !auth || loading || busy;
    });
    renderLists();
    renderSearch();
    renderDetails();
  }

  function reset() {
    window.RoadimentaryMessages?.stop();
    epoch++;
    auth = null;
    hub = emptyHub();
    hasHub = loading = searchBusy = busy = writesBlocked = false;
    syncError = "";
    lastSync = 0;
    refreshPromise = null;
    profiles.clear(); profileRequests.clear();
    hydrationRunning = hydrationAgain = false;
    filter = query = searchedQuery = "";
    searchResult = null; selectedId = confirmRemoveId = "";
    searchMessage = ""; searchVersion++;
    view = "friends";
    roots.forEach(root => { q(root, "[data-crew-filter]").value = ""; q(root, "[data-crew-search]").value = ""; });
  }
  function unavailable(message) {
    reset();
    showNotice(message, "error");
    render();
  }
  window.RoadimentaryCrew = Object.freeze({
    init(options) {
      reset();
      if (!options?.sdk || !validId(options.currentId) || !options.sessionTicket || sessionStorage.getItem("pfSessionTicket") !== options.sessionTicket) {
        unavailable("Your session could not be verified. Sign in again from the landing page.");
        return;
      }
      auth = { sdk: options.sdk, currentId: options.currentId, sessionTicket: options.sessionTicket };
      const version = epoch;
      window.RoadimentaryMessages?.init({
        currentId: auth.currentId,
        isCurrent: () => Boolean(sameSession(version)),
        call: (name, parameters) => cloud(name, parameters, version),
        avatarFor: id => getProfile(id).avatar,
        onExpired: message => unavailable(message),
        onAccessLost: message => {
          if (!sameSession(version)) return;
          showNotice(message, "error");
          refreshHub({ preserveNotice: true });
        }
      });
      showNotice("Opening the game's shared crew records…");
      refreshHub();
    },
    open() { if (sameSession(epoch) && !busy && Date.now() - lastSync > CACHE_MS) refreshHub(); },
    unavailable,
    stop() { reset(); showNotice("Sign in to open your crew board."); render(); }
  });
  render();
})();
