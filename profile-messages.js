/* Player-to-player conversations. Uses only the authenticated player CloudScript
   context supplied by Crew; no title secret, admin session or direct data writes. */
(() => {
  "use strict";
  const roots = Array.from(document.querySelectorAll("[data-crew-board]"));
  const POLL_MS = 15000;
  const AVATARS = new Set(["avatar_roadbuilder", "avatar_maplecrew", "avatar_asphaltace", "avatar_pavepaws", "avatar_brickbuddy", "avatar_surveyor", "avatar_forewoman", "avatar_uniform_white_khaki", "avatar_uniform_white_khaki_male"]);
  const q = (root, selector) => root.querySelector(selector);
  const validId = id => typeof id === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(id);
  const node = (tag, className, text) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  let context = null, epoch = 0, conversation = 0, activeId = "";
  let friends = new Map(), messages = [], readBusy = false, writeBusy = false;
  let loaded = false, readFailed = false, failures = 0, online = null, lastChecked = 0;
  let feedback = "", feedbackKind = "info", timer = null;
  const drafts = new Map();
  const outboxes = new Map(); // Stable retry IDs and bodies; memory only, cleared on logout.
  function current() {
    if (!context) return false;
    if (!context.isCurrent()) { stop(); return false; }
    return true;
  }
  const same = (version, selected, id) => version === epoch && selected === conversation && id === activeId && current();

  function clearTimer() { clearTimeout(timer); timer = null; }
  function visibleRoot() {
    if (document.visibilityState !== "visible") return null;
    return roots.find(root => root.dataset.chatOpen === "true" && !root.closest('[aria-hidden="true"]') && root.getClientRects().length);
  }
  function schedule() {
    clearTimer();
    if (!activeId || !current() || !visibleRoot() || readBusy || writeBusy || failures >= 3) return;
    timer = setTimeout(() => { timer = null; void loadMessages(true); }, readFailed ? 30000 : POLL_MS);
  }
  function status(text, kind = "info") { feedback = text; feedbackKind = kind; paintControls(); }
  function build() {
    roots.forEach(root => {
      const panel = q(root, "[data-crew-chat]");
      if (!panel) return;
      const prefix = root.dataset.crewBoard === "mobile" ? "mobile-crew" : "desktop-crew";
      // Fixed markup only. Player names and message bodies are always text nodes.
      panel.innerHTML = `
        <header class="crew-chat-heading">
          <div class="crew-chat-person"><img class="crew-chat-avatar" data-chat-avatar alt="" width="52" height="60"><div><p class="office-kicker">Crew correspondence / confirmed friend</p><h3 id="${prefix}-chat-title" data-chat-name tabindex="-1"></h3><span class="crew-chat-presence" data-chat-presence>Checking game presence…</span></div></div>
          <button type="button" class="office-button" data-chat-action="back">Back to crew</button>
        </header>
        <div class="crew-chat-tools"><span data-chat-checked>Latest 50 messages</span><button type="button" class="office-button" data-chat-action="refresh">Refresh messages</button></div>
        <p class="crew-chat-status" data-chat-status role="status" aria-live="polite"></p>
        <div class="crew-chat-log" data-chat-log role="log" aria-live="off" aria-label="Conversation messages" tabindex="0"></div>
        <form class="crew-chat-compose" data-chat-form>
          <label for="${prefix}-message">Message your friend</label>
          <textarea id="${prefix}-message" data-chat-draft maxlength="300" rows="2" placeholder="Leave a note for your crew mate…" aria-describedby="${prefix}-message-count ${prefix}-message-help"></textarea>
          <div class="crew-chat-compose-footer"><span id="${prefix}-message-count" data-chat-count>0 / 300</span><button class="office-button office-button-primary" type="submit" data-chat-send>Send message</button></div>
          <p id="${prefix}-message-help" class="crew-chat-help">Enter adds a new line. Ctrl/⌘ + Enter sends. Keep personal information out of messages.</p>
        </form>
        <p class="crew-chat-footnote">Shared with the game's conversation records. Refreshes about every 15 seconds while this chat is visible. No read receipts.</p>`;
      q(panel, "[data-chat-avatar]").addEventListener("error", event => { event.target.hidden = true; });
      sizeObserver.observe(panel);
      const frame = root.closest('.win-content, #profile-mobile-sheet-content');
      if (frame) sizeObserver.observe(frame);
    });
  }

  function paintControls() {
    const friend = friends.get(activeId);
    const pending = outboxes.get(activeId);
    const draft = pending ? pending.text : drafts.get(activeId) || "";
    const enabled = current() && friend && loaded && !readFailed && !readBusy && !writeBusy;
    roots.forEach(root => {
      const panel = q(root, "[data-crew-chat]");
      if (!panel) return;
      panel.hidden = !activeId;
      root.dataset.chatOpen = activeId ? "true" : "false";
      if (!activeId) return;
      q(panel, "[data-chat-name]").textContent = friend?.displayName || "Builder";
      const avatar = q(panel, "[data-chat-avatar]");
      const candidate = context?.avatarFor(activeId);
      const source = `assets/crew-avatars/${AVATARS.has(candidate) ? candidate : "avatar_roadbuilder"}.png`;
      if (avatar.getAttribute("src") !== source) { avatar.hidden = false; avatar.src = source; }
      const presence = q(panel, "[data-chat-presence]");
      presence.textContent = online === true ? "Recently active in game" : online === false ? "Not recently active in game" : "Game presence not checked";
      presence.dataset.online = String(online);
      const statusNode = q(panel, "[data-chat-status]");
      statusNode.textContent = feedback;
      statusNode.dataset.kind = feedbackKind;
      q(panel, "[data-chat-checked]").textContent = lastChecked ? `${new Date(lastChecked).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Latest 50` : "Latest 50 messages";
      q(panel, "[data-chat-action='back']").disabled = writeBusy;
      q(panel, "[data-chat-action='refresh']").disabled = !current() || readBusy || writeBusy;
      q(panel, "[data-chat-action='refresh']").textContent = readBusy ? "Checking…" : "Refresh messages";
      q(panel, "[data-chat-log]").setAttribute("aria-busy", String(readBusy));
      const input = q(panel, "[data-chat-draft]");
      if (input.value !== draft) input.value = draft;
      input.disabled = !current() || !loaded || readFailed || writeBusy;
      input.readOnly = Boolean(pending);
      q(panel, "[data-chat-count]").textContent = `${draft.length} / 300`;
      const send = q(panel, "[data-chat-send]");
      send.disabled = !enabled || !draft.trim() || pending?.state === "conflict";
      send.textContent = writeBusy ? "Sending…" : pending ? "Retry same send" : "Send message";
    });
    fitLogs();
  }

  // Fit the transcript to the existing window, rather than changing that
  // window's height. Very short screens still use its normal outer scrolling.
  function fitLogs() {
    roots.forEach(root => {
      const panel = q(root, "[data-crew-chat]");
      const log = q(root, "[data-chat-log]");
      const frame = root.closest('.win-content, #profile-mobile-sheet-content');
      if (!panel || panel.hidden || !log || !frame || !root.getClientRects().length || !frame.clientHeight) return;
      const rootStyle = getComputedStyle(root), frameStyle = getComputedStyle(frame);
      const number = value => parseFloat(value) || 0;
      const mobile = root.closest('.mobile-office-panel');
      const mobileStyle = mobile ? getComputedStyle(mobile) : null;
      const extra = root.offsetHeight - panel.offsetHeight + number(rootStyle.marginTop) + number(rootStyle.marginBottom)
        + number(frameStyle.paddingTop) + number(frameStyle.paddingBottom)
        + (mobileStyle ? number(mobileStyle.paddingTop) + number(mobileStyle.paddingBottom) : 0);
      const available = frame.clientHeight - extra - (panel.offsetHeight - log.offsetHeight) - 5;
      const height = Math.round(Math.max(130, Math.min(420, available)));
      if (Math.abs(log.offsetHeight - height) > 1) {
        const bottom = log.scrollHeight - log.clientHeight - log.scrollTop < 70;
        log.style.height = `${height}px`;
        if (bottom) log.scrollTop = log.scrollHeight;
      }
    });
  }

  function paintMessages(forceBottom = false) {
    const signature = JSON.stringify({ messages, loaded, readFailed });
    roots.forEach(root => {
      const log = q(root, "[data-chat-log]");
      if (!log || log.dataset.signature === signature) return;
      const oldTop = log.scrollTop;
      const atBottom = log.scrollHeight - log.clientHeight - log.scrollTop < 70;
      log.replaceChildren();
      log.dataset.signature = signature;
      if (!messages.length) log.append(node("p", "crew-chat-empty", loaded ? "No messages yet. Leave the first crew note." : readFailed ? "No history loaded. Use Refresh messages to retry." : "Opening the conversation…"));
      messages.forEach(message => {
        const mine = message.senderId === context.currentId;
        const bubble = node("article", `crew-chat-message${mine ? " is-mine" : ""}`);
        const meta = node("div", "crew-chat-message-meta");
        const date = new Date(message.sentAt);
        const time = node("time", "", date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }));
        time.dateTime = date.toISOString();
        meta.append(node("strong", "", mine ? "You" : friends.get(activeId)?.displayName || "Friend"), time);
        bubble.append(meta, node("p", "crew-chat-message-text", message.text));
        log.append(bubble);
      });
      log.scrollTop = forceBottom || atBottom ? log.scrollHeight : oldTop;
    });
  }

  function normalize(rows, actor, target) {
    if (!Array.isArray(rows)) throw new Error("The game returned an unreadable conversation. Refresh to retry.");
    const unique = new Map();
    rows.forEach(message => {
      if (!message || typeof message.id !== "string" || message.id.length > 160
        || ![actor, target].includes(message.senderId) || typeof message.text !== "string"
        || message.text.length > 300 || typeof message.sentAt !== "number" || !Number.isFinite(message.sentAt)
        || message.sentAt <= 0 || message.sentAt > 8640000000000000) {
        throw new Error("The game returned an invalid message. No new conversation data was displayed.");
      }
      unique.set(message.id, { id: message.id, senderId: message.senderId, text: message.text, sentAt: message.sentAt });
    });
    return Array.from(unique.values()).sort((a, b) => a.sentAt - b.sentAt || a.id.localeCompare(b.id)).slice(-50);
  }

  function close(force = false) {
    if (writeBusy && !force) return;
    clearTimer(); conversation++; activeId = "";
    messages = []; loaded = readBusy = readFailed = false; lastChecked = 0; online = null;
    roots.forEach(root => {
      root.dataset.chatOpen = "false";
      const panel = q(root, "[data-crew-chat]");
      if (panel) {
        panel.hidden = true;
        q(panel, "[data-chat-log]")?.replaceChildren();
        if (q(panel, "[data-chat-log]")) delete q(panel, "[data-chat-log]").dataset.signature;
        if (q(panel, "[data-chat-draft]")) q(panel, "[data-chat-draft]").value = "";
        if (q(panel, "[data-chat-name]")) q(panel, "[data-chat-name]").textContent = "";
        if (q(panel, "[data-chat-status]")) q(panel, "[data-chat-status]").textContent = "";
      }
    });
  }
  function accessLost(message) {
    const id = activeId;
    outboxes.delete(id); drafts.delete(id);
    close(true);
    context?.onAccessLost(message);
  }
  function failure(error) {
    if (error.expired) { context?.onExpired(error.message); return true; }
    if (error.code === "NOT_FRIENDS") { accessLost(error.message); return true; }
    return false;
  }

  async function loadMessages(automatic = false) {
    if (!activeId || !current() || readBusy || writeBusy || (automatic && !visibleRoot())) return;
    clearTimer(); readBusy = true;
    const version = epoch, selected = conversation, id = activeId, actor = context.currentId;
    const first = !loaded;
    if (!automatic || first) status(first ? "Opening the game's shared conversation…" : "Checking for new messages…");
    else paintControls();
    try {
      const response = await context.call("GetWorkerMessages", { targetId: id });
      if (!same(version, selected, id)) return;
      const next = normalize(response.messages, actor, id);
      const oldIds = new Set(messages.map(message => message.id));
      const additions = next.filter(message => !oldIds.has(message.id)).length;
      const pending = outboxes.get(id);
      let recovered = false;
      if (pending) {
        const echoed = next.find(message => message.id === `${actor}_${pending.requestId}`);
        if (echoed && echoed.senderId === actor && echoed.text === pending.text) {
          outboxes.delete(id); drafts.delete(id); recovered = true;
        } else if (echoed) pending.state = "conflict";
      }
      messages = next; loaded = true; readFailed = false; failures = 0;
      online = typeof response.online === "boolean" ? response.online : null;
      lastChecked = Date.now();
      paintMessages(first);
      status(recovered ? "Your earlier send is confirmed in the conversation. It was not sent again."
        : outboxes.has(id) ? "A send is still unconfirmed. Use Retry same send; its reference and text are preserved."
        : !first && additions ? `${additions} new ${additions === 1 ? "message" : "messages"}. Conversation updated.`
        : "Conversation updated. Messages are shared with the game.", recovered ? "success" : "info");
    } catch (error) {
      if (!same(version, selected, id) || error.stale) return;
      if (failure(error)) return;
      readFailed = true; failures++;
      paintMessages();
      status(`${error.message} ${loaded ? "Showing the last loaded conversation; sending is paused until Refresh succeeds." : "No conversation was loaded."}${failures >= 3 ? " Auto-refresh is paused; use Refresh messages." : ""}`, "error");
    } finally {
      if (same(version, selected, id)) { readBusy = false; paintControls(); schedule(); }
    }
  }

  function requestId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  }
  async function sendMessage() {
    if (!current() || !activeId || !friends.has(activeId) || !loaded || readFailed || readBusy || writeBusy) return;
    const version = epoch, selected = conversation, id = activeId, actor = context.currentId;
    let pending = outboxes.get(id);
    if (pending?.state === "conflict") return;
    if (!pending) {
      const text = (drafts.get(id) || "").trim();
      if (!text || text.length > 300) return;
      try { pending = { text, requestId: requestId(), state: "sending" }; }
      catch (_) { status("A secure send reference could not be created. Refresh the page before sending.", "error"); return; }
      outboxes.set(id, pending);
    }
    pending.state = "sending"; writeBusy = true; clearTimer();
    status("Sending your crew note…");
    try {
      const response = await context.call("SendWorkerMessage", { targetId: id, text: pending.text, requestId: pending.requestId });
      if (version !== epoch || !current()) return;
      const confirmed = normalize([response.message], actor, id)[0];
      if (!confirmed || confirmed.id !== `${actor}_${pending.requestId}` || confirmed.senderId !== actor || confirmed.text !== pending.text) {
        throw new Error("The game did not confirm the expected send. Retry the same reference after Refresh.");
      }
      outboxes.delete(id); drafts.delete(id);
      if (same(version, selected, id)) {
        messages = normalize([...messages, confirmed], actor, id);
        paintMessages(true);
        status("Message sent and saved to the game's conversation.", "success");
      }
    } catch (error) {
      if (version !== epoch || !current() || error.stale) return;
      pending.state = error.code === "REQUEST_CONFLICT" ? "conflict" : "uncertain";
      if (same(version, selected, id)) {
        if (failure(error)) return;
        status(`${error.message} ${pending.state === "conflict" ? "Sending is paused for this reference." : "Delivery was not confirmed here. The original text and send reference are kept for Retry same send."}`, "error");
      }
    } finally {
      if (version === epoch && current()) { writeBusy = false; paintControls(); schedule(); }
    }
  }

  function open(id, origin) {
    if (!current() || writeBusy || !validId(id) || id === context.currentId || !friends.has(id)) return;
    close(); activeId = id; failures = 0;
    feedback = "Opening the game's shared conversation…"; feedbackKind = "info";
    paintControls(); paintMessages(true);
    const panel = q(origin, "[data-crew-chat]");
    q(panel, "[data-chat-name]")?.focus({ preventScroll: true });
    panel.scrollIntoView({ block: "start", behavior: "instant" });
    void loadMessages();
  }
  function syncFriendships(rows) {
    friends = new Map(rows.filter(friend => validId(friend.id)).map(friend => [friend.id, friend]));
    for (const id of outboxes.keys()) if (!friends.has(id)) outboxes.delete(id);
    for (const id of drafts.keys()) if (!friends.has(id)) drafts.delete(id);
    if (activeId && !friends.has(activeId)) accessLost("This friendship has changed. Its conversation is no longer available.");
    else paintControls();
  }
  function stop() {
    epoch++; close(true); context = null; friends.clear(); drafts.clear(); outboxes.clear();
    writeBusy = false; failures = 0;
  }

  roots.forEach(root => {
    root.addEventListener("input", event => {
      if (!event.target.matches("[data-chat-draft]") || !activeId || outboxes.has(activeId)) return;
      drafts.set(activeId, event.target.value.slice(0, 300)); paintControls();
    });
    root.addEventListener("submit", event => {
      if (!event.target.matches("[data-chat-form]")) return;
      event.preventDefault(); void sendMessage();
    });
    root.addEventListener("keydown", event => {
      if (event.target.matches("[data-chat-draft]") && event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.isComposing) {
        event.preventDefault(); void sendMessage();
      }
    });
    root.addEventListener("click", event => {
      const button = event.target.closest("[data-chat-action]");
      if (!button || button.disabled) return;
      if (button.dataset.chatAction === "refresh") { failures = 0; void loadMessages(); }
      if (button.dataset.chatAction === "back") {
        close();
        q(root, "[data-crew-list-title]")?.focus({ preventScroll: true });
        root.scrollIntoView({ block: "start", behavior: "instant" });
      }
    });
  });
  function visibilityChanged() {
    if (!current()) { if (context) stop(); return; }
    if (!activeId || !visibleRoot()) { clearTimer(); return; }
    fitLogs();
    if (!timer && !readBusy && !writeBusy && failures < 3) {
      if (Date.now() - lastChecked >= POLL_MS) void loadMessages(true);
      else schedule();
    }
  }
  new MutationObserver(visibilityChanged).observe(document.body, { attributes: true, subtree: true, attributeFilter: ["class", "aria-hidden"] });
  document.addEventListener("visibilitychange", visibilityChanged);
  window.addEventListener("resize", visibilityChanged);
  window.visualViewport?.addEventListener("resize", visibilityChanged);
  const sizeObserver = new ResizeObserver(fitLogs);
  sizeObserver.observe(document.body);
  window.addEventListener("pagehide", clearTimer);
  window.addEventListener("beforeunload", event => {
    if (outboxes.size && current()) { event.preventDefault(); event.returnValue = ""; }
  });
  window.RoadimentaryMessages = Object.freeze({
    init(options) { stop(); context = options; build(); }, open, syncFriendships, stop
  });
})();
