/* Move the original button to the window edge. CSS owns the position. */
(() => {
  "use strict";
  let active = null;

  function release() {
    if (!active) return;
    const { button, windowElement, wrapper, next, dock } = active;
    active = null;
    const hadFocus = windowElement.contains(document.activeElement);
    wrapper.insertBefore(button, next?.parentNode === wrapper ? next : null);
    button.setAttribute("aria-expanded", "false");
    dock.remove();
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
    const slots = Array.from(rail.children).filter(child => child.classList.contains("bookmark-wrapper"));
    const index = slots.indexOf(wrapper);
    if (index < 0) return;

    const dock = document.createElement("div");
    dock.className = "window-bookmark-dock";
    dock.style.setProperty("--dock-slots", String(slots.length));
    dock.style.setProperty("--dock-column", String(index + 1));
    const hadFocus = document.activeElement === button;
    active = { button, wrapper, windowElement, next: button.nextSibling, dock };
    windowElement.classList.add("has-bookmark-dock");
    document.body.classList.add("has-docked-bookmark");
    windowElement.append(dock);
    dock.append(button);
    button.setAttribute("aria-expanded", "true");
    if (hadFocus) button.focus({ preventScroll: true });
  }

  window.RoadimentaryBookmarkDock = Object.freeze({ attach, release });
})();
