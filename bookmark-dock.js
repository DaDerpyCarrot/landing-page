/* Dock the original button without adding a row to the popup's layout. */
(() => {
  "use strict";
  let active = null;
  const exits = new Map();

  function updateDockLayer() {
    document.body.classList.toggle("has-docked-bookmark", Boolean(active || exits.size));
  }

  function release(keepDock = false) {
    if (!active) return;
    const { button, windowElement, home, inlineStyle, stopAligning } = active;
    active = null;
    stopAligning();
    const hadFocus = windowElement.contains(document.activeElement);
    if (inlineStyle === null) button.removeAttribute("style");
    else button.setAttribute("style", inlineStyle);
    home.replaceWith(button);
    button.setAttribute("aria-expanded", "false");
    if (!keepDock) windowElement.classList.remove("has-bookmark-dock");
    updateDockLayer();
    if (hadFocus) button.focus({ preventScroll: true });
  }

  function close(windowElement) {
    if (!windowElement.classList.contains("show")) return;
    let finish;
    if (active?.windowElement === windowElement) {
      const button = active.button;
      // Leave a visual-only bookmark with the exit animation. The real
      // button returns to the rail immediately so it can receive focus.
      const visual = button.cloneNode(true);
      for (const attr of ["id", "data-window", "aria-controls", "aria-expanded"]) visual.removeAttribute(attr);
      visual.setAttribute("aria-hidden", "true");
      visual.inert = true;
      visual.style.pointerEvents = "none";
      windowElement.append(visual);
      button.classList.add("bookmark-returning");
      finish = () => {
        if (exits.get(windowElement) !== finish) return;
        exits.delete(windowElement);
        visual.remove();
        button.classList.remove("bookmark-returning");
        windowElement.classList.remove("has-bookmark-dock");
        updateDockLayer();
      };
      exits.set(windowElement, finish);
      release(true);
    }
    windowElement.inert = true;
    windowElement.classList.remove("show");
    if (!finish) return;
    // Resolve CSS transitions after the class change. Cancellation (rapid
    // reopen, resize, reduced motion) must clean up the visual copy too.
    void getComputedStyle(windowElement).opacity;
    if (typeof windowElement.getAnimations !== "function") {
      setTimeout(finish, 460);
      return;
    }
    const animations = windowElement.getAnimations().filter(animation =>
      ["opacity", "transform", "visibility"].includes(animation.transitionProperty));
    if (animations.length) void Promise.allSettled(animations.map(animation => animation.finished)).then(finish);
    else finish();
  }

  function attach(windowElement, button) {
    exits.get(windowElement)?.();
    if (active?.windowElement === windowElement && active.button === button) return;
    release();
    const wrapper = button?.closest(".bookmark-wrapper");
    const rail = wrapper?.parentElement;
    if (!rail || !windowElement) return;
    const hadFocus = document.activeElement === button;
    // The hidden copy occupies exactly the original slot, even if the rail's
    // spacing or a bookmark's width changes at a breakpoint.
    const home = button.cloneNode(true);
    for (const attr of ["id", "data-window", "aria-controls", "aria-expanded"]) home.removeAttribute(attr);
    home.setAttribute("aria-hidden", "true");
    home.tabIndex = -1;
    home.inert = true;
    home.style.visibility = "hidden";
    home.style.pointerEvents = "none";

    const inlineStyle = button.getAttribute("style");
    const state = active = { button, windowElement, home, inlineStyle, stopAligning: () => {} };
    // Set the essential placement on the button itself. An older cached
    // stylesheet must not turn the bookmark into an in-flow flex row.
    Object.assign(button.style, { position: "absolute", top: "calc(100% - 6px)",
      zIndex: "1", maxWidth: "none", pointerEvents: "auto" });
    windowElement.classList.add("has-bookmark-dock");
    updateDockLayer();
    button.replaceWith(home);
    windowElement.append(button);
    button.setAttribute("aria-expanded", "true");

    function align() {
      if (active !== state) return;
      const slot = home.getBoundingClientRect();
      const popup = windowElement.getBoundingClientRect();
      if (!slot.width || !popup.width) return;
      // Measure only the stable horizontal slot. The vertical attachment
      // stays relative to the popup's bottom edge through layout changes.
      button.style.left = `${slot.left - popup.left - windowElement.clientLeft}px`;
      button.style.width = `${slot.width}px`;
    }
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(align) : null;
    [home, rail, windowElement].forEach(element => observer?.observe(element));
    window.addEventListener("resize", align);
    window.visualViewport?.addEventListener("resize", align);
    state.stopAligning = () => {
      observer?.disconnect();
      window.removeEventListener("resize", align);
      window.visualViewport?.removeEventListener("resize", align);
    };
    align();
    if (hadFocus) button.focus({ preventScroll: true });
  }

  window.RoadimentaryBookmarkDock = Object.freeze({ attach, close });
})();
