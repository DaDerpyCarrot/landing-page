const PLAYFAB_TITLE_ID = "1E22BA";
const PASSWORD_RECOVERY_TEMPLATE_ID = "774566C3D66B63D3";

PlayFab.settings.titleId = PLAYFAB_TITLE_ID;

/* ================= DESKTOP WINDOW LOGIC ================= */

const bookmarks = document.querySelectorAll(".bookmark");
const windows = document.querySelectorAll(".desktop-window");
const wrappers = document.querySelectorAll(".bookmark-wrapper");
const overlay = document.getElementById("overlay");

let currentWindow = null;

/* ================= BOOKMARK DROP LOGIC ================= */

function setBookmarkDrop(wrapper, win) {
  if (!wrapper || !win) return;

  wrapper.style.setProperty("--drop-distance", "0px");

  const wrapperRect = wrapper.getBoundingClientRect();
  const wrapperTop = wrapperRect.top;
  const overlap = 6;

  const winTop = parseFloat(getComputedStyle(win).top) || 0;
  const winHeight = win.offsetHeight;
  const winBottom = winTop + winHeight;

  const targetTop = winBottom - overlap;
  const distance = targetTop - wrapperTop;

  wrapper.style.setProperty("--drop-distance", `${distance}px`);
}

/* ================= CORE WINDOW LOGIC ================= */

function openWindow(win, wrapper = null) {
  if (!win) return;

  if (currentWindow && currentWindow !== win) {
    closeWindow(currentWindow);
  }

  win.classList.add("show");

  if (overlay) {
    overlay.classList.add("show");
  }

  wrappers.forEach(w => {
    w.classList.remove("active");
    w.style.setProperty("--drop-distance", "0px");
  });

  if (wrapper) {
    wrapper.classList.add("active");

    requestAnimationFrame(() => {
      setBookmarkDrop(wrapper, win);
    });
  }

  currentWindow = win;
}

function closeWindow(win) {
  if (!win) return;

  win.classList.remove("show");

  wrappers.forEach(w => {
    w.classList.remove("active");
    w.style.setProperty("--drop-distance", "0px");
  });

  if (overlay) {
    overlay.classList.remove("show");
  }

  currentWindow = null;
}

/* ================= BOOKMARK WINDOWS ================= */

bookmarks.forEach(bookmark => {
  bookmark.addEventListener("click", () => {
    const win = document.getElementById(bookmark.dataset.window);
    const wrapper = bookmark.closest(".bookmark-wrapper");

    if (currentWindow === win) {
      closeWindow(win);
    } else {
      openWindow(win, wrapper);
    }
  });
});

windows.forEach(win => {
  const closeBtn = win.querySelector(".win-close");
  if (!closeBtn) return;

  closeBtn.addEventListener("click", () => {
    closeWindow(win);
  });
});

if (overlay) {
  overlay.addEventListener("click", () => {
    if (currentWindow) {
      closeWindow(currentWindow);
    }
  });
}

window.addEventListener("resize", () => {
  if (!currentWindow) return;

  const activeWrapper = document.querySelector(".bookmark-wrapper.active");
  if (activeWrapper) {
    setBookmarkDrop(activeWrapper, currentWindow);
  }
});

/* ================= PROFILE HELPERS ================= */

const sessionTicket = sessionStorage.getItem("pfSessionTicket");
const savedEmail = sessionStorage.getItem("pfEmail");

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function formatDate(rawDate) {
  if (!rawDate) return "-";

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return "-";

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

function setBio(value) {
  setInputValue("mobile-profile-bio", value || "");
  setInputValue("desktop-profile-bio", value || "");
}

function setDisplayNameFields(value) {
  setInputValue("mobile-displayname-input", value || "");
  setInputValue("desktop-displayname-input", value || "");
}

/* ================= PLAYFAB PROFILE DATA ================= */

if (!sessionTicket) {
  window.location.href = "index.html";
} else {
  PlayFab._internalSettings.sessionTicket = sessionTicket;

  loadProfile();
}

function loadProfile() {
  setStatus("Loading profile...");

  setText("mobile-profile-email", savedEmail || "-");
  setText("desktop-profile-email", savedEmail || "-");

  PlayFabClientSDK.GetAccountInfo({}, function (result, error) {
    if (error) {
      console.error(error);
      setStatus(error.errorMessage || "Failed to load profile.");
      return;
    }

    const accountInfo = result.data?.AccountInfo || {};
    const playfabId = accountInfo.PlayFabId || "-";
    const username = accountInfo.Username || "-";
    const displayName = accountInfo.TitleInfo?.DisplayName || username || "-";

    const createdRaw =
      accountInfo.Created ||
      accountInfo.TitleInfo?.Created ||
      accountInfo.PrivateInfo?.Created ||
      "";

    const created = formatDate(createdRaw);

    setText("mobile-profile-playfabid", playfabId);
    setText("desktop-profile-playfabid", playfabId);

    setText("mobile-profile-username", username);
    setText("desktop-profile-username", username);

    setText("mobile-profile-displayname", displayName);
    setText("desktop-profile-displayname", displayName);

    setText("mobile-profile-created", created);
    setText("desktop-profile-created", created);

    setDisplayNameFields(displayName);

    setText("mobile-profile-contracts", "--");
    setText("desktop-profile-contracts", "--");

    setText("mobile-profile-earnings", "--");
    setText("desktop-profile-earnings", "--");

    setText("mobile-profile-level", "--");
    setText("mobile-profile-roadscore", "--");

    loadBio();
  });
}

function loadBio() {
  PlayFabClientSDK.GetUserData(
    {
      Keys: ["bio"]
    },
    function (result, error) {
      if (error) {
        console.error("GetUserData error:", error);
        setBio("");
        setStatus("Profile loaded, but bio could not be loaded.");
        return;
      }

      const bio = result.data?.Data?.bio?.Value || "";
      setBio(bio);
      setStatus("Profile loaded.");
    }
  );
}

/* ================= PROFILE CUSTOMIZATION ================= */

const mobileSaveDisplayNameBtn = document.getElementById("mobile-save-displayname-btn");
const desktopSaveDisplayNameBtn = document.getElementById("desktop-save-displayname-btn");

const mobileSaveBioBtn = document.getElementById("mobile-save-bio-btn");
const desktopSaveBioBtn = document.getElementById("desktop-save-bio-btn");

function handleDisplayNameUpdate(inputId, buttonEl) {
  const newName = getInputValue(inputId);

  if (!newName) {
    setStatus("Please enter a display name.");
    return;
  }

  if (newName.length < 3) {
    setStatus("Display name must be at least 3 characters.");
    return;
  }

  buttonEl.disabled = true;
  setStatus("Updating display name...");

  PlayFabClientSDK.UpdateUserTitleDisplayName(
    {
      DisplayName: newName
    },
    function (result, error) {
      buttonEl.disabled = false;

      if (error) {
        console.error("Display name update error:", error);
        setStatus(error.errorMessage || "Could not update display name.");
        return;
      }

      const updatedName = result.data?.DisplayName || newName;
      setText("mobile-profile-displayname", updatedName);
      setText("desktop-profile-displayname", updatedName);
      setDisplayNameFields(updatedName);
      setStatus("Display name updated successfully.");
    }
  );
}

function handleBioSave(buttonEl) {
  const mobileBio = getInputValue("mobile-profile-bio");
  const desktopBio = getInputValue("desktop-profile-bio");
  const bio = desktopBio || mobileBio;

  buttonEl.disabled = true;
  setStatus("Saving bio...");

  PlayFabClientSDK.UpdateUserData(
    {
      Data: {
        bio: bio
      },
      Permission: "Private"
    },
    function (result, error) {
      buttonEl.disabled = false;

      if (error) {
        console.error("Bio save error:", error);
        setStatus(error.errorMessage || "Could not save bio.");
        return;
      }

      setBio(bio);
      setStatus("Bio saved successfully.");
    }
  );
}

if (mobileSaveDisplayNameBtn) {
  mobileSaveDisplayNameBtn.addEventListener("click", function () {
    handleDisplayNameUpdate("mobile-displayname-input", mobileSaveDisplayNameBtn);
  });
}

if (desktopSaveDisplayNameBtn) {
  desktopSaveDisplayNameBtn.addEventListener("click", function () {
    handleDisplayNameUpdate("desktop-displayname-input", desktopSaveDisplayNameBtn);
  });
}

if (mobileSaveBioBtn) {
  mobileSaveBioBtn.addEventListener("click", function () {
    handleBioSave(mobileSaveBioBtn);
  });
}

if (desktopSaveBioBtn) {
  desktopSaveBioBtn.addEventListener("click", function () {
    handleBioSave(desktopSaveBioBtn);
  });
}

/* ================= PASSWORD RESET EMAIL ================= */

const mobileSendResetBtn = document.getElementById("mobile-send-reset-btn");
const desktopSendResetBtn = document.getElementById("desktop-send-reset-btn");

function handleSendReset(buttonEl) {
  if (!savedEmail) {
    setStatus("No account email was found for this session.");
    return;
  }

  buttonEl.disabled = true;
  setStatus("Sending password reset email...");

  PlayFabClientSDK.SendAccountRecoveryEmail(
    {
      TitleId: PLAYFAB_TITLE_ID,
      Email: savedEmail,
      EmailTemplateId: PASSWORD_RECOVERY_TEMPLATE_ID
    },
    function (result, error) {
      buttonEl.disabled = false;

      if (error) {
        console.error("Recovery email error:", error);
        setStatus(error.errorMessage || "Could not send password reset email.");
        return;
      }

      setStatus("Password reset email sent. Please check your inbox.");
    }
  );
}

if (mobileSendResetBtn) {
  mobileSendResetBtn.addEventListener("click", function () {
    handleSendReset(mobileSendResetBtn);
  });
}

if (desktopSendResetBtn) {
  desktopSendResetBtn.addEventListener("click", function () {
    handleSendReset(desktopSendResetBtn);
  });
}

/* ================= LOGOUT ================= */

const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
const desktopLogoutBtn = document.getElementById("desktop-logout-btn");

function handleLogout() {
  sessionStorage.removeItem("pfSessionTicket");
  sessionStorage.removeItem("pfPlayFabId");
  sessionStorage.removeItem("pfEmail");
  window.location.href = "index.html";
}

if (mobileLogoutBtn) {
  mobileLogoutBtn.addEventListener("click", handleLogout);
}

if (desktopLogoutBtn) {
  desktopLogoutBtn.addEventListener("click", handleLogout);
}

/* ================= MOBILE PROFILE TABS ================= */

const profileTabs = document.querySelectorAll(".mobile-profile-tab");
const profilePanels = document.querySelectorAll(".mobile-profile-panel");

profileTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.profileTab;

    profileTabs.forEach(t => t.classList.remove("active"));
    profilePanels.forEach(p => p.classList.remove("active"));

    tab.classList.add("active");

    const targetPanel = document.getElementById(target);
    if (targetPanel) {
      targetPanel.classList.add("active");
    }
  });
});