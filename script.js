const bookmarks = document.querySelectorAll('.bookmark');
const windows = document.querySelectorAll('.desktop-window');
const wrappers = document.querySelectorAll('.bookmark-wrapper');
const overlay = document.getElementById('overlay');

const desktopDownloadBtn = document.getElementById('desktop-download-btn');
const mobileDownloadBtn = document.getElementById('mobile-download-btn');
const downloadWindow = document.getElementById('win-download');

const downloadTriggerWrapper = document.getElementById('download-trigger-wrapper');

const footerTab = document.getElementById('footer-tab');
const footerWindow = document.getElementById('win-footer');

let currentWindow = null;

const PLAYFAB_TITLE_ID = "1E22BA";


/* ================= BOOMARK DROP LOGIC ================= */

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

  win.classList.add('show');

  if (overlay) {
    overlay.classList.add('show');
  }

  wrappers.forEach(w => {
    w.classList.remove('active');
    w.style.setProperty("--drop-distance", "0px");
  });

  if (downloadTriggerWrapper) {
    downloadTriggerWrapper.classList.remove('active');
  }

  if (wrapper) {
    wrapper.classList.add('active');

    requestAnimationFrame(() => {
      setBookmarkDrop(wrapper, win);
    });
  }

  currentWindow = win;
}

function closeWindow(win) {
  if (!win) return;

  win.classList.remove('show');

  if (overlay) {
    overlay.classList.remove('show');
  }

  wrappers.forEach(w => {
    w.classList.remove('active');
    w.style.setProperty("--drop-distance", "0px");
  });

  if (downloadTriggerWrapper) {
    downloadTriggerWrapper.classList.remove('active');
  }

  if (win === footerWindow && footerTab) {
    footerTab.classList.remove('active');
  }

  currentWindow = null;
}


/* ================= PLAYFAB HELPERS ================= */

function clearStoredSession() {
  sessionStorage.removeItem("pfSessionTicket");
  sessionStorage.removeItem("pfPlayFabId");
  sessionStorage.removeItem("pfEmail");
}

function getVerificationState(contactEmailAddresses, email) {
  if (!Array.isArray(contactEmailAddresses) || !email) {
    return {
      found: false,
      verified: false,
      status: ""
    };
  }

  const match = contactEmailAddresses.find(entry => {
    const addr = (entry.EmailAddress || "").toLowerCase();
    return addr === email.toLowerCase();
  });

  if (!match) {
    return {
      found: false,
      verified: false,
      status: ""
    };
  }

  const rawStatus = (match.VerificationStatus || "").toString();
  const status = rawStatus.toLowerCase();
  const verified = status === "confirmed" || status === "verified";

  return {
    found: true,
    verified,
    status: rawStatus
  };
}

function goToMobileVerificationPanel(email = "", message = "") {
  const tabs = document.querySelectorAll(".mobile-tab");
  const panels = document.querySelectorAll(".mobile-panel");
  const verifyPanel = document.getElementById("verify-email-panel");
  const verifyInput = document.getElementById("mobile-verify-email-input");
  const verifyStatus = document.getElementById("mobile-verify-email-status");

  tabs.forEach(t => t.classList.remove("active"));
  panels.forEach(p => p.classList.remove("active"));

  if (verifyPanel) {
    verifyPanel.classList.add("active");
  }

  if (verifyInput) {
    verifyInput.value = email || "";
  }

  if (verifyStatus && message) {
    verifyStatus.textContent = message;
  }

  const mobileTabContent = document.querySelector(".mobile-tab-content");
  if (mobileTabContent) {
    mobileTabContent.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function goToMobileLoginPanel() {
  const tabs = document.querySelectorAll(".mobile-tab");
  const panels = document.querySelectorAll(".mobile-panel");

  tabs.forEach(t => t.classList.remove("active"));
  panels.forEach(p => p.classList.remove("active"));

  const signinPanel = document.getElementById("signin");
  if (signinPanel) {
    signinPanel.classList.add("active");
  }

  const signinTab = document.querySelector('.mobile-tab[data-tab="signin"]');
  if (signinTab) {
    signinTab.classList.add("active");
  }

  const mobileTabContent = document.querySelector(".mobile-tab-content");
  if (mobileTabContent) {
    mobileTabContent.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}


/* ======== ACCOUNT CREATION / PASSWORD RECOVERY ======== */

const desktopCreateAccountLink = document.getElementById("desktop-create-account-link");
const desktopForgotPasswordLink = document.getElementById("desktop-forgot-password-link");
const mobileCreateAccountLink = document.getElementById("mobile-create-account-link");
const mobileForgotPasswordLink = document.getElementById("mobile-forgot-password-link");

const winRegister = document.getElementById("win-register");
const winForgotPassword = document.getElementById("win-forgot-password");
const winVerifyEmail = document.getElementById("win-verify-email");
const winSignIn = document.getElementById("win-signin");

const mobileRegisterPanel = document.getElementById("mobile-register-panel");
const mobileForgotPasswordPanel = document.getElementById("mobile-forgot-password-panel");

function switchMobilePanel(panelId) {
  const tabs = document.querySelectorAll(".mobile-tab");
  const panels = document.querySelectorAll(".mobile-panel");

  tabs.forEach(t => t.classList.remove("active"));
  panels.forEach(p => p.classList.remove("active"));

  const targetPanel = document.getElementById(panelId);
  if (targetPanel) {
    targetPanel.classList.add("active");
  }

  const mobileTabContent = document.querySelector(".mobile-tab-content");
  if (mobileTabContent) {
    mobileTabContent.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

if (desktopCreateAccountLink && winRegister) {
  desktopCreateAccountLink.addEventListener("click", function (e) {
    e.preventDefault();
    openWindow(winRegister);
  });
}

if (desktopForgotPasswordLink && winForgotPassword) {
  desktopForgotPasswordLink.addEventListener("click", function (e) {
    e.preventDefault();
    openWindow(winForgotPassword);
  });
}

if (mobileCreateAccountLink && mobileRegisterPanel) {
  mobileCreateAccountLink.addEventListener("click", function (e) {
    e.preventDefault();
    switchMobilePanel("mobile-register-panel");
  });
}

if (mobileForgotPasswordLink && mobileForgotPasswordPanel) {
  mobileForgotPasswordLink.addEventListener("click", function (e) {
    e.preventDefault();
    switchMobilePanel("mobile-forgot-password-panel");
  });
}

const registerBtn = document.getElementById("register-btn");
const registerUsername = document.getElementById("register-username");
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById("register-password");
const registerConfirmPassword = document.getElementById("register-confirm-password");
const registerTerms = document.getElementById("register-terms");
const registerStatus = document.getElementById("register-status");

const mobileRegisterBtn = document.getElementById("mobile-register-btn");
const mobileRegisterUsername = document.getElementById("mobile-register-username");
const mobileRegisterEmail = document.getElementById("mobile-register-email");
const mobileRegisterPassword = document.getElementById("mobile-register-password");
const mobileRegisterConfirmPassword = document.getElementById("mobile-register-confirm-password");
const mobileRegisterTerms = document.getElementById("mobile-register-terms");
const mobileRegisterStatus = document.getElementById("mobile-register-status");

const verifyEmailInput = document.getElementById("verify-email-input");
const verifyEmailStatus = document.getElementById("verify-email-status");
const verifyBackToLoginLink = document.getElementById("verify-back-to-login-link");

const mobileVerifyEmailInput = document.getElementById("mobile-verify-email-input");
const mobileVerifyEmailStatus = document.getElementById("mobile-verify-email-status");
const mobileVerifyBackLink = document.getElementById("mobile-verify-back-link");

const mobileRegisterBackLink = document.getElementById("mobile-register-back-link");
const mobileRecoveryBackLink = document.getElementById("mobile-recovery-back-link");

document.querySelectorAll(".password-toggle").forEach(button => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.target;
    const input = document.getElementById(targetId);

    if (!input) return;

    const shouldShow = input.type === "password";
    input.type = shouldShow ? "text" : "password";

    button.classList.toggle("visible", shouldShow);
    button.setAttribute(
      "aria-label",
      shouldShow ? "Hide password" : "Show password"
    );
    button.setAttribute(
      "title",
      shouldShow ? "Hide password" : "Show password"
    );
  });
});

function resetPasswordToggles() {
  document.querySelectorAll(".password-toggle.visible").forEach(button => {
    const input = document.getElementById(button.dataset.target);
    if (input) input.type = "password";
    button.classList.remove("visible");
    button.setAttribute("aria-label", "Show password");
    button.setAttribute("title", "Show password");
  });
}

function handleRegister({
  usernameInput,
  emailInput,
  passwordInput,
  confirmPasswordInput,
  termsInput,
  statusEl,
  buttonEl,
  isMobile = false
}) {
  const username = usernameInput ? usernameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";
  const agreedToTerms = termsInput ? termsInput.checked : false;

  if (!username) {
    statusEl.textContent = "Please enter a username.";
    return;
  }

  if (!email) {
    statusEl.textContent = "Please enter your email.";
    return;
  }

  if (!password) {
    statusEl.textContent = "Please enter a password.";
    return;
  }

  if (password.length < 8) {
    statusEl.textContent = "Password must be at least 8 characters.";
    return;
  }

  if (!confirmPassword) {
    statusEl.textContent = "Please confirm your password.";
    return;
  }

  if (password !== confirmPassword) {
    statusEl.textContent = "Passwords do not match.";
    return;
  }

  if (!agreedToTerms) {
    statusEl.textContent = "You must agree to the Terms and Privacy Notice.";
    return;
  }

  buttonEl.disabled = true;
  statusEl.textContent = "Creating account...";

  const request = {
    TitleId: PLAYFAB_TITLE_ID,
    Username: username,
    Email: email,
    Password: password,
    DisplayName: username,
    RequireBothUsernameAndEmail: false
  };

  PlayFabClientSDK.RegisterPlayFabUser(request, function (result, error) {
    if (error) {
      console.error("Register error:", error);
      statusEl.textContent = error.errorMessage || "Account creation failed.";
      buttonEl.disabled = false;
      return;
    }

    PlayFabClientSDK.AddOrUpdateContactEmail(
      { EmailAddress: email },
      function () {
        clearStoredSession();

        statusEl.textContent =
          "Account created. Verification email sent. Please check your inbox before signing in.";

        if (verifyEmailInput) {
          verifyEmailInput.value = email;
        }

        if (verifyEmailStatus) {
          verifyEmailStatus.textContent =
            "We sent a verification email. Please check your inbox before signing in.";
        }

        if (mobileVerifyEmailInput) {
          mobileVerifyEmailInput.value = email;
        }

        if (mobileVerifyEmailStatus) {
          mobileVerifyEmailStatus.textContent =
            "We sent a verification email. Please check your inbox before signing in.";
        }

        if (usernameInput) usernameInput.value = "";
        if (emailInput) emailInput.value = "";
        if (passwordInput) passwordInput.value = "";
        if (confirmPasswordInput) confirmPasswordInput.value = "";
        if (termsInput) termsInput.checked = false;

        resetPasswordToggles();
        buttonEl.disabled = false;

        if (!isMobile && winRegister) {
          closeWindow(winRegister);
        }

        if (!isMobile && winVerifyEmail) {
          openWindow(winVerifyEmail);
        }

        goToMobileVerificationPanel(
          email,
          "We sent a verification email. Please check your inbox before signing in."
        );
      },
      function (contactError) {
        console.error("Contact email error:", contactError);
        statusEl.textContent =
          contactError.errorMessage ||
          "Account created, but verification email could not be sent.";
        buttonEl.disabled = false;
      }
    );
  });
}

if (registerBtn) {
  registerBtn.addEventListener("click", function () {
    handleRegister({
      usernameInput: registerUsername,
      emailInput: registerEmail,
      passwordInput: registerPassword,
      confirmPasswordInput: registerConfirmPassword,
      termsInput: registerTerms,
      statusEl: registerStatus,
      buttonEl: registerBtn,
      isMobile: false
    });
  });
}

if (mobileRegisterBtn) {
  mobileRegisterBtn.addEventListener("click", function () {
    handleRegister({
      usernameInput: mobileRegisterUsername,
      emailInput: mobileRegisterEmail,
      passwordInput: mobileRegisterPassword,
      confirmPasswordInput: mobileRegisterConfirmPassword,
      termsInput: mobileRegisterTerms,
      statusEl: mobileRegisterStatus,
      buttonEl: mobileRegisterBtn,
      isMobile: true
    });
  });
}

if (verifyBackToLoginLink) {
  verifyBackToLoginLink.addEventListener("click", function (e) {
    e.preventDefault();

    if (winVerifyEmail) {
      closeWindow(winVerifyEmail);
    }

    if (winSignIn) {
      openWindow(winSignIn);
    }
  });
}

if (mobileVerifyBackLink) {
  mobileVerifyBackLink.addEventListener("click", function (e) {
    e.preventDefault();
    goToMobileLoginPanel();
  });
}

if (mobileRegisterBackLink) {
  mobileRegisterBackLink.addEventListener("click", function (e) {
    e.preventDefault();
    goToMobileLoginPanel();
  });
}

if (mobileRecoveryBackLink) {
  mobileRecoveryBackLink.addEventListener("click", function (e) {
    e.preventDefault();
    goToMobileLoginPanel();
  });
}

const recoveryBtn = document.getElementById("recovery-btn");
const recoveryEmail = document.getElementById("recovery-email");
const recoveryStatus = document.getElementById("recovery-status");

const mobileRecoveryBtn = document.getElementById("mobile-recovery-btn");
const mobileRecoveryEmail = document.getElementById("mobile-recovery-email");
const mobileRecoveryStatus = document.getElementById("mobile-recovery-status");

function handleRecovery(emailInput, statusEl) {
  const email = emailInput.value.trim();

  if (!email) {
    statusEl.textContent = "Please enter your email.";
    return;
  }

  statusEl.textContent = "Sending recovery email...";

  const request = {
    TitleId: PLAYFAB_TITLE_ID,
    Email: email,
    EmailTemplateId: "774566C3D66B63D3"
  };

  PlayFabClientSDK.SendAccountRecoveryEmail(request, function (result, error) {
    if (error) {
      console.error(error);
      statusEl.textContent = error.errorMessage || "Could not send recovery email.";
      return;
    }

    statusEl.textContent = "Recovery email sent. Check your inbox.";
  });
}

if (recoveryBtn) {
  recoveryBtn.addEventListener("click", function () {
    handleRecovery(recoveryEmail, recoveryStatus);
  });
}

if (mobileRecoveryBtn) {
  mobileRecoveryBtn.addEventListener("click", function () {
    handleRecovery(mobileRecoveryEmail, mobileRecoveryStatus);
  });
}

/* ================= BOOKMARK WINDOWS ================= */

bookmarks.forEach(bookmark => {
  bookmark.addEventListener('click', () => {
    const win = document.getElementById(bookmark.dataset.window);
    const wrapper = bookmark.closest('.bookmark-wrapper');

    if (currentWindow === win) {
      closeWindow(win);
    } else {
      openWindow(win, wrapper);
    }
  });
});

/* ================= DOWNLOAD WINDOW ================= */

if (desktopDownloadBtn && downloadWindow) {
  desktopDownloadBtn.addEventListener('click', (e) => {
    e.preventDefault();

    if (currentWindow === downloadWindow) {
      closeWindow(downloadWindow);
    } else {
      openWindow(downloadWindow);
      if (downloadTriggerWrapper) {
        downloadTriggerWrapper.classList.add('active');
      }
    }
  });
}

/* ================= FOOTER WINDOW ================= */

if (footerTab && footerWindow) {
  footerTab.addEventListener('click', () => {
    if (currentWindow === footerWindow) {
      closeWindow(footerWindow);
      footerTab.classList.remove('active');
    } else {
      openWindow(footerWindow);
      footerTab.classList.add('active');
    }
  });
}

/* ================= CLOSE BUTTONS ================= */

windows.forEach(win => {
  const closeBtn = win.querySelector('.win-close');
  if (!closeBtn) return;

  closeBtn.addEventListener('click', () => {
    closeWindow(win);
  });
});

/* ================= OVERLAY CLICK ================= */

if (overlay) {
  overlay.addEventListener('click', () => {
    if (currentWindow) {
      closeWindow(currentWindow);
    }
  });
}

/* ================= MOBILE TAB SWITCHING ================= */

const tabs = document.querySelectorAll(".mobile-tab");
const panels = document.querySelectorAll(".mobile-panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;

    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));

    tab.classList.add("active");
    const targetPanel = document.getElementById(target);
    if (targetPanel) {
      targetPanel.classList.add("active");
    }
  });
});

/* ================= MOBILE DOWNLOAD PANEL SHORTCUT ================= */

if (mobileDownloadBtn) {
  mobileDownloadBtn.addEventListener("click", (e) => {
    e.preventDefault();

    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));

    const downloadPanel = document.getElementById("download");
    if (downloadPanel) {
      downloadPanel.classList.add("active");
    }

    const mobileTabContent = document.querySelector(".mobile-tab-content");
    if (mobileTabContent) {
      mobileTabContent.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
}

const backBtn = document.getElementById("backToTop");

window.addEventListener("scroll", () => {
  if (!backBtn) return;

  if (window.scrollY > 400) {
    backBtn.classList.add("show");
  } else {
    backBtn.classList.remove("show");
  }
});

if (backBtn) {
  backBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
};

document.addEventListener("DOMContentLoaded", function () {
  const viewer = document.getElementById("screenshot-viewer");
  const viewerImg = document.getElementById("viewer-image");

  if (!viewer || !viewerImg) return;

  const screenshots = document.querySelectorAll(
    ".media-card img, .mobile-media-gallery img, .feature-preview-image img, .mobile-feature-preview img, .feature-hero-image img, .mobile-feature-hero-image img"
  );

  screenshots.forEach(img => {
    img.style.cursor = "pointer";

    img.addEventListener("click", function () {
      viewerImg.src = this.src;
      viewer.classList.add("active");
    });
  });

  viewer.addEventListener("click", function () {
    viewer.classList.remove("active");
  });
});

/* ================= RESIZE LOGIC ================= */

window.addEventListener("resize", () => {
  if (!currentWindow) return;

  const activeWrapper = document.querySelector(".bookmark-wrapper.active");
  if (activeWrapper) {
    setBookmarkDrop(activeWrapper, currentWindow);
  }
});


/* ================= PLAYFAB LOGIN ================= */

document.addEventListener("DOMContentLoaded", function () {
  if (typeof PlayFab === "undefined" || !PlayFab.settings) {
    console.error("PlayFab SDK failed to load.");
    return;
  }

  PlayFab.settings.titleId = PLAYFAB_TITLE_ID;

  const mobileEmail = document.getElementById("mobile-email");
  const mobilePassword = document.getElementById("mobile-password");
  const mobileBtn = document.getElementById("mobile-signin-btn");
  const mobileStatus = document.getElementById("mobile-signin-status");

  const desktopEmail = document.getElementById("desktop-email");
  const desktopPassword = document.getElementById("desktop-password");
  const desktopBtn = document.getElementById("desktop-signin-btn");
  const desktopStatus = document.getElementById("desktop-signin-status");

  function loginWithPlayFab(email, password, statusEl) {
    if (!email || !password) {
      statusEl.textContent = "Please enter both email and password.";
      return;
    }

    statusEl.textContent = "Signing in...";

    const request = {
      TitleId: PLAYFAB_TITLE_ID,
      Email: email,
      Password: password,
      InfoRequestParameters: {
        GetPlayerProfile: true,
        ProfileConstraints: {
          ShowContactEmailAddresses: true,
          ShowDisplayName: true
        }
      }
    };

    PlayFabClientSDK.LoginWithEmailAddress(request, function (result, error) {
      if (error) {
        console.error("PlayFab login error:", error);
        statusEl.textContent = error.errorMessage || "Login failed.";
        return;
      }

      const data = result.data || {};
      const profile = data.InfoResultPayload?.PlayerProfile || {};
      const contactEmails = profile.ContactEmailAddresses || [];
      const verification = getVerificationState(contactEmails, email);

      if (!verification.verified) {
        clearStoredSession();

        statusEl.textContent =
          "Your email is not verified yet. Sending a new verification email...";

        PlayFabClientSDK.AddOrUpdateContactEmail(
          { EmailAddress: email },
          function () {
            statusEl.textContent =
              "Your email is not verified yet. A new verification email has been sent. Please check your inbox.";

            if (verifyEmailInput) {
              verifyEmailInput.value = email;
            }

            if (verifyEmailStatus) {
              verifyEmailStatus.textContent =
                "A new verification email has been sent. Please check your inbox before signing in.";
            }

            if (mobileVerifyEmailInput) {
              mobileVerifyEmailInput.value = email;
            }

            if (mobileVerifyEmailStatus) {
              mobileVerifyEmailStatus.textContent =
                "A new verification email has been sent. Please check your inbox before signing in.";
            }

            if (winVerifyEmail) {
              openWindow(winVerifyEmail);
            }

            goToMobileVerificationPanel(
              email,
              "A new verification email has been sent. Please check your inbox before signing in."
            );
          },
          function (contactError) {
            console.error("Verification resend error:", contactError);

            statusEl.textContent =
              contactError.errorMessage ||
              "Your email is not verified yet. Please check your inbox and try again.";

            if (verifyEmailInput) {
              verifyEmailInput.value = email;
            }

            if (verifyEmailStatus) {
              verifyEmailStatus.textContent =
                "Your email is not verified yet. Please check your inbox before signing in.";
            }

            if (mobileVerifyEmailInput) {
              mobileVerifyEmailInput.value = email;
            }

            if (mobileVerifyEmailStatus) {
              mobileVerifyEmailStatus.textContent =
                "Your email is not verified yet. Please check your inbox before signing in.";
            }

            if (winVerifyEmail) {
              openWindow(winVerifyEmail);
            }

            goToMobileVerificationPanel(
              email,
              "Your email is not verified yet. Please check your inbox before signing in."
            );
          }
        );

        return;
      }

      sessionStorage.setItem("pfSessionTicket", data.SessionTicket);
      sessionStorage.setItem("pfPlayFabId", data.PlayFabId);
      sessionStorage.setItem("pfEmail", email);

      statusEl.textContent = "Login successful!";

      setTimeout(() => {
        window.location.href = "profile.html";
      }, 500);
    });
  }

  if (mobileBtn) {
    mobileBtn.addEventListener("click", function () {
      loginWithPlayFab(
        mobileEmail ? mobileEmail.value.trim() : "",
        mobilePassword ? mobilePassword.value : "",
        mobileStatus
      );
    });
  }

  if (desktopBtn) {
    desktopBtn.addEventListener("click", function () {
      loginWithPlayFab(
        desktopEmail ? desktopEmail.value.trim() : "",
        desktopPassword ? desktopPassword.value : "",
        desktopStatus
      );
    });
  }
});