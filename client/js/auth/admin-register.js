/**
 * SpendShare — Admin Register (Create Flat)
 */

document.addEventListener("DOMContentLoaded", () => {
    initPasswordToggles();
    initAdminRegisterForm();
    initSuccessActions();
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

function initAdminRegisterForm() {
    const form = document.getElementById("adminRegisterForm");
    const btn = document.getElementById("registerBtn");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const flatName = document.getElementById("flatName").value.trim();
        const flatAddress = document.getElementById("flatAddress").value.trim();
        const name = document.getElementById("adminName").value.trim();
        const email = document.getElementById("adminEmail").value.trim();
        const phone = document.getElementById("adminPhone").value.trim();
        const password = document.getElementById("adminPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (!flatName || !name || !email || !phone || !password || !confirmPassword) {
            SpendShare.showToast("Please fill in all required fields", "warning");
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

        setLoading(btn, true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/flat/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    phone,
                    password,
                    confirmPassword,
                    flatName,
                    flatAddress
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

            SpendShare.saveAdminSession(data);
            showSuccessCard(data.flat);

        } catch (error) {
            console.error(error);
            SpendShare.showToast("Unable to connect to server", "error");
        } finally {
            setLoading(btn, false);
        }
    });
}

function showSuccessCard(flat) {
    const registerCard = document.getElementById("registerCard");
    const successCard = document.getElementById("successCard");
    const codeEl = document.getElementById("flatCodeDisplay");
    const nameEl = document.getElementById("flatNameDisplay");

    if (codeEl && flat?.flatCode) codeEl.textContent = flat.flatCode;
    if (nameEl && flat?.name) nameEl.textContent = flat.name;

    registerCard?.classList.add("hidden");
    successCard?.classList.remove("hidden");

    SpendShare.showToast("Flat created successfully!", "success");
}

function initSuccessActions() {
    const copyBtn = document.getElementById("copyCodeBtn");
    const dashboardBtn = document.getElementById("goDashboardBtn");
    const codeEl = document.getElementById("flatCodeDisplay");

    copyBtn?.addEventListener("click", async () => {
        const code = codeEl?.textContent?.trim();
        if (!code) return;

        try {
            await navigator.clipboard.writeText(code);
            SpendShare.showToast("Flat code copied!", "success");
        } catch {
            SpendShare.showToast("Could not copy — select and copy manually", "warning");
        }
    });

    dashboardBtn?.addEventListener("click", () => {
        window.location.href = "../admin/admin-dashboard.html";
    });
}

function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating flat...';
    } else if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
    }
}
