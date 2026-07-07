/**
 * SpendShare — Admin Settings
 */

document.addEventListener("DOMContentLoaded", () => {
    if (!SpendShare.requireAdminAuth()) return;

    SpendShare.initAdminAuthUI();
    SpendShare.initAdminLogout();
    initDropdownLogout();
    initThemeButtons();
    initPasswordToggles();
    initPasswordStrength();
    initPasswordForm();
    initFlatForm();
    initCopyCode();
});

function initDropdownLogout() {
    document.getElementById("dropdownLogout")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

/* ===========================
   THEME BUTTONS
=========================== */

function initThemeButtons() {
    const lightBtn = document.getElementById("lightModeBtn");
    const darkBtn = document.getElementById("darkModeBtn");

    function updateActive() {
        const theme = document.documentElement.getAttribute("data-theme") || "light";
        lightBtn?.classList.toggle("active", theme === "light");
        darkBtn?.classList.toggle("active", theme === "dark");
    }

    updateActive();

    lightBtn?.addEventListener("click", () => {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
        updateActive();
        SpendShare.showToast("Light mode enabled", "info", 2000);
    });

    darkBtn?.addEventListener("click", () => {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
        updateActive();
        SpendShare.showToast("Dark mode enabled", "info", 2000);
    });

    document.getElementById("themeToggle")?.addEventListener("click", () => {
        setTimeout(updateActive, 50);
    });
}

/* ===========================
   PASSWORD TOGGLE
=========================== */

function initPasswordToggles() {
    document.querySelectorAll(".toggle-password").forEach(btn => {
        btn.addEventListener("click", () => {
            const input = document.getElementById(btn.dataset.target);
            if (!input) return;

            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";

            const icon = btn.querySelector("i");
            if (icon) {
                icon.className = isPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
            }
        });
    });
}

/* ===========================
   PASSWORD STRENGTH
=========================== */

function initPasswordStrength() {
    const input = document.getElementById("newPassword");
    const strengthWrap = document.getElementById("passwordStrength");
    const strengthFill = document.getElementById("strengthFill");
    const strengthText = document.getElementById("strengthText");

    if (!input) return;

    input.addEventListener("input", () => {
        const val = input.value;

        if (!val) {
            strengthWrap.style.display = "none";
            return;
        }

        strengthWrap.style.display = "flex";

        let score = 0;
        if (val.length >= 6) score++;
        if (val.length >= 10) score++;
        if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        strengthFill.className = "strength-fill";
        if (score <= 1) {
            strengthFill.classList.add("weak");
            strengthText.textContent = "Weak";
        } else if (score <= 2) {
            strengthFill.classList.add("medium");
            strengthText.textContent = "Medium";
        } else {
            strengthFill.classList.add("strong");
            strengthText.textContent = "Strong";
        }
    });
}

/* ===========================
   PASSWORD FORM
=========================== */

function initPasswordForm() {
    const form = document.getElementById("passwordForm");

    ["currentPassword", "newPassword", "confirmPassword"].forEach(id => {
        const input = document.getElementById(id);
        input?.addEventListener("blur", () => validateField(id));
    });

    document.getElementById("confirmPassword")?.addEventListener("input", () => {
        if (document.getElementById("newPassword").value) {
            validateField("confirmPassword");
        }
    });

    form?.addEventListener("submit", handlePasswordSubmit);
}

function validateField(name) {
    const input = document.getElementById(name);
    const group = document.querySelector(`[data-field="${name}"]`);
    const errorEl = group?.querySelector(".field-error");
    if (!input || !group) return true;

    let message = "";
    const val = input.value.trim();

    if (!val) {
        message = "This field is required";
    } else if (name === "newPassword" && val.length < 6) {
        message = "Password must be at least 6 characters";
    } else if (name === "confirmPassword") {
        const newPass = document.getElementById("newPassword").value.trim();
        if (val !== newPass) {
            message = "Passwords do not match";
        }
    }

    const isValid = !message;
    group.classList.toggle("has-error", !isValid);
    group.classList.toggle("has-success", isValid && val !== "");
    if (errorEl) errorEl.textContent = message;

    return isValid;
}

function validatePasswordForm() {
    return ["currentPassword", "newPassword", "confirmPassword"].every(validateField);
}

async function handlePasswordSubmit(e) {
    e.preventDefault();

    if (!validatePasswordForm()) {
        SpendShare.showToast("Please fix the errors in the form", "error");
        return;
    }

    const { adminId } = SpendShare.getAdminAuth();
    const submitBtn = document.getElementById("submitBtn");
    const btnText = submitBtn.querySelector("span");
    const btnLoader = submitBtn.querySelector(".btn-loader");

    const currentPassword = document.getElementById("currentPassword").value.trim();
    const newPassword = document.getElementById("newPassword").value.trim();

    submitBtn.disabled = true;
    if (btnText) btnText.style.display = "none";
    if (btnLoader) btnLoader.style.display = "flex";

    try {
        const data = await SpendShare.adminApiFetch(`/admin/profile/${adminId}/password`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to change password", "error");
            return;
        }

        SpendShare.showToast("Password updated successfully!", "success");
        document.getElementById("passwordForm").reset();
        document.getElementById("passwordStrength").style.display = "none";
        document.querySelectorAll("#passwordForm .float-group").forEach(g => {
            g.classList.remove("has-error", "has-success");
        });

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to change password", "error");
    } finally {
        submitBtn.disabled = false;
        if (btnText) btnText.style.display = "inline";
        if (btnLoader) btnLoader.style.display = "none";
    }
}

/* ===========================
   FLAT CONFIGURATION
=========================== */

async function initFlatForm() {
    const nameInput = document.getElementById("flatName");
    const addressInput = document.getElementById("flatAddress");
    const codeInput = document.getElementById("flatCode");
    const form = document.getElementById("flatForm");

    // Load current details
    try {
        const data = await SpendShare.adminApiFetch("/flat/my");
        if (data.success && data.flat) {
            nameInput.value = data.flat.name || "";
            addressInput.value = data.flat.address || "";
            codeInput.value = data.flat.flatCode || "—";
            
            // Trigger floating labels placement
            nameInput.dispatchEvent(new Event("input"));
            addressInput.dispatchEvent(new Event("input"));
        }
    } catch (error) {
        console.error("Failed to load flat details:", error);
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = nameInput.value.trim();
        const address = addressInput.value.trim();

        if (!name) {
            const group = document.querySelector('[data-field="flatName"]');
            group.classList.add("has-error");
            const err = group.querySelector(".field-error");
            if (err) err.textContent = "Flat name is required";
            return;
        }

        const submitBtn = document.getElementById("saveFlatBtn");
        const btnText = submitBtn.querySelector("span");
        const btnLoader = submitBtn.querySelector(".btn-loader");

        submitBtn.disabled = true;
        if (btnText) btnText.style.display = "none";
        if (btnLoader) btnLoader.style.display = "flex";

        try {
            const data = await SpendShare.adminApiFetch("/flat/my", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, address })
            });

            if (!data.success) {
                SpendShare.showToast(data.message || "Failed to update Flat details", "error");
                return;
            }

            SpendShare.showToast("Flat settings saved successfully!", "success");
            localStorage.setItem("adminFlatName", name);

        } catch (error) {
            console.error(error);
            SpendShare.showToast("Unable to save Flat details", "error");
        } finally {
            submitBtn.disabled = false;
            if (btnText) btnText.style.display = "inline";
            if (btnLoader) btnLoader.style.display = "none";
        }
    });
}

/* ===========================
   COPY CODE
=========================== */

function initCopyCode() {
    const copyBtn = document.getElementById("copyCodeBtn");
    const codeInput = document.getElementById("flatCode");

    copyBtn?.addEventListener("click", () => {
        const val = codeInput?.value;
        if (!val || val === "—") return;

        navigator.clipboard.writeText(val)
            .then(() => {
                SpendShare.showToast("Flat code copied to clipboard", "success", 2000);
            })
            .catch(() => {
                SpendShare.showToast("Failed to copy code", "error");
            });
    });
}
