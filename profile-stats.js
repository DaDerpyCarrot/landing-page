(() => {
  "use strict";

  const roots = Array.from(document.querySelectorAll("[data-stats-board]"));
  const overviews = Array.from(document.querySelectorAll("[data-career-snapshot]"));
  if (!roots.length && !overviews.length) return;
  const names = ["TotalXP", "JobsCompleted", "JobsAttempted", "WorkQualityTotal", "WorkQualityJobs"];
  const payoutStat = "ContractCashEarned";
  const MAX = 2147483647;
  const CACHE_MS = 60000;
  const REQUEST_MS = 15000;
  const expiredErrors = new Set(["SessionTicketExpired", "InvalidSessionTicket", "NotAuthenticated"]);
  const pending = new Set();
  let auth = null, epoch = 0, busy = false, loaded = false, snapshot = null, checkedAt = 0;
  let message = "Sign in to view your saved construction performance.", kind = "info";

  // Matches WorkerProfileProgression.Calculate / ContractRewardRules.NextLevelXp (version 6).
  // XP is already in whole points here; it is not the save file's xpSubunits value.
  function levelFor(total) {
    if (!Number.isInteger(total) || total < 0 || total > MAX) return null;
    let level = 1, current = total;
    const neededAt = value => [0, 50, 100, 200, 350][value] ?? 500 + (value - 5) * 100;
    let needed = neededAt(level);
    while (current >= needed) {
      current -= needed;
      needed = neededAt(++level);
    }
    return { level, current, needed };
  }

  const q = (root, selector) => root.querySelector(selector);
  const set = (root, name, value) => { q(root, `[data-stats-${name}]`).textContent = value; };
  const format = value => new Intl.NumberFormat().format(value);
  const empty = () => ({ value: null, source: "missing" });
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  function validSession() {
    if (!auth || sessionStorage.getItem("pfSessionTicket") !== auth.ticket) return false;
    const storedId = sessionStorage.getItem("pfPlayFabId");
    const sdkTicket = window.PlayFab?._internalSettings?.sessionTicket;
    return (!storedId || storedId.toUpperCase() === auth.id.toUpperCase())
      && (!sdkTicket || sdkTicket === auth.ticket);
  }

  function current(version = epoch) {
    if (version !== epoch || !auth) return false;
    if (validSession()) return true;
    unavailable("Your player session changed. Sign in again to load this account's statistics.");
    return false;
  }

  function visible() {
    return [...roots, ...overviews].some(root => !root.closest('[aria-hidden="true"]') && root.getClientRects().length);
  }

  function number(value, source, stringValue = false) {
    const parsed = stringValue && typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim()) : stringValue ? NaN : value;
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX
      ? { value: parsed, source } : { value: null, source: "invalid" };
  }

  function legacyField(stats, name) {
    if (!stats.ok) return empty();
    const found = stats.data.Statistics.filter(item => item?.StatisticName === name);
    if (found.length === 1) return number(found[0].Value, "statistics");
    return found.length ? { value: null, source: "invalid" } : empty();
  }

  function normalize(stats, data) {
    const legacy = {}, summary = {};
    names.forEach(name => {
      legacy[name] = legacyField(stats, name); summary[name] = empty();
      const key = `Profile${name}`;
      if (data.ok && own(data.data.Data, key)) summary[name] = number(data.data.Data[key]?.Value, "summary", true);
    });
    const fields = {};
    names.forEach(name => {
      // A recorded Legacy zero wins over a public copy. Invalid values are not silently replaced.
      fields[name] = legacy[name].source === "missing" ? summary[name] : legacy[name];
    });

    function pair(first, second) {
      // Never divide a Legacy numerator by a public-summary denominator (or vice versa).
      const selected = legacy[first].source === "missing" && legacy[second].source === "missing" ? summary : legacy;
      const a = selected[first], b = selected[second];
      return { a: a.value, b: b.value, source: a.source === b.source ? a.source : "missing" };
    }

    const completion = pair("JobsCompleted", "JobsAttempted");
    const quality = pair("WorkQualityTotal", "WorkQualityJobs");
    return { fields, completion, quality,
      earnings: legacyField(stats, payoutStat), statsAvailable: stats.ok, summariesAvailable: data.ok,
      any: Object.values(fields).some(field => field.value !== null) };
  }

  function ratio(pair, quality = false) {
    if (!pair || pair.a === null || pair.b === null || pair.a > pair.b * (quality ? 100 : 1)) return { text: "—", note: "Not available yet." };
    if (!pair.b) return { text: "Not enough data", note: quality ? "No scored completed jobs are recorded." : "No job attempts are recorded." };
    const value = quality ? pair.a / pair.b : 100 * pair.a / pair.b;
    const text = quality ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value) : String(Math.round(value));
    return { text: `${text}%`, note: quality ? "Average score on completed jobs" : "Share of attempted jobs completed" };
  }

  roots.forEach(root => {
    const prefix = root.dataset.statsBoard === "mobile" ? "mobile-performance" : "desktop-performance";
    root.innerHTML = `
      <header class="performance-heading">
        <div><p class="office-kicker">Operations / career record</p><h2>Construction Performance</h2></div>
      </header>
      <p class="performance-intro">Your progress and construction results. Practice tutorial runs don’t count toward job totals.</p>
      <div class="performance-tools"><button class="office-button" type="button" data-stats-refresh disabled>Refresh stats</button></div>
      <p class="performance-status" data-stats-status role="status" aria-live="polite"></p>
      <div class="performance-progression">
        <article class="performance-level"><span class="performance-label">Operator level</span><strong data-stats-level>—</strong><span>Total XP <b data-stats-xp>—</b></span></article>
        <div class="performance-xp">
          <label for="${prefix}-xp" data-stats-progress-heading>XP progress</label>
          <p data-stats-progress-text>Open Operations to load saved XP.</p>
          <progress id="${prefix}-xp" max="1" value="0" data-stats-progress aria-label="XP progress unavailable"></progress>
          <p data-stats-progress-remaining></p>
        </div>
      </div>
      <div class="performance-grid">
        <article class="performance-card"><h3>Jobs completed</h3><strong data-stats-completed>—</strong></article>
        <article class="performance-card"><h3>Jobs attempted</h3><strong data-stats-attempted>—</strong></article>
        <article class="performance-card"><h3>Completion rate</h3><strong data-stats-completion>—</strong><small data-stats-completion-note>Not loaded yet</small></article>
        <article class="performance-card"><h3>Average work quality</h3><strong data-stats-quality>—</strong><small data-stats-quality-note>Not loaded yet</small></article>
      </div>`;
    q(root, "[data-stats-refresh]").addEventListener("click", () => { if (current() && !busy) void load(); });
  });
  overviews.forEach(root => {
    q(root, "[data-overview-refresh]")?.addEventListener("click", () => { if (current() && !busy) void load(); });
  });

  function paintOverview(xp, progression, completed, attempted, quality) {
    const earnings = snapshot?.earnings || empty();
    const scored = snapshot?.quality?.b;
    const hasQuality = quality.text.endsWith("%");
    const hasData = [xp, completed, attempted, earnings].some(field => field.value !== null) || hasQuality;
    const status = busy ? ""
      : !validSession() ? (kind === "error" ? message : "Sign in to check your saved career stats.")
      : !loaded ? ""
      : !hasData ? (!snapshot?.statsAvailable || !snapshot.summariesAvailable
        ? "Career stats couldn’t be read. Use Refresh stats to try again." : "No saved career stats are available yet.")
      : "";
    const badge = loaded && !hasData ? "Unavailable" : "Career record";
    for (const root of overviews) {
      const write = (key, value) => {
        const element = q(root, `[data-overview-${key}]`);
        if (element) element.textContent = value;
      };
      root.setAttribute("aria-busy", String(busy));
      write("badge", badge); write("status", status);
      q(root, "[data-overview-status]")?.toggleAttribute("hidden", !status);
      const badgeElement = q(root, "[data-overview-badge]");
      if (badgeElement) badgeElement.dataset.kind = hasData ? "saved" : "neutral";
      const button = q(root, "[data-overview-refresh]");
      if (button) {
        button.disabled = busy || !validSession();
        button.textContent = busy ? "Checking…" : "Refresh stats";
      }
      write("level", progression ? format(progression.level) : "—");
      write("xp", xp.value === null ? "Saved XP unavailable" : format(xp.value) + " total XP");
      write("completed", completed.value === null ? "—" : format(completed.value));
      write("attempted", attempted.value === null ? "Attempt total unavailable" : format(attempted.value) + " recorded " + (attempted.value === 1 ? "attempt" : "attempts"));
      write("quality", hasQuality ? quality.text : "—");
      write("quality-note", hasQuality ? format(scored) + " scored " + (scored === 1 ? "job" : "jobs")
        : quality.text === "Not enough data" ? "No scored jobs" : "No usable quality average");
      const cashText = earnings.value === null ? "—" : format(earnings.value);
      write("earnings", cashText);
      q(root, "[data-overview-earnings]")?.toggleAttribute("data-long-value", cashText.length > 10);
      write("earnings-note", earnings.value !== null || !loaded ? "Since tracking began"
        : !snapshot?.statsAvailable ? "Saved total unavailable"
        : earnings.source === "invalid" ? "Saved total unreadable" : "No saved payout total");
    }
  }

  function paint() {
    const fields = snapshot?.fields;
    const xp = fields?.TotalXP || empty();
    const completed = fields?.JobsCompleted || empty();
    const attempted = fields?.JobsAttempted || empty();
    const progression = levelFor(xp.value);
    const completion = ratio(snapshot?.completion);
    const quality = ratio(snapshot?.quality, true);
    paintOverview(xp, progression, completed, attempted, quality);
    roots.forEach(root => {
      root.setAttribute("aria-busy", String(busy));
      const status = q(root, "[data-stats-status]");
      status.textContent = message; status.dataset.kind = kind; status.hidden = !message;
      const refresh = q(root, "[data-stats-refresh]"); refresh.disabled = busy || !validSession(); refresh.textContent = busy ? "Checking…" : "Refresh stats";
      set(root, "level", progression ? format(progression.level) : "—");
      set(root, "xp", xp.value === null ? "—" : format(xp.value));
      set(root, "completed", completed.value === null ? "—" : format(completed.value));
      set(root, "attempted", attempted.value === null ? "—" : format(attempted.value));
      set(root, "completion", completion.text); set(root, "completion-note", completion.note);
      set(root, "quality", quality.text); set(root, "quality-note", quality.note);
      const progress = q(root, "[data-stats-progress]");
      progress.max = progression?.needed || 1; progress.value = progression?.current || 0;
      progress.setAttribute("aria-label", progression ? `${format(progression.current)} of ${format(progression.needed)} XP toward level ${progression.level + 1}` : "XP progress unavailable");
      set(root, "progress-heading", progression ? `Progress to level ${format(progression.level + 1)}` : "XP progress");
      set(root, "progress-text", progression ? `${format(progression.current)} / ${format(progression.needed)} XP` : busy ? "Checking saved XP…" : "Saved XP is not available yet.");
      set(root, "progress-remaining", progression ? `${format(progression.needed - progression.current)} XP to the next level` : "");
    });
  }

  function read(method, args, version, session) {
    return new Promise(resolve => {
      let done = false;
      const operation = { cancel: () => finish({ ok: false, stale: true }) };
      const finish = value => {
        if (done) return;
        done = true; clearTimeout(timer); pending.delete(operation); resolve(value);
      };
      const timer = setTimeout(() => finish({ ok: false, error: "timeout" }), REQUEST_MS);
      pending.add(operation);
      try {
        session.sdk[method](args, (result, error) => {
          if (version !== epoch || !current(version)) return finish({ ok: false, stale: true });
          if (error) return finish({ ok: false, expired: expiredErrors.has(error.error), error: "request" });
          const data = result?.data;
          const valid = data && typeof data === "object" && (method === "GetPlayerStatistics"
            ? Array.isArray(data.Statistics) : data.Data && typeof data.Data === "object" && !Array.isArray(data.Data));
          finish(valid ? { ok: true, data } : { ok: false, error: "response" });
        });
      } catch (_) { finish({ ok: false, error: "request" }); }
    });
  }

  async function load() {
    if (!current() || busy) return;
    const version = epoch, session = auth;
    busy = true; snapshot = null; loaded = false; checkedAt = 0;
    message = ""; kind = "info"; paint();
    const [stats, data] = await Promise.all([
      read("GetPlayerStatistics", { StatisticNames: [...names, payoutStat] }, version, session),
      read("GetUserData", { Keys: names.map(name => `Profile${name}`) }, version, session)
    ]);
    if (!current(version)) return;
    if (stats.expired || data.expired) {
      const callback = session.onExpired;
      unavailable("Your player login expired. Sign in again to read your statistics.");
      callback?.("Your player login expired. Sign in again.");
      return;
    }
    snapshot = normalize(stats, data);
    checkedAt = Date.now(); busy = false; loaded = true;
    if (!stats.ok && !data.ok) {
      message = "Couldn’t load your stats. Check your connection and try Refresh stats."; kind = "error";
    } else if (!snapshot.any) {
      message = "No construction stats are available yet."; kind = "info";
    } else {
      message = ""; kind = "info";
    }
    paint();
  }

  function stop() {
    epoch++; auth = null;
    [...pending].forEach(operation => operation.cancel());
    busy = loaded = false; snapshot = null; checkedAt = 0;
    message = "Sign in to view your saved construction performance."; kind = "info"; paint();
  }

  function unavailable(value) {
    stop(); message = value; kind = "error"; paint();
  }

  window.RoadimentaryStats = Object.freeze({
    init(options) {
      stop();
      if (typeof options?.sdk?.GetPlayerStatistics !== "function" || typeof options?.sdk?.GetUserData !== "function"
        || typeof options.currentId !== "string" || !options.currentId || !options.sessionTicket) {
        return unavailable("The player statistics service is not ready. Refresh the page and sign in again if needed.");
      }
      auth = { sdk: options.sdk, id: options.currentId, ticket: options.sessionTicket, onExpired: options.onExpired };
      if (!current()) return;
      message = ""; paint();
      if (visible()) void load();
    },
    open() { if (current() && !busy && (!loaded || Date.now() - checkedAt >= CACHE_MS)) void load(); },
    stop, unavailable, levelFor
  });
  document.addEventListener("visibilitychange", () => { if (auth) current(); });
  window.addEventListener("pageshow", () => { if (auth) current(); });
  paint();
})();
