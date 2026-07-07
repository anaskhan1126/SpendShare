/**
 * SpendShare — Member Register (Join Flat)
 */

const flatValidation = {
    code: "",
    valid: false,
    flatName: "",
    validating: false
};

let validateTimer = null;

document.addEventListener("DOMContentLoaded", () => {
    initPasswordToggles();
    initFlatCodeValidation();
    initMemberRegisterForm();
    initSuccessActions();
    prefillFlatCodeFromUrl();
});

function initPasswordToggles() {
    document.querySelectorAll(".toggle-password").forEach((eye) => {
        eye.addEventListener("click", () => {
            const input = document.getElementById(eye.dataset.target);
            if (!input) return;

            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            eye.classList.toggle("fa-eye", !isPassword);
            eye.classList.toggle("fa-eye-slash", isPassword);
        });
    });
}

function prefillFlatCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") || params.get("flatCode");
    if (!code) return;

    const input = document.getElementById("flatCode");
    if (input) {
        input.value = code.trim().toUpperCase();
        validateFlatCode(input.value);
    }
}

function initFlatCodeValidation() {
    const input = document.getElementById("flatCode");
    if (!input) return;

    input.addEventListener("input", () => {
        const normalized = input.value.trim().toUpperCase();
        if (input.value !== normalized) input.value = normalized;

        clearTimeout(validateTimer);
        resetFlatValidation();

        if (normalized.length < 6) return;

        validateTimer = setTimeout(() => validateFlatCode(normalized), 450);
    });

    input.addEventListener("blur", () => {
        const code = input.value.trim().toUpperCase();
        if (code.length >= 6) validateFlatCode(code);
    });
}

function resetFlatValidation() {
    flatValidation.code = "";
    flatValidation.valid = false;
    flatValidation.flatName = "";

    const field = document.getElementById("flatCodeField");
    const status = document.getElementById("flatCodeStatus");
    const hint = document.getElementById("flatCodeHint");
    const banner = document.getElementById("flatValidatedBanner");

    field?.classList.remove("is-valid", "is-invalid", "is-loading");
    if (status) status.innerHTML = "";
    if (hint) {
        hint.textContent = "Ask your flat admin for the join code.";
        hint.classList.remove("error");
    }
    banner?.classList.add("hidden");
}

async function validateFlatCode(code) {
    const field = document.getElementById("flatCodeField");
    const status = document.getElementById("flatCodeStatus");
    const hint = document.getElementById("flatCodeHint");
    const banner = document.getElementById("flatValidatedBanner");
    const nameEl = document.getElementById("validatedFlatName");

    if (!code || code.length < 6) {
        resetFlatValidation();
        return;
    }

    flatValidation.validating = true;
    field?.classList.add("is-loading");
    field?.classList.remove("is-valid", "is-invalid");
    if (status) status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/flat/validate/${encodeURIComponent(code)}`);
        const contentType = response.headers.get("content-type");
        const data = (contentType && contentType.includes("application/json"))
            ? await response.json()
            : { success: false, message: `Server error: ${response.status} ${response.statusText}` };

        if (data.success && data.exists) {
            flatValidation.code = code;
            flatValidation.valid = true;
            flatValidation.flatName = data.flat?.name || "";

            field?.classList.remove("is-loading", "is-invalid");
            field?.classList.add("is-valid");
            if (status) status.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            if (hint) {
                hint.textContent = "Flat code verified.";
                hint.classList.remove("error");
            }
            if (nameEl) nameEl.textContent = flatValidation.flatName;
            banner?.classList.remove("hidden");
            return;
        }

        flatValidation.valid = false;
        field?.classList.remove("is-loading", "is-valid");
        field?.classList.add("is-invalid");
        if (status) status.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        if (hint) {
            hint.textContent = data.message || "Flat not found. Check the code and try again.";
            hint.classList.add("error");
        }
        banner?.classList.add("hidden");

    } catch (error) {
        console.error(error);
        flatValidation.valid = false;
        field?.classList.remove("is-loading", "is-valid");
        field?.classList.add("is-invalid");
        if (status) status.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        if (hint) {
            hint.textContent = "Could not verify flat code. Check your connection.";
            hint.classList.add("error");
        }
    } finally {
        flatValidation.validating = false;
    }
}

function initMemberRegisterForm() {
    const form = document.getElementById("memberRegisterForm");
    const btn = document.getElementById("registerBtn");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const flatCode = document.getElementById("flatCode").value.trim().toUpperCase();
        const name = document.getElementById("name").value.trim();
        const username = document.getElementById("username").value.trim().toLowerCase();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const phone = document.getElementById("phone").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (!flatCode || !name || !username || !email || !phone || !password || !confirmPassword) {
            SpendShare.showToast("Please fill in all fields", "warning");
            return;
        }

        if (password.length < 6) {
            SpendShare.showToast("Password must be at least 6 characters", "warning");
            return;
        }

        if (password !== confirmPassword) {
            SpendShare.showToast("Passwords do not match", "warning");
            return;
        }

        if (!flatValidation.valid || flatValidation.code !== flatCode) {
            await validateFlatCode(flatCode);
            if (!flatValidation.valid) {
                SpendShare.showToast("Please enter a valid flat code", "warning");
                return;
            }
        }

        setLoading(btn, true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/member/register-request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    username,
                    email,
                    phone,
                    password,
                    flatCode
                })
            });

            const contentType = response.headers.get("content-type");
            const data = (contentType && contentType.includes("application/json"))
                ? await response.json()
                : { success: false, message: `Server error: ${response.status} ${response.statusText}` };

            if (!data.success) {
                SpendShare.showToast(data.message || "Registration failed", "error");
                return;
            }

            showSuccessCard(data.flat?.name || flatValidation.flatName);

        } catch (error) {
            console.error(error);
            SpendShare.showToast("Unable to connect to server", "error");
        } finally {
            setLoading(btn, false);
        }
    });
}

function showSuccessCard(flatName) {
    const registerCard = document.getElementById("registerCard");
    const successCard = document.getElementById("successCard");
    const nameEl = document.getElementById("successFlatName");

    if (nameEl && flatName) nameEl.textContent = flatName;

    registerCard?.classList.add("hidden");
    successCard?.classList.remove("hidden");

    SpendShare.showToast("Join request sent! Awaiting admin approval.", "success");
}

function initSuccessActions() {
    document.getElementById("goLoginBtn")?.addEventListener("click", () => {
        window.location.href = "login.html";
    });
}

function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending request...';
    } else if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
    }
}
