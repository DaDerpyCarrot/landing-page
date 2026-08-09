const PLAYFAB_TITLE_ID = "1E22BA";
const PASSWORD_RECOVERY_TEMPLATE_ID = "774566C3D66B63D3";

/* ==========================================================
   OPERATOR FIELD OFFICE WINDOW CONTROLS
   ========================================================== */

const desktopBookmarks = document.querySelectorAll(".profile-bookmark");
const desktopWindows = document.querySelectorAll(".profile-office-window");
const bookmarkWrappers = document.querySelectorAll(".profile-bookmark-container .bookmark-wrapper");
const officeOverlay = document.getElementById("overlay");
const desktopMedia = window.matchMedia("(min-width: 1024px)");

let currentWindow = null;

function getBookmarkForWindow(windowId) {
  return document.querySelector(`.profile-bookmark[data-window="${windowId}"]`);
}

function setBookmarkDrop(wrapper, win) {
  if (!wrapper || !win || !desktopMedia.matches) return;

  wrapper.style.setProperty("--drop-distance", "0px");

  const wrapperTop = wrapper.getBoundingClientRect().top;
  const windowTop = parseFloat(getComputedStyle(win).top) || 0;
  const targetTop = windowTop + win.offsetHeight - 6;
  const distance = Math.max(0, targetTop - wrapperTop);

  wrapper.style.setProperty("--drop-distance", `${distance}px`);
}

function clearDesktopWindowState() {
  bookmarkWrappers.forEach(wrapper => {
    wrapper.classList.remove("active");
    wrapper.style.setProperty("--drop-distance", "0px");
  });

  desktopBookmarks.forEach(bookmark => bookmark.setAttribute("aria-expanded", "false"));
}

function openOfficeWindow(win, wrapper = null) {
  if (!win || !desktopMedia.matches) return;

  if (currentWindow && currentWindow !== win) {
    currentWindow.classList.remove("show");
    currentWindow.setAttribute("aria-hidden", "true");
  }

  clearDesktopWindowState();

  win.classList.add("show");
  win.setAttribute("aria-hidden", "false");
  officeOverlay?.classList.add("show");

  const bookmark = getBookmarkForWindow(win.id);
  const activeWrapper = wrapper || bookmark?.closest(".bookmark-wrapper");

  if (bookmark) bookmark.setAttribute("aria-expanded", "true");
  if (activeWrapper) {
    activeWrapper.classList.add("active");
    requestAnimationFrame(() => setBookmarkDrop(activeWrapper, win));
  }

  currentWindow = win;
}

function closeOfficeWindow(win = currentWindow) {
  if (!win) return;

  win.classList.remove("show");
  win.setAttribute("aria-hidden", "true");
  clearDesktopWindowState();
  officeOverlay?.classList.remove("show");
  currentWindow = null;
}

desktopBookmarks.forEach(bookmark => {
  bookmark.addEventListener("click", () => {
    const targetWindow = document.getElementById(bookmark.dataset.window);
    const wrapper = bookmark.closest(".bookmark-wrapper");

    if (currentWindow === targetWindow) {
      closeOfficeWindow(targetWindow);
    } else {
      openOfficeWindow(targetWindow, wrapper);
    }
  });
});

desktopWindows.forEach(win => {
  const closeButton = win.querySelector(".win-close");
  closeButton?.addEventListener("click", () => closeOfficeWindow(win));
});

document.querySelectorAll("[data-open-window]").forEach(button => {
  button.addEventListener("click", () => {
    const targetWindow = document.getElementById(button.dataset.openWindow);
    openOfficeWindow(targetWindow);
  });
});

officeOverlay?.addEventListener("click", () => closeOfficeWindow());

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && currentWindow) closeOfficeWindow();
});

window.addEventListener("resize", () => {
  if (!desktopMedia.matches) {
    if (currentWindow) closeOfficeWindow();
    return;
  }

  if (currentWindow) {
    const activeWrapper = document.querySelector(".profile-bookmark-container .bookmark-wrapper.active");
    setBookmarkDrop(activeWrapper, currentWindow);
  }
});

/* ==========================================================
   MOBILE OFFICE FILE TABS
   ========================================================== */

const mobileTabs = document.querySelectorAll(".mobile-office-tab");
const mobilePanels = document.querySelectorAll(".mobile-office-panel");

mobileTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const targetPanel = document.getElementById(tab.dataset.profileTab);
    if (!targetPanel) return;

    mobileTabs.forEach(item => {
      const isActive = item === tab;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    mobilePanels.forEach(panel => panel.classList.toggle("active", panel === targetPanel));
    targetPanel.focus({ preventScroll: true });
  });
});

/* ==========================================================
   PROFILE DATA HELPERS
   ========================================================== */

const sessionTicket = sessionStorage.getItem("pfSessionTicket");
const savedEmail = sessionStorage.getItem("pfEmail");

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function formatDate(rawDate) {
  if (!rawDate) return "—";

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function setStatus(message) {
  setText("mobile-profile-status", message);
  setText("desktop-profile-status", message);
}

function getInitial(value) {
  const normalized = String(value || "R").trim();
  return (normalized.charAt(0) || "R").toUpperCase();
}

function setProfileName(value) {
  const displayName = value || "Road Operator";
  setText("mobile-profile-displayname", displayName);
  setText("desktop-profile-displayname", displayName);
  setText("mobile-profile-initial", getInitial(displayName));
  setText("desktop-profile-initial", getInitial(displayName));
}

function updateBioCount(inputId, countId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  setText(countId, `${input.value.length} / 180`);
}

function setBio(value) {
  const bio = value || "";
  const preview = bio || "No operator note filed yet.";

  setInputValue("mobile-profile-bio", bio);
  setInputValue("desktop-profile-bio", bio);
  setText("mobile-profile-bio-preview", preview);
  setText("desktop-profile-bio-preview", preview);
  updateBioCount("mobile-profile-bio", "mobile-bio-count");
  updateBioCount("desktop-profile-bio", "desktop-bio-count");
}

function setDisplayNameFields(value) {
  setInputValue("mobile-displayname-input", value || "");
  setInputValue("desktop-displayname-input", value || "");
}

function setPlaceholderStatistics() {
  [
    "mobile-profile-contracts",
    "desktop-profile-contracts",
    "mobile-profile-earnings",
    "desktop-profile-earnings",
    "mobile-profile-level",
    "desktop-profile-level",
    "mobile-profile-roadscore",
    "desktop-profile-roadscore"
  ].forEach(id => setText(id, "—"));
}

[
  ["mobile-profile-bio", "mobile-bio-count"],
  ["desktop-profile-bio", "desktop-bio-count"]
].forEach(([inputId, countId]) => {
  document.getElementById(inputId)?.addEventListener("input", () => updateBioCount(inputId, countId));
});

/* ==========================================================
   PLAYFAB PROFILE LOADING
   ========================================================== */

function loadBio() {
  PlayFabClientSDK.GetUserData(
    { Keys: ["bio"] },
    function (result, error) {
      if (error) {
        console.error("GetUserData error:", error);
        setBio("");
        setStatus("Operator file loaded, but the bio could not be retrieved.");
        return;
      }

      const bio = result.data?.Data?.bio?.Value || "";
      setBio(bio);
      setStatus("Operator file ready.");
    }
  );
}

function loadProfile() {
  setStatus("Loading operator file...");
  setPlaceholderStatistics();

  setText("mobile-profile-email", savedEmail || "—");
  setText("desktop-profile-email", savedEmail || "—");

  PlayFabClientSDK.GetAccountInfo({}, function (result, error) {
    if (error) {
      console.error("GetAccountInfo error:", error);
      setStatus(error.errorMessage || "The operator file could not be loaded.");
      return;
    }

    const accountInfo = result.data?.AccountInfo || {};
    const fallbackUsername = savedEmail ? savedEmail.split("@")[0] : "—";
    const playFabId = accountInfo.PlayFabId || "—";
    const username = accountInfo.Username || fallbackUsername;
    const displayName = accountInfo.TitleInfo?.DisplayName || username || "Road Operator";
    const createdRaw =
      accountInfo.Created ||
      accountInfo.TitleInfo?.Created ||
      accountInfo.PrivateInfo?.Created ||
      "";

    const created = formatDate(createdRaw);

    setText("mobile-profile-playfabid", playFabId);
    setText("desktop-profile-playfabid", playFabId);
    setText("mobile-profile-username", username);
    setText("desktop-profile-username", username);
    setText("mobile-profile-created", created);
    setText("desktop-profile-created", created);
    setProfileName(displayName);
    setDisplayNameFields(displayName);

    loadBio();
  });
}

function startProfileSession() {
  if (!sessionTicket) {
    window.location.replace("index.html");
    return;
  }

  if (typeof PlayFab === "undefined" || typeof PlayFabClientSDK === "undefined") {
    setStatus("The profile service did not load. Please refresh the page.");
    return;
  }

  PlayFab.settings.titleId = PLAYFAB_TITLE_ID;
  PlayFab._internalSettings.sessionTicket = sessionTicket;
  loadProfile();
}

/* ==========================================================
   PROFILE CUSTOMIZATION
   ========================================================== */

function handleDisplayNameUpdate(inputId, button) {
  const newName = getInputValue(inputId);

  if (!newName) {
    setStatus("Please enter a display name.");
    return;
  }

  if (newName.length < 3) {
    setStatus("Display name must be at least 3 characters.");
    return;
  }

  button.disabled = true;
  setStatus("Updating display name...");

  PlayFabClientSDK.UpdateUserTitleDisplayName(
    { DisplayName: newName },
    function (result, error) {
      button.disabled = false;

      if (error) {
        console.error("Display name update error:", error);
        setStatus(error.errorMessage || "The display name could not be updated.");
        return;
      }

      const updatedName = result.data?.DisplayName || newName;
      setProfileName(updatedName);
      setDisplayNameFields(updatedName);
      setStatus("Display name updated successfully.");
    }
  );
}

function handleBioSave(inputId, button) {
  const bio = getInputValue(inputId);

  button.disabled = true;
  setStatus("Saving operator bio...");

  PlayFabClientSDK.UpdateUserData(
    {
      Data: { bio },
      Permission: "Private"
    },
    function (result, error) {
      button.disabled = false;

      if (error) {
        console.error("Bio save error:", error);
        setStatus(error.errorMessage || "The operator bio could not be saved.");
        return;
      }

      setBio(bio);
      setStatus("Operator bio saved successfully.");
    }
  );
}

[
  ["mobile-save-displayname-btn", "mobile-displayname-input"],
  ["desktop-save-displayname-btn", "desktop-displayname-input"]
].forEach(([buttonId, inputId]) => {
  const button = document.getElementById(buttonId);
  button?.addEventListener("click", () => handleDisplayNameUpdate(inputId, button));
});

[
  ["mobile-save-bio-btn", "mobile-profile-bio"],
  ["desktop-save-bio-btn", "desktop-profile-bio"]
].forEach(([buttonId, inputId]) => {
  const button = document.getElementById(buttonId);
  button?.addEventListener("click", () => handleBioSave(inputId, button));
});

/* ==========================================================
   ACCOUNT ACTIONS
   ========================================================== */

function handleSendReset(button) {
  if (!savedEmail) {
    setStatus("No account email was found for this session.");
    return;
  }

  button.disabled = true;
  setStatus("Sending password reset email...");

  PlayFabClientSDK.SendAccountRecoveryEmail(
    {
      TitleId: PLAYFAB_TITLE_ID,
      Email: savedEmail,
      EmailTemplateId: PASSWORD_RECOVERY_TEMPLATE_ID
    },
    function (result, error) {
      button.disabled = false;

      if (error) {
        console.error("Recovery email error:", error);
        setStatus(error.errorMessage || "The password reset email could not be sent.");
        return;
      }

      setStatus("Password reset email sent. Please check your inbox.");
    }
  );
}

["mobile-send-reset-btn", "desktop-send-reset-btn"].forEach(buttonId => {
  const button = document.getElementById(buttonId);
  button?.addEventListener("click", () => handleSendReset(button));
});

function handleLogout() {
  sessionStorage.removeItem("pfSessionTicket");
  sessionStorage.removeItem("pfPlayFabId");
  sessionStorage.removeItem("pfEmail");
  window.location.replace("index.html");
}

["mobile-logout-btn", "desktop-logout-btn"].forEach(buttonId => {
  document.getElementById(buttonId)?.addEventListener("click", handleLogout);
});

/* ==========================================================
   STARTUP
   ========================================================== */

setBio("");

if (desktopMedia.matches) {
  requestAnimationFrame(() => {
    const overviewWindow = document.getElementById("win-profile-overview");
    openOfficeWindow(overviewWindow);
  });
}

startProfileSession();
