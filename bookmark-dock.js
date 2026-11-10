/* Dock the original button without adding a row to the popup's layout. */
(() => {
  "use strict";
  let active = null;

  function release() {
    if (!active) return;
    const { button, windowElement, home, inlineStyle, stopAligning } = active;
    active = null;
    stopAligning();
    const hadFocus = windowElement.contains(document.activeElement);
    if (inlineStyle === null) button.removeAttribute("style");
    else button.setAttribute("style", inlineStyle);
    home.replaceWith(button);
    button.setAttribute("aria-expanded", "false");
    windowElement.classList.remove("has-bookmark-dock");
    document.body.classList.remove("has-docked-bookmark");
    if (hadFocus) button.focus({ preventScroll: true });
  }

  function attach(windowElement, button) {
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
    document.body.classList.add("has-docked-bookmark");
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

  window.RoadimentaryBookmarkDock = Object.freeze({ attach, release });
})();
