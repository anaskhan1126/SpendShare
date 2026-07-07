/**
 * SpendShare — Admin Login
 */

document.addEventListener("DOMContentLoaded", () => {
    initPasswordToggle();
    initAdminLoginForm();
});

function initPasswordToggle() {
    const password = document.getElementById("adminPassword");
    const eye = document.querySelector(".toggle-password");
    if (!password || !eye) return;

    eye.addEventListener("click", () => {
        const isPassword = password.type === "password";
        password.type = isPassword ? "text" : "password";
        eye.classList.toggle("fa-eye", !isPassword);
        eye.classList.toggle("fa-eye-slash", isPassword);
    });
}

function initAdminLoginForm() {
    const form = document.getElementById("adminLoginForm");
    const btn = document.getElementById("adminLoginBtn");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value.trim();

        if (!email || !password) {
            SpendShare.showToast("Please fill in all fields", "warning");
            return;
        }

        setLoading(btn, true);

        try {
            const response = await fetch(API_BASE_URL + "/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const contentType = response.headers.get("content-type");
            let data;
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                data = {
                    success: false,
                    message: `Server returned non-JSON response: ${response.status} ${response.statusText}`
                };
            }

            if (!data.success) {
                SpendShare.showToast(data.message || "Login failed", "error");
                return;
            }

            SpendShare.saveAdminSession(data);

            SpendShare.showToast("Welcome, Administrator!", "success");
            setTimeout(() => {
                window.location.href = "../admin/admin-dashboard.html";
            }, 800);

        } catch (error) {
            console.error(error);
            SpendShare.showToast("Unable to connect to server", "error");
        } finally {
            setLoading(btn, false);
        }
    });
}

function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner"></i> Signing in...';
        btn.classList.add("loading");
    } else if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        btn.classList.remove("loading");
    }
}
