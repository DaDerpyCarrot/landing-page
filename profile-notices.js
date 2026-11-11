/* Counts only received requests/invitations; no private data or polling is stored here. */
(() => {
  "use strict";
  let ticket = null;
  const counts = { friends: null, companies: null };
  const current = () => ticket && sessionStorage.getItem("pfSessionTicket") === ticket;
  function render() {
    const valid = current();
    for (const badge of document.querySelectorAll("[data-pending-badge]")) {
      const type = badge.dataset.pendingBadge;
      const sources = type === "all" ? Object.values(counts) : [counts[type]];
      const total = valid ? sources.reduce((sum, source) => sum + (source?.count || 0), 0) : 0;
      const partial = sources.some(source => !source || source.more);
      const value = total ? (total > 99 ? "99+" : String(total) + (partial ? "+" : "")) : "";
      badge.textContent = value;
      badge.hidden = !total;
      const button = badge.closest("button");
      if (!button || button.getAttribute("aria-hidden") === "true") continue;
      const base = type === "all" ? (button.classList.contains("mobile-office-tab") ? "Open Crew" : "Crew")
        : type === "friends" ? "Friends & messages" : "Companies";
      const noun = type === "friends" ? (total === 1 ? "friend request" : "friend requests")
        : type === "companies" ? (total === 1 ? "Company invitation" : "Company invitations")
        : total === 1 ? "request or invitation" : "requests or invitations";
      button.setAttribute("aria-label", base + (total ? `, ${partial ? "at least " : ""}${total} pending ${noun}` : ""));
    }
  }
  function clear(source) { if (Object.hasOwn(counts, source)) counts[source] = null; render(); }
  function stop() { ticket = null; counts.friends = counts.companies = null; render(); }
  window.RoadimentaryNotices = Object.freeze({
    init(value) { stop(); if (value && sessionStorage.getItem("pfSessionTicket") === value) ticket = value; render(); },
    set(source, count, more, session) {
      if (!current() || session !== ticket || !Object.hasOwn(counts, source) || !Number.isSafeInteger(count) || count < 0) return;
      counts[source] = { count, more: Boolean(more) }; render();
    }, clear, render, stop
  });
  document.addEventListener("visibilitychange", () => { if (ticket && !current()) stop(); });
  window.addEventListener("storage", () => { if (ticket && !current()) stop(); });
  window.addEventListener("pageshow", () => { if (ticket && !current()) stop(); });
})();
