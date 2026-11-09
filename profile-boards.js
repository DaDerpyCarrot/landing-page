/* All Operators: each live category reads one existing PlayFab statistic. */
(() => {
  "use strict";
  const LIMIT = 20, MAX = 2147483647, CACHE_MS = 60000, READ_MS = 10000;
  const metrics = Object.freeze({
    xp: Object.freeze({ stat: "TotalXP", label: "Total XP", column: "Total XP", unit: " XP",
      caption: "Top 20 operators with a saved Total XP score." }),
    completed: Object.freeze({ stat: "JobsCompleted", label: "Contracts Completed", column: "Completed", unit: "",
      caption: "Ranks saved successful non-tutorial contracts. New results appear after the game syncs." }),
    activity: Object.freeze({ stat: "JobsAttempted", label: "Contract Activity", column: "Attempts", unit: "",
      caption: "Ranks recorded non-tutorial attempts, including runs that did not succeed. This measures activity, not success." }),
    earnings: Object.freeze({ stat: null, label: "Contract Earnings", column: "Cash earned", unit: "",
      caption: "A future ranking for confirmed game Cash earned from contracts, separate from wallet balances and purchases." })
  });
  const nonnegativeInt = value => Number.isInteger(value) && value >= 0 && value <= MAX;
  const playerId = value => typeof value === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(value) ? value.toUpperCase() : null;
  const badData = () => new Error("PlayFab returned unreadable ranking data. Refresh the board to try again.");
  function displayName(value) {
    if (typeof value !== "string" || value.includes("@")) return "Unnamed operator";
    const text = value.replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, "").trim();
    return Array.from(text).slice(0, 80).join("") || "Unnamed operator";
  }
  function parseBoard(data, limit = LIMIT) {
    if (!nonnegativeInt(data?.Version) || !Array.isArray(data.Leaderboard) || data.Leaderboard.length > limit) throw badData();
    const seenIds = new Set(), seenPositions = new Set();
    const rows = data.Leaderboard.map(raw => {
      const id = playerId(raw?.PlayFabId);
      if (!id || !nonnegativeInt(raw.Position) || !nonnegativeInt(raw.StatValue)
        || seenIds.has(id) || seenPositions.has(raw.Position)) throw badData();
      seenIds.add(id); seenPositions.add(raw.Position);
      return { id, rank: raw.Position + 1, score: raw.StatValue, name: displayName(raw.DisplayName) };
    }).sort((a, b) => a.rank - b.rank);
    return { version: data.Version, rows };
  }
  function savedScore(data, version, stat = metrics.xp.stat) {
    if (!Array.isArray(data?.Statistics)) throw badData();
    const values = data.Statistics.filter(row => row?.StatisticName === stat);
    if (!values.length) return null;
    if (values.length !== 1 || !nonnegativeInt(values[0].Value)
      || (values[0].Version !== undefined && values[0].Version !== version)) throw badData();
    return values[0].Value;
  }
  function place(board, ownId, score, around) {
    const first = board.rows.find(row => row.id === ownId);
    if (first) return { state: "ranked", rank: first.rank, score: first.score };
    if (score === null) return { state: "unranked" };
    const row = around?.version === board.version ? around.rows.find(row => row.id === ownId) : null;
    if (!row || row.score !== score || row.rank <= LIMIT) return { state: "pending", score };
    return { state: "ranked", rank: row.rank, score: row.score };
  }
  if (typeof module === "object" && module.exports) {
    module.exports = { parseBoard, savedScore, savedXP: savedScore, place };
    return;
  }

  const roots = Array.from(document.querySelectorAll("[data-xp-board]"));
  if (!roots.length) return;
  const q = (root, selector) => root.querySelector(selector);
  const fmt = new Intl.NumberFormat();
  const fresh = message => ({ board: null, message, kind: "idle", placement: { state: "idle" }, checkedAt: 0 });
  let auth = null, flight = null, category = "xp", view = fresh("Verifying your player session…");
  const cache = new Map();
  const sessionMatches = () => auth && sessionStorage.getItem("pfSessionTicket") === auth.sessionTicket;
  const current = job => flight === job && auth === job.context && job.category === category && sessionMatches();
  const stale = () => Object.assign(new Error("Player session changed."), { stale: true });
  const expires = new Set(["InvalidSessionTicket", "SessionTicketExpired", "NotAuthenticated", "AccountBanned"]);
  function node(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  }
  roots.forEach(root => {
    const heading = "xp-board-heading-" + (root.dataset.xpBoard === "mobile" ? "mobile" : "desktop");
    // Fixed template. All fetched text is inserted through textContent.
    root.innerHTML = `
      <section class="office-paper leaderboard-paper xp-board-paper" aria-labelledby="${heading}">
        <div class="xp-board-header">
          <div><p class="office-kicker">Regional rankings</p><h2 id="${heading}">All Operators</h2></div>
          <span class="construction-tag" data-board-metric>Total XP</span>
        </div>
        <div class="board-category">
          <label for="${heading}-category">Ranking category</label>
          <select id="${heading}-category" data-board-category disabled>
            <option value="xp">Total XP</option>
            <option value="completed">Contracts Completed</option>
            <option value="activity">Contract Activity</option>
            <option value="earnings">Contract Earnings · Not tracked</option>
          </select>
        </div>
        <p class="xp-board-caption" data-board-caption></p>
        <div class="xp-board-tools"><button type="button" class="office-button" data-xp-refresh disabled>Refresh board</button><span data-xp-checked></span></div>
        <p class="xp-board-status" data-xp-status role="status"></p>
        <div class="xp-board-columns" data-xp-columns aria-hidden="true" hidden><span>Rank</span><span>Operator</span><span data-board-column></span></div>
        <ol class="xp-board-list" data-xp-list hidden></ol>
      </section>
      <aside class="office-paper ranking-file xp-placement" aria-label="Your placement">
        <p class="office-kicker">Your placement</p>
        <div class="xp-placement-value" data-xp-position>—</div>
        <p class="xp-placement-score" data-xp-personal-score hidden></p>
        <p class="xp-placement-note" data-xp-personal-note role="status"></p>
      </aside>`;
    q(root, "[data-xp-refresh]").addEventListener("click", () => { void refresh(); });
    q(root, "[data-board-category]").addEventListener("change", event => choose(event.target.value));
  });
  const placementCopy = {
    idle: ["—", "Open the board to check your placement."],
    loading: ["Checking…", "Looking up your saved score."],
    unranked: ["Unranked", "No score is saved for you in this category yet."],
    pending: ["Pending", "Your saved score and placement couldn't be matched yet. Refresh in a moment."],
    error: ["Unavailable", "Your placement couldn't be checked. Use Refresh board to retry."],
    "not-tracked": ["Not tracked", "No earned-Cash ranking has been published yet."],
    ranked: ["", "Your position on the All Operators board."]
  };
  function render() {
    const metric = metrics[category];
    roots.forEach(root => {
      const selector = q(root, "[data-board-category]");
      selector.value = category; selector.disabled = !sessionMatches();
      q(root, "[data-board-metric]").textContent = metric.label;
      q(root, "[data-board-caption]").textContent = metric.caption;
      q(root, "[data-board-column]").textContent = metric.column;
      const button = q(root, "[data-xp-refresh]");
      button.hidden = !metric.stat;
      button.disabled = !sessionMatches() || Boolean(flight) || !metric.stat;
      button.textContent = flight ? "Checking…" : "Refresh board";
      const status = q(root, "[data-xp-status]");
      status.textContent = view.message;
      status.dataset.state = view.kind;
      q(root, "[data-xp-checked]").textContent = view.checkedAt
        ? "Last checked " + new Date(view.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      const list = q(root, "[data-xp-list]");
      list.setAttribute("aria-label", "All Operators ranked by " + metric.label);
      list.setAttribute("aria-busy", String(view.kind === "loading"));
      list.replaceChildren();
      for (const row of view.board?.rows || []) {
        const own = row.id === auth?.currentId;
        const li = node("li", "xp-board-row" + (own ? " is-you" : ""));
        const rank = node("span", "xp-board-rank", "#" + fmt.format(row.rank));
        const operator = node("div", "xp-board-operator");
        operator.append(node("strong", "", row.name));
        if (own) operator.append(node("span", "xp-you-label", "You"));
        li.append(rank, operator, node("span", "xp-board-score", fmt.format(row.score) + metric.unit));
        list.append(li);
      }
      q(root, "[data-xp-columns]").hidden = list.hidden = !list.childElementCount;
      const p = view.placement, copy = placementCopy[p.state];
      const position = q(root, "[data-xp-position]");
      position.textContent = p.state === "ranked" ? "#" + fmt.format(p.rank) : copy[0];
      position.dataset.state = p.state;
      const score = q(root, "[data-xp-personal-score]");
      score.hidden = !nonnegativeInt(p.score);
      score.textContent = score.hidden ? "" : fmt.format(p.score) + (category === "completed" ? " completed"
        : category === "activity" ? (p.score === 1 ? " attempt" : " attempts") : metric.unit);
      q(root, "[data-xp-personal-note]").textContent = copy[1];
    });
  }
  function cancelRead() {
    const old = flight;
    flight = null;
    old?.cancel?.();
  }
  function stop(message = "Sign in to view the Operator Boards.") {
    cancelRead(); auth = null; category = "xp"; cache.clear();
    view = fresh(message);
    render();
  }
  function choose(key) {
    if (!sessionMatches()) { stop(); return; }
    if (!Object.hasOwn(metrics, key) || category === key) return;
    cancelRead(); category = key;
    if (!metrics[key].stat) {
      view = fresh("Contract Earnings is not tracked as a leaderboard stat yet. Wallet balances and purchases are not used as substitutes.");
      view.kind = "not-tracked"; view.placement = { state: "not-tracked" };
    } else {
      view = cache.get(key) || fresh("Open this category to load its rankings.");
    }
    render(); open();
  }
  function ensure(job) { if (!current(job)) throw stale(); }
  function read(job, method, input) {
    return new Promise((resolve, reject) => {
      if (!current(job)) return reject(stale());
      let settled = false;
      const finish = (error, data) => {
        if (settled) return;
        settled = true; clearTimeout(timer); job.cancel = null;
        if (!current(job)) reject(stale());
        else if (error) reject(error);
        else resolve(data);
      };
      const timer = setTimeout(() => finish(new Error("The leaderboard request timed out. Refresh the board to retry.")), READ_MS);
      job.cancel = () => finish(stale());
      try {
        const sdk = job.context.sdk;
        if (typeof sdk[method] !== "function") {
          finish(new Error("The PlayFab leaderboard client isn't available. Reload the profile and try again."));
          return;
        }
        sdk[method](input, (result, error) => {
          if (error) {
            const expired = expires.has(error.error);
            finish(Object.assign(new Error(expired ? "Your player session expired. Sign in again."
              : "PlayFab couldn't load the ranking. Refresh the board to retry."), { expired }));
          } else finish(null, result?.data);
        });
      } catch (_) { finish(new Error("Could not contact PlayFab. Refresh the board to retry.")); }
    });
  }
  async function refresh() {
    if (!sessionMatches()) { stop(); return; }
    const metric = metrics[category], stat = metric.stat;
    if (flight || !stat) return;
    const job = flight = { context: auth, category, cancel: null };
    cache.delete(category);
    const own = job.context.currentId;
    view = fresh("Reading the " + metric.label + " leaderboard…");
    view.kind = "loading"; view.placement = { state: "loading" }; render();
    try {
      const board = parseBoard(await read(job, "GetLeaderboard", { StatisticName: stat, StartPosition: 0, MaxResultsCount: LIMIT }));
      ensure(job);
      view.board = board; view.checkedAt = Date.now(); view.kind = board.rows.length ? "ready" : "empty";
      view.message = board.rows.length ? "Showing " + board.rows.length + " ranked " + (board.rows.length === 1 ? "operator." : "operators.")
        : "No scores are ranked in this category yet.";
      if (board.rows.some(row => row.id === own)) { view.placement = place(board, own, null); return; }
      render();
      const score = savedScore(await read(job, "GetPlayerStatistics",
        { StatisticNameVersions: [{ StatisticName: stat, Version: board.version }] }), board.version, stat);
      ensure(job);
      if (score === null) { view.placement = place(board, own, score); return; }
      const around = parseBoard(await read(job, "GetLeaderboardAroundPlayer", {
        StatisticName: stat, MaxResultsCount: 3, UseSpecificVersion: true, Version: board.version
      }), 3);
      ensure(job);
      view.placement = place(board, own, score, around);
    } catch (error) {
      if (flight !== job) return;
      if (!current(job) || error.expired) { stop(error.expired ? error.message : "Your player session changed. Sign in again."); return; }
      if (!view.board) { view.message = error.message; view.kind = "error"; }
      view.placement = { state: "error" };
    } finally {
      if (flight === job) {
        if (view.board) cache.set(job.category, view);
        flight = null; render();
      }
    }
  }
  function open() {
    if (auth && !sessionMatches()) { stop(); return; }
    if (auth && metrics[category].stat && (!view.checkedAt || Date.now() - view.checkedAt >= CACHE_MS)) void refresh();
  }
  function checkSession() { if (auth && !sessionMatches()) stop(); }
  window.addEventListener("pageshow", checkSession);
  window.addEventListener("storage", checkSession);
  document.addEventListener("visibilitychange", checkSession);
  window.RoadimentaryBoards = Object.freeze({
    init(options) {
      stop();
      const own = playerId(options?.currentId);
      if (!own || !options.sdk || !options.sessionTicket || sessionStorage.getItem("pfSessionTicket") !== options.sessionTicket) return;
      auth = { sdk: options.sdk, sessionTicket: options.sessionTicket, currentId: own };
      view = fresh("Open Boards or select Refresh board to see the current rankings.");
      render();
      if (roots.some(root => !root.closest('[aria-hidden="true"]') && root.getClientRects().length)) open();
    },
    open, stop
  });
  render();
})();
