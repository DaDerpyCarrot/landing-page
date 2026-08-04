(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum);

  const routeControllers = [];

  function createRouteController({
    scope,
    root,
    track,
    cardSelector,
    progressProperty,
  }) {
    if (!scope || !root || !track) return null;

    const cards = Array.from(track.querySelectorAll(cardSelector));
    if (!cards.length) return null;

    let frameRequested = false;

    function showEverythingWithoutMotion() {
      track.style.setProperty(progressProperty, "100%");
      track.classList.add("route-complete");

      cards.forEach((card) => {
        card.classList.add("is-visible", "is-complete");
        card.classList.remove("is-active");
      });
    }

    function update() {
      frameRequested = false;

      if (reduceMotion.matches) {
        showEverythingWithoutMotion();
        return;
      }

      const rootRect = root.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();

      if (
        rootRect.width === 0 ||
        rootRect.height === 0 ||
        trackRect.width === 0 ||
        trackRect.height === 0
      ) {
        return;
      }

      const progressStart = rootRect.top + rootRect.height * 0.68;
      const progressDistance = Math.max(
        trackRect.height - rootRect.height * 0.2,
        1
      );
      const progress = clamp(
        (progressStart - trackRect.top) / progressDistance,
        0,
        1
      );

      track.style.setProperty(
        progressProperty,
        `${(progress * 100).toFixed(2)}%`
      );

      const revealLine = rootRect.top + rootRect.height * 0.88;
      const activeLine = rootRect.top + rootRect.height * 0.56;
      let activeIndex = -1;

      cards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();

        if (cardRect.top < revealLine && cardRect.bottom > rootRect.top) {
          card.classList.add("is-visible");
        }

        if (cardRect.top <= activeLine) {
          activeIndex = index;
        }
      });

      if (activeIndex < 0 && progress > 0.02) {
        activeIndex = 0;
      }

      const routeComplete = progress >= 0.985;
      track.classList.toggle("route-complete", routeComplete);

      cards.forEach((card, index) => {
        const complete = routeComplete || index < activeIndex;
        const active = !routeComplete && index === activeIndex;

        card.classList.toggle("is-complete", complete);
        card.classList.toggle("is-active", active);
      });
    }

    function scheduleUpdate() {
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(update);
    }

    scope.classList.add("route-animation-ready");
    root.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });

    const visibilityObserver = new MutationObserver(scheduleUpdate);
    visibilityObserver.observe(scope, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    scheduleUpdate();

    return {
      update: scheduleUpdate,
      destroy() {
        root.removeEventListener("scroll", scheduleUpdate);
        window.removeEventListener("resize", scheduleUpdate);
        visibilityObserver.disconnect();
      },
    };
  }

  function enablePointerTilt() {
    if (reduceMotion.matches || !finePointer.matches) return;

    const frames = document.querySelectorAll(
      "#win-features .feature-preview-image"
    );

    frames.forEach((frame) => {
      let tiltFrame = 0;

      frame.addEventListener("pointermove", (event) => {
        if (tiltFrame) window.cancelAnimationFrame(tiltFrame);

        tiltFrame = window.requestAnimationFrame(() => {
          const bounds = frame.getBoundingClientRect();
          const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
          const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;

          frame.style.setProperty(
            "--route-tilt-x",
            `${(-vertical * 5).toFixed(2)}deg`
          );
          frame.style.setProperty(
            "--route-tilt-y",
            `${(horizontal * 6).toFixed(2)}deg`
          );
        });
      });

      frame.addEventListener("pointerleave", () => {
        if (tiltFrame) window.cancelAnimationFrame(tiltFrame);
        frame.style.setProperty("--route-tilt-x", "0deg");
        frame.style.setProperty("--route-tilt-y", "0deg");
      });
    });
  }

  function initializeRoutes() {
    routeControllers.push(
      createRouteController({
        scope: document.querySelector("#win-features"),
        root: document.querySelector("#win-features .win-content"),
        track: document.querySelector("#win-features .features-grid"),
        cardSelector: ".feature-card",
        progressProperty: "--route-progress",
      })
    );

    routeControllers.push(
      createRouteController({
        scope: document.querySelector(".mobile-panel#features"),
        root: document.querySelector(".mobile-tab-content"),
        track: document.querySelector(
          ".mobile-panel#features .mobile-feature-list"
        ),
        cardSelector: ".mobile-feature-card",
        progressProperty: "--mobile-route-progress",
      })
    );

    enablePointerTilt();

    document.addEventListener("click", () => {
      routeControllers.forEach((controller) => controller?.update());
      window.setTimeout(() => {
        routeControllers.forEach((controller) => controller?.update());
      }, 460);
    });

    reduceMotion.addEventListener("change", () => {
      routeControllers.forEach((controller) => controller?.update());
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeRoutes, {
      once: true,
    });
  } else {
    initializeRoutes();
  }
})();
