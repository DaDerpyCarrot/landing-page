/* ================================================================
   ROADIMENTARY MEDIA COMMAND CENTER

   Add, remove, or reorder entries in MEDIA_ITEMS to change both the
   desktop and mobile media windows. Only the selected video is loaded,
   which keeps additional YouTube entries from slowing the page down.
   ================================================================ */

const MEDIA_ITEMS = [
  {
    id: "gameplay-trailer",
    type: "video",
    label: "Video 01",
    title: "Gameplay Trailer",
    caption: "Gameplay footage and development highlights from Roadimentary.",
    youtubeId: "VIDEO_ID"
  },
  {
    id: "gameplay-image-01",
    type: "image",
    label: "Image 01",
    title: "Planning the Next Job",
    caption: "A look at the planning tools used before the crew heads into the field.",
    src: "assets/sample1.png",
    alt: "Roadimentary gameplay screenshot showing the planning interface"
  },
  {
    id: "gameplay-image-02",
    type: "image",
    label: "Image 02",
    title: "Crew at Work",
    caption: "The construction crew gets to work on a new section of road.",
    src: "assets/sample2.png",
    alt: "Roadimentary gameplay screenshot showing a construction crew"
  },
  {
    id: "gameplay-image-03",
    type: "image",
    label: "Image 03",
    title: "Material Management",
    caption: "Choosing the right materials is part of every successful contract.",
    src: "assets/sample3.png",
    alt: "Roadimentary gameplay screenshot showing construction materials"
  },
  {
    id: "gameplay-image-04",
    type: "image",
    label: "Image 04",
    title: "On the Road",
    caption: "A field view from one of Roadimentary's active construction sites.",
    src: "assets/sample4.png",
    alt: "Roadimentary gameplay screenshot showing an active road site"
  },
  {
    id: "gameplay-image-05",
    type: "image",
    label: "Image 05",
    title: "Contract Progress",
    caption: "Track the job, adapt the plan, and keep the project moving forward.",
    src: "assets/sample5.png",
    alt: "Roadimentary gameplay screenshot showing contract progress"
  },
  {
    id: "gameplay-image-06",
    type: "image",
    label: "Image 06",
    title: "Meet the Crew",
    caption: "Every beaver brings a different strength to the construction team.",
    src: "assets/sample6.png",
    alt: "Roadimentary gameplay screenshot showing the beaver crew"
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
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(item.youtubeId)}`;
      iframe.title = item.title;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      stage.append(iframe);
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
    activeId = itemId;
    renderStage();

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

  expand.addEventListener("click", () => {
    const item = activeItem();
    if (!item) return;

    if (item.type === "image") {
      openImageViewer(item);
    } else if (stage.requestFullscreen) {
      stage.requestFullscreen();
    }
  });

  center.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea, select, button, a, iframe")) return;
    if (event.key === "ArrowLeft") moveSelection(-1);
    if (event.key === "ArrowRight") moveSelection(1);
  });

  renderPlaylist();
}

document.querySelectorAll("[data-media-command-center]").forEach(initializeMediaCommandCenter);

const screenshotViewer = document.getElementById("screenshot-viewer");
screenshotViewer?.addEventListener("click", closeImageViewer);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeImageViewer();
});
