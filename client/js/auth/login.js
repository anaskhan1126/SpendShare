/**
 * SpendShare — Member Login
 */

document.addEventListener("DOMContentLoaded", () => {
    initPasswordToggle();
    initRememberMe();
    initLoginForm();
});

function initPasswordToggle() {
    const password = document.getElementById("password");
    const eye = document.querySelector(".toggle-password");
    if (!password || !eye) return;

    eye.addEventListener("click", () => {
        const isPassword = password.type === "password";
        password.type = isPassword ? "text" : "password";
        eye.classList.toggle("fa-eye", !isPassword);
        eye.classList.toggle("fa-eye-slash", isPassword);
    });
}

function initRememberMe() {
    const remember = document.getElementById("rememberMe");
    const saved = localStorage.getItem("rememberedUsername");
    if (saved && remember) {
        document.getElementById("username").value = saved;
        remember.checked = true;
    }
}

function initLoginForm() {
    const form = document.getElementById("loginForm");
    const btn = document.getElementById("loginBtn");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!username || !password) {
            SpendShare.showToast("Please fill in all fields", "warning");
            return;
        }

        const remember = document.getElementById("rememberMe")?.checked;
        if (remember) {
            localStorage.setItem("rememberedUsername", username);
        } else {
            localStorage.removeItem("rememberedUsername");
        }

        setLoading(btn, true);

        try {
            const response = await fetch(API_BASE_URL + "/api/member/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const contentType = response.headers.get("content-type");
            const data = (contentType && contentType.includes("application/json"))
                ? await response.json()
                : { success: false, message: `Server error: ${response.status} ${response.statusText}` };

            if (!response.ok || !data.success) {
                const duration = data.code === "PENDING_APPROVAL" ? 5000 : 3000;
                SpendShare.showToast(
                    data.message || "Login failed",
                    data.code === "PENDING_APPROVAL" ? "warning" : "error",
                    duration
                );
                return;
            }

            SpendShare.saveMemberSession(data);

            SpendShare.showToast("Welcome back!", "success");
            setTimeout(() => {
                window.location.href = "../member/dashboard.html";
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
