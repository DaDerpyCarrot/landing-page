/* ================================================================
   ROADIMENTARY MEDIA COMMAND CENTER

   Add, remove, or reorder entries in MEDIA_ITEMS to change both the
   desktop and mobile media windows. Videos use browser controls and
   do not preload their media bytes or autoplay.
   ================================================================ */

const MEDIA_ITEMS = [
  {
    id: "gameplay-trailer",
    type: "video",
    label: "Video 01",
    title: "Gameplay Trailer",
    caption: "See Roadimentary’s repair gameplay in motion. The screenshots alongside the trailer show the choices you make before and during a job.",
    src: "assets/Roadimentary-Trailer.mp4",
    poster: "assets/contractplan_img.png"
  },
  {
    id: "gameplay-image-01",
    type: "image",
    label: "Image 01",
    title: "Choose a Loadout",
    caption: "Check the job’s time and budget before you start. Here, the roller adds capacity, the crew helps with drainage, and the admixture adds durability.",
    src: "assets/contractplan_img.png",
    alt: "Contract loadout showing the Vibratory Roller, Comeback Crew, and A.W. Admixture"
  },
  {
    id: "gameplay-image-02",
    type: "image",
    label: "Image 02",
    title: "Crew at Work",
    caption: "This repair starts with cracked pavement. The checklist shows what to tackle first: remove the damaged surface before cleaning the cavity and placing aggregate.",
    src: "assets/crewatwork_img.png",
    alt: "Two beaver operators at a cracked section of road with the repair checklist open"
  },
  {
    id: "gameplay-image-03",
    type: "image",
    label: "Image 03",
    title: "Shop for Supplies",
    caption: "Crushed aggregate is priced by volume at the supplies depot. Choose how much base fill the cavity needs and check the total against your job budget.",
    src: "assets/IngameShop_img.png",
    alt: "Road Supplies Depot showing crushed aggregate, a quantity selector, and the total cost"
  },
  {
    id: "gameplay-image-04",
    type: "image",
    label: "Image 04",
    title: "Start the Repair",
    caption: "Use the checklist to choose the right tool for the current step. At this site, that means breaking up the damaged surface before preparing the cavity.",
    src: "assets/activesite_img.png",
    alt: "A beaver operator using a tool to remove damaged pavement"
  },
  {
    id: "gameplay-image-05",
    type: "image",
    label: "Image 05",
    title: "Contract Progress",
    caption: "The checklist separates required steps from optional ones. Check the time and budget before deciding whether to use treated material or focus on finishing the repair.",
    src: "assets/contractProgress_img.png",
    alt: "A partially repaired road and a checklist showing an optional treated-material objective"
  },
  {
    id: "gameplay-image-06",
    type: "image",
    label: "Image 06",
    title: "Assign Your Crew",
    caption: "Use the jobsite map to find repair locations, then check Crew Activity to see who’s available and where to assign them.",
    src: "assets/ingameCrew_img.png",
    alt: "Crew Activity panel with worker assignment buttons beside the jobsite map"
  }
];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function createVideoPlaceholder() {
  const preview = document.createElement("span");
  preview.className = "media-playlist-thumb media-playlist-thumb--video";
  preview.setAttribute("aria-hidden", "true");
  return preview;
}

function createImagePreview(item) {
  const preview = document.createElement("span");
  preview.className = "media-playlist-thumb";

  const image = document.createElement("img");
  image.src = item.src;
  image.alt = "";
  image.loading = "lazy";
  preview.append(image);
  return preview;
}

function openImageViewer(item) {
  const viewer = document.getElementById("screenshot-viewer");
  const viewerImage = document.getElementById("viewer-image");
  if (!viewer || !viewerImage) return;

  viewerImage.src = item.src;
  viewerImage.alt = item.alt;
  viewer.classList.add("active");
  document.body.classList.add("media-viewer-open");
}

function closeImageViewer() {
  const viewer = document.getElementById("screenshot-viewer");
  if (!viewer) return;
  viewer.classList.remove("active");
  document.body.classList.remove("media-viewer-open");
}

function initializeMediaCommandCenter(center) {
  const playlist = center.querySelector("[data-media-playlist]");
  const stage = center.querySelector("[data-media-stage]");
  const type = center.querySelector("[data-media-type]");
  const title = center.querySelector("[data-media-title]");
  const caption = center.querySelector("[data-media-caption]");
  const counter = center.querySelector("[data-media-counter]");
  const resultCount = center.querySelector("[data-media-result-count]");
  const previous = center.querySelector("[data-media-previous]");
  const next = center.querySelector("[data-media-next]");
  const expand = center.querySelector("[data-media-fullscreen]");
  const filters = [...center.querySelectorAll("[data-media-filter]")];

  if (!playlist || !stage || !previous || !next || !expand) return;

  let activeFilter = "all";
  let activeId = MEDIA_ITEMS[0]?.id;
  const desktopWindow = center.closest(".desktop-window");
  const mobilePanel = center.closest(".mobile-panel");
  const mobileSheet = center.closest(".mobile-bottom-sheet");
  const desktopLayout = window.matchMedia("(min-width: 1024px)");

  function pauseTrailer() { stage.querySelector("video")?.pause(); }
  function pauseWhenHidden() {
    const visible = desktopWindow ? desktopLayout.matches && desktopWindow.classList.contains("show")
      : !desktopLayout.matches && mobilePanel?.classList.contains("active") && mobileSheet?.classList.contains("open");
    if (!visible) pauseTrailer();
  }
  const visibilityObserver = new MutationObserver(pauseWhenHidden);
  [desktopWindow, mobilePanel, mobileSheet].filter(Boolean).forEach(node => {
    visibilityObserver.observe(node, { attributes: true, attributeFilter: ["class"] });
  });
  desktopLayout.addEventListener("change", pauseWhenHidden);
  window.addEventListener("pagehide", pauseTrailer);

  const visibleItems = () => MEDIA_ITEMS.filter((item) => {
    return activeFilter === "all" || item.type === activeFilter;
  });

  const activeItem = () => {
    const items = visibleItems();
    return items.find((item) => item.id === activeId) || items[0];
  };

  function animateStage() {
    stage.classList.remove("is-entering");
    if (reducedMotion.matches) return;
    void stage.offsetWidth;
    stage.classList.add("is-entering");
  }

  function updatePlaylistSelection() {
    playlist.querySelectorAll("[data-media-id]").forEach((button) => {
      const selected = button.dataset.mediaId === activeId;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-current", selected ? "true" : "false");
    });
  }

  function renderStage() {
    const item = activeItem();
    const items = visibleItems();
    pauseTrailer();
    stage.replaceChildren();

    if (!item) {
      const empty = document.createElement("p");
      empty.className = "media-empty-state";
      empty.textContent = "No media files in this category yet.";
      stage.append(empty);
      previous.disabled = true;
      next.disabled = true;
      expand.disabled = true;
      return;
    }

    activeId = item.id;

    if (item.type === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "none";
      video.poster = item.poster;
      video.setAttribute("aria-label", "Roadimentary " + item.title);
      const directLink = document.createElement("a");
      directLink.href = item.src;
      directLink.textContent = "Open the MP4 directly";
      video.append(directLink);
      video.addEventListener("error", () => {
        if (!stage.contains(video)) return;
        const notice = document.createElement("p");
        notice.className = "media-empty-state media-video-error";
        notice.append("The trailer couldn’t load here. ", directLink);
        stage.replaceChildren(notice);
        expand.disabled = true;
      });
      video.src = item.src;
      stage.append(video);
      expand.textContent = "Fullscreen";
    } else {
      const imageButton = document.createElement("button");
      imageButton.className = "media-stage-image-button";
      imageButton.type = "button";
      imageButton.setAttribute("aria-label", `Expand ${item.title}`);

      const image = document.createElement("img");
      image.src = item.src;
      image.alt = item.alt;
      imageButton.append(image);
      imageButton.addEventListener("click", () => openImageViewer(item));
      stage.append(imageButton);
      expand.textContent = "Expand";
    }

    const position = items.findIndex((entry) => entry.id === item.id);
    if (type) type.textContent = item.label;
    if (title) title.textContent = item.title;
    if (caption) caption.textContent = item.caption;
    if (counter) counter.textContent = `${position + 1} / ${items.length}`;
    previous.disabled = items.length < 2;
    next.disabled = items.length < 2;
    expand.disabled = false;
    updatePlaylistSelection();
    animateStage();
  }

  function chooseItem(itemId, shouldScroll = false) {
    if (activeId !== itemId) {
      activeId = itemId;
      renderStage();
    }

    if (shouldScroll) {
      const selected = playlist.querySelector(`[data-media-id="${CSS.escape(itemId)}"]`);
      selected?.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "nearest",
        inline: "nearest"
      });
    }
  }

  function renderPlaylist() {
    const items = visibleItems();
    playlist.replaceChildren();
    if (resultCount) {
      resultCount.textContent = `${items.length} ${items.length === 1 ? "Item" : "Items"}`;
    }

    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.className = "media-playlist-item";
      button.type = "button";
      button.dataset.mediaId = item.id;
      button.setAttribute("aria-label", `Open ${item.title}`);

      const preview = item.type === "video"
        ? createVideoPlaceholder()
        : createImagePreview(item);

      const copy = document.createElement("span");
      copy.className = "media-playlist-item-copy";

      const itemType = document.createElement("span");
      itemType.className = "media-playlist-item-type";
      itemType.textContent = item.label;

      const itemTitle = document.createElement("strong");
      itemTitle.className = "media-playlist-item-title";
      itemTitle.textContent = item.title;

      copy.append(itemType, itemTitle);
      button.append(preview, copy);
      button.addEventListener("click", () => chooseItem(item.id));
      playlist.append(button);
    });

    if (!items.some((item) => item.id === activeId)) {
      activeId = items[0]?.id;
    }
    renderStage();
  }

  function moveSelection(direction) {
    const items = visibleItems();
    if (items.length < 2) return;

    const currentIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
    const nextIndex = (currentIndex + direction + items.length) % items.length;
    chooseItem(items[nextIndex].id, true);
  }

  filters.forEach((filter) => {
    filter.addEventListener("click", () => {
      activeFilter = filter.dataset.mediaFilter;
      filters.forEach((button) => {
        const selected = button === filter;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
      });
      renderPlaylist();
    });
  });

  previous.addEventListener("click", () => moveSelection(-1));
  next.addEventListener("click", () => moveSelection(1));

  expand.addEventListener("click", async () => {
    const item = activeItem();
    if (!item) return;

    if (item.type === "image") {
      openImageViewer(item);
    } else {
      const video = stage.querySelector("video");
      if (!video) return;
      try {
        if (video.requestFullscreen) await video.requestFullscreen();
        else video.webkitEnterFullscreen?.();
      } catch (_) {
        // Fullscreen may be restricted; the native player remains usable inline.
      }
    }
  });

  center.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea, select, button, a, video")) return;
    if (event.key === "ArrowLeft") moveSelection(-1);
    if (event.key === "ArrowRight") moveSelection(1);
  });

  renderPlaylist();

  const homeTrailer = document.querySelector(center.dataset.mediaContext === "mobile"
    ? '[data-home-trailer="mobile"]' : '[data-home-trailer="desktop"]');
  homeTrailer?.addEventListener("click", () => {
    if (mobilePanel) openMobileSheet(mobilePanel.id, { trigger: homeTrailer });
    else if (desktopWindow) openWindow(desktopWindow);
    // If the visitor left Media on screenshots, switch back to a filter that
    // includes the trailer. Opening the player does not start playback.
    if (activeFilter === "image") filters.find(filter => filter.dataset.mediaFilter === "video")?.click();
    chooseItem("gameplay-trailer");
    stage.querySelector("video")?.focus({ preventScroll: true });
  });
}

document.querySelectorAll("[data-media-command-center]").forEach(initializeMediaCommandCenter);

const screenshotViewer = document.getElementById("screenshot-viewer");
screenshotViewer?.addEventListener("click", closeImageViewer);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeImageViewer();
});
