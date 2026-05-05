const statusEl = document.getElementById("reset-status");
const resetBtn = document.getElementById("reset-btn");
const newPasswordEl = document.getElementById("new-password");
const confirmPasswordEl = document.getElementById("confirm-password");

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

const API_BASE = "https://roadimentary-admin-dashboard.onrender.com/api";

if (!token) {
  statusEl.textContent = "Reset token missing or invalid.";
  resetBtn.disabled = true;
} else {
  statusEl.textContent = "Reset token found. Enter your new password.";
}

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

resetBtn.addEventListener("click", async () => {
  const password = newPasswordEl.value.trim();
  const confirm = confirmPasswordEl.value.trim();

  if (!token) {
    statusEl.textContent = "Reset token missing.";
    return;
  }

  if (!password || !confirm) {
    statusEl.textContent = "Please fill in both password fields.";
    return;
  }

  if (password !== confirm) {
    statusEl.textContent = "Passwords do not match.";
    return;
  }

  if (password.length < 8) {
    statusEl.textContent = "Password must be at least 8 characters.";
    return;
  }

  resetBtn.disabled = true;
  statusEl.textContent = "Updating password...";

  try {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      statusEl.textContent = data.message || data.error || "Could not reset password.";
      resetBtn.disabled = false;
      return;
    }

    statusEl.textContent =
      "Password updated successfully. You can now return to login.";

    newPasswordEl.value = "";
    confirmPasswordEl.value = "";
  } catch (error) {
    console.error("Reset request failed:", error);
    statusEl.textContent = "Network error while resetting password.";
    resetBtn.disabled = false;
  }
});