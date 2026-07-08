/**
 * SpendShare — Shared UI Utilities
 * Theme, sidebar, toasts, animated counters, auth helpers
 */

const SpendShare = (() => {
    // Force HTTP/HTTPS server access
    if (window.location.protocol === "file:") {
        window.addEventListener("DOMContentLoaded", () => {
            document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#080D14; color:#F0F4FF; font-family:sans-serif; text-align:center; padding:20px; box-sizing:border-box;">
                    <div style="background:#111822; padding:40px; border-radius:16px; border:1px solid rgba(255,255,255,0.08); max-width:500px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                        <div style="font-size:64px; color:#ef4444; margin-bottom:20px;">⚠️</div>
                        <h2 style="margin-bottom:12px; font-weight:700; color:#fff;">Local File Access Blocked</h2>
                        <p style="color:#8898AA; font-size:14px; line-height:1.6; margin-bottom:24px;">
                            SpendShare must be accessed through the deployed Express Server (<strong>${API_BASE_URL}</strong>) to support full API requests, secure authentication, and data exports.
                        </p>
                        <a href="${API_BASE_URL}" style="background:#7C3AED; color:white; border:none; padding:12px 24px; border-radius:8px; font-weight:600; cursor:pointer; text-decoration:none; display:inline-block; transition:0.2s;">
                            Launch via Server
                        </a>
                    </div>
                </div>
            `;
        });
        throw new Error(`SpendShare cannot be run from local files (file://). Please use ${API_BASE_URL}`);
    }

    const API_BASE = `${API_BASE_URL}/api`;

    /* ===========================
       THEME
    =========================== */

    function initTheme() {
        const saved = localStorage.getItem("theme") || "light";
        document.documentElement.setAttribute("data-theme", saved);
        updateThemeIcon(saved);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        const next = current === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
        updateThemeIcon(next);
        showToast(next === "dark" ? "Dark mode enabled" : "Light mode enabled", "info");
    }

    function updateThemeIcon(theme) {
        const btn = document.getElementById("themeToggle");
        if (!btn) return;
        const icon = btn.querySelector("i");
        if (icon) {
            icon.className = theme === "dark"
                ? "fa-solid fa-sun"
                : "fa-solid fa-moon";
        }
    }

    /* ===========================
       SIDEBAR
    =========================== */

    function initSidebar() {
        const menuBtn = document.getElementById("menuBtn");
        const sidebar = document.querySelector(".sidebar");
        const overlay = document.querySelector(".sidebar-overlay");

        if (!menuBtn || !sidebar) return;

        menuBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            if (overlay) overlay.classList.toggle("active");
        });

        if (overlay) {
            overlay.addEventListener("click", () => {
                sidebar.classList.remove("open");
                overlay.classList.remove("active");
            });
        }

        sidebar.querySelectorAll(".menu a").forEach(link => {
            link.addEventListener("click", () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove("open");
                    if (overlay) overlay.classList.remove("active");
                }
            });
        });
    }

    /* ===========================
       PROFILE DROPDOWN
    =========================== */

    function initProfileDropdown() {
        const dropdown = document.querySelector(".profile-dropdown");
        if (!dropdown) return;

        const trigger = dropdown.querySelector(".profile-trigger");

        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("open");
        });

        document.addEventListener("click", () => {
            dropdown.classList.remove("open");
        });
    }

    /* ===========================
       TOAST NOTIFICATIONS
    =========================== */

    function getToastContainer() {
        let container = document.querySelector(".toast-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "toast-container";
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type = "info", duration = 3500) {
        const icons = {
            success: "fa-circle-check",
            error: "fa-circle-xmark",
            warning: "fa-triangle-exclamation",
            info: "fa-circle-info"
        };

        const container = getToastContainer();
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon"><i class="fa-solid ${icons[type] || icons.info}"></i></div>
            <div class="toast-content"><p>${message}</p></div>
            <button class="toast-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        `;

        container.appendChild(toast);

        const close = () => {
            toast.classList.add("toast-out");
            setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector(".toast-close").addEventListener("click", close);
        setTimeout(close, duration);
    }

    /* ===========================
       ANIMATED COUNTERS
    =========================== */

    function animateCounter(element, target, prefix = "₹", suffix = "", duration = 1200) {
        if (!element) return;

        const isCurrency = prefix === "₹";
        const start = 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + (target - start) * eased;

            if (isCurrency) {
                element.textContent = `${prefix}${current.toFixed(2)}`;
            } else {
                element.textContent = `${prefix}${Math.round(current)}${suffix}`;
            }

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                if (isCurrency) {
                    element.textContent = `${prefix}${target.toFixed(2)}`;
                } else {
                    element.textContent = `${prefix}${Math.round(target)}${suffix}`;
                }
            }
        }

        requestAnimationFrame(update);
    }

    /* ===========================
       AUTH HELPERS
    =========================== */

    function getAuth() {
        const isMember = localStorage.getItem("memberToken") !== null;
        if (isMember) {
            return {
                token: localStorage.getItem("memberToken"),
                memberId: localStorage.getItem("memberId"),
                memberName: localStorage.getItem("memberName"),
                flatId: localStorage.getItem("memberFlatId"),
                flatName: localStorage.getItem("memberFlatName"),
                flatCode: localStorage.getItem("memberFlatCode"),
                status: localStorage.getItem("memberStatus"),
                role: "member"
            };
        } else {
            return {
                token: localStorage.getItem("adminToken"),
                memberId: localStorage.getItem("adminMemberId") || localStorage.getItem("adminId"),
                memberName: localStorage.getItem("adminName"),
                flatId: localStorage.getItem("adminFlatId"),
                flatName: localStorage.getItem("adminFlatName"),
                flatCode: localStorage.getItem("adminFlatCode"),
                status: localStorage.getItem("adminStatus"),
                role: "admin"
            };
        }
    }

    function clearMemberSession() {
        [
            "memberToken", "member", "memberId", "memberName",
            "memberUsername", "memberEmail", "memberFlatId",
            "memberFlatName", "memberFlatCode", "memberStatus"
        ].forEach(key => localStorage.removeItem(key));
    }

    function clearAdminSession() {
        [
            "adminToken", "adminId", "adminName", "adminUsername",
            "adminEmail", "adminFlatId", "adminFlatName",
            "adminFlatCode", "adminStatus"
        ].forEach(key => localStorage.removeItem(key));
    }

    function saveMemberSession(data) {
        const member = data.member;
        if (member && member.role === "admin") {
            saveAdminSession(data);
            return;
        }
        clearAdminSession();
        localStorage.setItem("memberToken", data.token);
        localStorage.setItem("member", JSON.stringify(member));
        localStorage.setItem("memberId", member.id);
        localStorage.setItem("memberName", member.name);
        localStorage.setItem("memberUsername", member.username || "");
        localStorage.setItem("memberEmail", member.email || "");
        localStorage.setItem("memberStatus", member.status || "approved");
        if (member.flatId) localStorage.setItem("memberFlatId", String(member.flatId));
        if (member.flat?.name) localStorage.setItem("memberFlatName", member.flat.name);
        if (member.flat?.flatCode) localStorage.setItem("memberFlatCode", member.flat.flatCode);
    }

    function saveAdminSession(data) {
        clearMemberSession();
        const admin = data.admin || data.member;
        const flat = data.flat || admin?.flat;
        localStorage.setItem("adminToken", data.token);
        localStorage.setItem("adminId", admin.id || admin._id);
        localStorage.setItem("adminName", admin.name);
        localStorage.setItem("adminUsername", admin.username || "");
        localStorage.setItem("adminEmail", admin.email || "");
        localStorage.setItem("adminStatus", admin.status || "approved");
        const memberId = admin.memberId || data.memberId || admin.id || admin._id;
        if (memberId) localStorage.setItem("adminMemberId", memberId);
        const flatId = admin.flatId || flat?.id || flat?._id;
        if (flatId) localStorage.setItem("adminFlatId", String(flatId));
        if (flat?.name) localStorage.setItem("adminFlatName", flat.name);
        if (flat?.flatCode) localStorage.setItem("adminFlatCode", flat.flatCode);
    }

    function requireAuth() {
        const auth = getAuth();
        if (!auth.token) {
            showToast("Please login first", "warning");
            setTimeout(() => {
                window.location.href = "../auth/login.html";
            }, 1000);
            return false;
        }
        if (auth.status === "pending") {
            showToast("Your request is waiting for admin approval.", "warning", 4000);
            clearMemberSession();
            setTimeout(() => {
                window.location.href = "../auth/login.html";
            }, 1500);
            return false;
        }

        // If user is Admin, always redirect to Admin Dashboard when landing on Member Dashboard
        const path = window.location.pathname;
        if (auth.role === "admin" && path.includes("/member/dashboard.html")) {
            let redirectPath = "../admin/admin-dashboard.html";
            if (path.includes("/admin/")) {
                redirectPath = "admin-dashboard.html";
            }
            window.location.href = redirectPath;
            return false;
        }
        return true;
    }

    function initAuthUI() {
        const { memberName } = getAuth();

        const welcomeText = document.getElementById("welcomeText");
        if (welcomeText && memberName) {
            welcomeText.textContent = `Welcome back, ${memberName} 👋`;
        }

        const profileName = document.getElementById("memberName");
        if (profileName && memberName) {
            profileName.textContent = memberName;
        }

        const dateEl = document.getElementById("currentDate");
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            });
        }

        const flatName = localStorage.getItem("memberFlatName") || localStorage.getItem("adminFlatName");
        const welcomeSubtitle = document.getElementById("welcomeSubtitle");
        if (welcomeSubtitle && flatName) {
            welcomeSubtitle.textContent = `Managing expenses for ${flatName}`;
        }
    }

    /* ===========================
       LOGOUT
    =========================== */

    function initLogout() {
        const logoutBtn = document.getElementById("logoutBtn");
        if (!logoutBtn) return;

        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to logout?")) {
                clearMemberSession();
                showToast("Logged out successfully", "success");
                setTimeout(() => {
                    window.location.href = "../auth/login.html";
                }, 800);
            }
        });
    }

    /* ===========================
       FORMATTERS
    =========================== */

    function formatCurrency(amount) {
        return `₹${Number(amount).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function getCurrentMonth() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        return `${year}-${month}`;
    }

    function getPreviousMonth(monthStr) {
        const [year, mon] = monthStr.split("-").map(Number);
        const date = new Date(year, mon - 2, 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    /* ===========================
       API FETCH HELPER
    =========================== */

    async function apiFetch(endpoint, options = {}) {
        try {
            const { token, role } = getAuth();
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...options.headers
                }
            });
            const contentType = response.headers.get("content-type");
            const data = (contentType && contentType.includes("application/json"))
                ? await response.json()
                : { success: false, message: `Server returned non-JSON response: ${response.status} ${response.statusText}` };
            if (response.status === 403 && data.code === "PENDING_APPROVAL") {
                showToast(data.message || "Waiting for admin approval.", "warning", 4000);
                clearMemberSession();
                setTimeout(() => { window.location.href = "../auth/login.html"; }, 1500);
            } else if (response.status === 401) {
                showToast("Session expired. Please login again.", "warning");
                if (role === "admin") {
                    clearAdminSession();
                    setTimeout(() => { window.location.href = "../auth/admin-login.html"; }, 1000);
                } else {
                    clearMemberSession();
                    setTimeout(() => { window.location.href = "../auth/login.html"; }, 1000);
                }
            }
            return data;
        } catch (error) {
            console.error("API Fetch Error:", error);
            showToast("Network error. Unable to connect to server.", "error");
            return { success: false, message: "Network connection error. Please try again later." };
        }
    }

    /* ===========================
       ADMIN AUTH
    =========================== */

    function getAdminAuth() {
        return {
            token: localStorage.getItem("adminToken"),
            adminId: localStorage.getItem("adminId"),
            adminName: localStorage.getItem("adminName"),
            flatId: localStorage.getItem("adminFlatId"),
            flatName: localStorage.getItem("adminFlatName"),
            flatCode: localStorage.getItem("adminFlatCode"),
            status: localStorage.getItem("adminStatus")
        };
    }

    function requireAdminAuth() {
        const { token } = getAdminAuth();
        if (!token) {
            showToast("Please login as admin", "warning");
            setTimeout(() => {
                window.location.href = "../auth/admin-login.html";
            }, 1000);
            return false;
        }
        return true;
    }

    function initAdminAuthUI() {
        const { adminName } = getAdminAuth();
        const welcomeText = document.getElementById("welcomeText");
        if (welcomeText && adminName) {
            welcomeText.textContent = `Welcome back, ${adminName} 👋`;
        }
        const profileName = document.getElementById("adminName");
        if (profileName && adminName) {
            profileName.textContent = adminName;
        }
        const dateEl = document.getElementById("currentDate");
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            });
        }

        // Profile Dropdown
        const dropdownMenu = document.querySelector(".profile-dropdown .dropdown-menu");
        if (dropdownMenu && !dropdownMenu.querySelector('a[href*="settings.html"]')) {
            const divider = dropdownMenu.querySelector(".dropdown-divider");
            const link = document.createElement("a");
            link.href = "settings.html";
            link.innerHTML = `<i class="fa-solid fa-gear"></i> Settings`;
            if (divider) {
                dropdownMenu.insertBefore(link, divider);
            } else {
                dropdownMenu.appendChild(link);
            }
        }
    }

    async function adminApiFetch(endpoint, options = {}) {
        try {
            const { token } = getAdminAuth();
            const response = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...options.headers
                }
            });
            const contentType = response.headers.get("content-type");
            const data = (contentType && contentType.includes("application/json"))
                ? await response.json()
                : { success: false, message: `Server returned non-JSON response: ${response.status} ${response.statusText}` };
            if (response.status === 401 || response.status === 403) {
                showToast(data.message || "Session expired. Please login again.", "warning");
                clearAdminSession();
                setTimeout(() => { window.location.href = "../auth/admin-login.html"; }, 1000);
            }
            return data;
        } catch (error) {
            console.error("Admin API Fetch Error:", error);
            showToast("Network error. Unable to connect to server.", "error");
            return { success: false, message: "Network connection error. Please try again later." };
        }
    }

    function initAdminLogout() {
        const logoutBtn = document.getElementById("logoutBtn");
        if (!logoutBtn) return;

        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to logout?")) {
                clearAdminSession();
                showToast("Logged out successfully", "success");
                setTimeout(() => {
                    window.location.href = "../auth/admin-login.html";
                }, 800);
            }
        });
    }

    /* ===========================
       INIT
    =========================== */

    function renderSidebarMenu() {
        const menuContainer = document.querySelector(".sidebar .menu");
        if (!menuContainer) return;

        const isAdmin = localStorage.getItem("adminToken") !== null;
        const path = window.location.pathname;
        const currentFile = path.split("/").pop() || "dashboard.html";
        
        const inAdminDir = path.includes("/admin/");
        const inMemberDir = path.includes("/member/");
        
        let menuItems = [];

        if (isAdmin) {
            // Admin Sidebar Menu
            const adminPrefix = inAdminDir ? "" : "../admin/";
            const memberPrefix = inMemberDir ? "" : "../member/";
            menuItems = [
                {
                    name: "Dashboard",
                    icon: "fa-house",
                    href: adminPrefix + "admin-dashboard.html",
                    file: "admin-dashboard.html"
                },
                {
                    name: "Add Member",
                    icon: "fa-user-plus",
                    href: adminPrefix + "add-member.html",
                    file: "add-member.html"
                },
                {
                    name: "Add Expense",
                    icon: "fa-plus",
                    href: memberPrefix + "add-expense.html",
                    file: "add-expense.html"
                },
                {
                    name: "Members",
                    icon: "fa-users",
                    href: adminPrefix + "member-management.html",
                    file: "member-management.html"
                },
                {
                    name: "Expenses",
                    icon: "fa-receipt",
                    href: adminPrefix + "expense-history.html",
                    file: "expense-history.html"
                },
                {
                    name: "Settlement",
                    icon: "fa-handshake",
                    href: memberPrefix + "settlement.html",
                    file: "settlement.html"
                },
                {
                    name: "Monthly Summary",
                    icon: "fa-chart-column",
                    href: memberPrefix + "monthly-summary.html",
                    file: "monthly-summary.html"
                },
                {
                    name: "Profile",
                    icon: "fa-user",
                    href: adminPrefix + "profile.html",
                    file: "profile.html"
                },
                {
                    name: "Settings",
                    icon: "fa-gear",
                    href: adminPrefix + "settings.html",
                    file: "settings.html"
                }
            ];
        } else {
            // Regular Member Sidebar Menu
            const memberPrefix = inMemberDir ? "" : "../member/";
            menuItems = [
                {
                    name: "Dashboard",
                    icon: "fa-house",
                    href: memberPrefix + "dashboard.html",
                    file: "dashboard.html"
                },
                {
                    name: "Add Expense",
                    icon: "fa-plus",
                    href: memberPrefix + "add-expense.html",
                    file: "add-expense.html"
                },
                {
                    name: "Expenses",
                    icon: "fa-receipt",
                    href: memberPrefix + "expenses.html",
                    file: "expenses.html"
                },
                {
                    name: "Settlement",
                    icon: "fa-handshake",
                    href: memberPrefix + "settlement.html",
                    file: "settlement.html"
                },
                {
                    name: "Members",
                    icon: "fa-users-line",
                    href: memberPrefix + "members.html",
                    file: "members.html"
                },
                {
                    name: "Monthly Summary",
                    icon: "fa-chart-column",
                    href: memberPrefix + "monthly-summary.html",
                    file: "monthly-summary.html"
                },
                {
                    name: "Profile",
                    icon: "fa-user",
                    href: memberPrefix + "profile.html",
                    file: "profile.html"
                },
                {
                    name: "Settings",
                    icon: "fa-gear",
                    href: memberPrefix + "settings.html",
                    file: "settings.html"
                }
            ];
        }

        menuContainer.innerHTML = menuItems.map(item => {
            const isMatch = currentFile === item.file;
            const activeClass = isMatch ? ' class="active"' : '';
            return `
                <li${activeClass}>
                    <a href="${item.href}">
                        <i class="fa-solid ${item.icon}"></i>
                        <span>${item.name}</span>
                    </a>
                </li>
            `;
        }).join("");
    }

    function init() {
        initTheme();
        renderSidebarMenu();
        initSidebar();
        initProfileDropdown();
        initLogout();

        const themeBtn = document.getElementById("themeToggle");
        if (themeBtn) {
            themeBtn.addEventListener("click", toggleTheme);
        }
    }

    function canConfirmSettlement(currentUser, settlement) {
        if (!settlement || !currentUser) return false;
        
        const status = (settlement.status || "").toLowerCase();
        if (status !== "pending") return false;

        const currentUserId = (currentUser._id || currentUser.memberId || currentUser.id || "").toString();
        if (!currentUserId) return false;

        const receiver = settlement.toMember || settlement.to;
        if (!receiver) return false;

        const receiverId = (receiver._id || receiver).toString();
        return currentUserId === receiverId;
    }

    function getSettlementActionHtml(currentUser, settlement) {
        if (!settlement || !currentUser) return "";

        const status = (settlement.status || "").toLowerCase();
        if (status === "paid") {
            return `<button class="status-paid-btn" disabled><i class="fa-solid fa-check"></i> Paid</button>`;
        }

        if (status === "pending") {
            if (canConfirmSettlement(currentUser, settlement)) {
                return `<button class="action-btn pay-btn" data-id="${settlement._id}">
                    <i class="fa-solid fa-check"></i> Mark Received
                </button>`;
            }

            const currentUserId = (currentUser._id || currentUser.memberId || currentUser.id || "").toString();
            const fromId = (settlement.from?._id || settlement.from || "").toString();
            if (currentUserId === fromId) {
                return `<button class="waiting-badge" disabled><i class="fa-solid fa-hourglass-half"></i> Waiting for Receiver</button>`;
            }

            return `<span class="waiting-badge"><i class="fa-solid fa-clock"></i> Pending</span>`;
        }

        return "";
    }

    return {
        canConfirmSettlement,
        getSettlementActionHtml,
        init,
        initTheme,
        toggleTheme,
        updateThemeIcon,
        initSidebar,
        initProfileDropdown,
        initAuthUI,
        initLogout,
        requireAuth,
        getAuth,
        saveMemberSession,
        saveAdminSession,
        clearMemberSession,
        clearAdminSession,
        showToast,
        animateCounter,
        formatCurrency,
        formatDate,
        getCurrentMonth,
        getPreviousMonth,
        apiFetch,
        adminApiFetch,
        getAdminAuth,
        requireAdminAuth,
        initAdminAuthUI,
        initAdminLogout,
        API_BASE
    };
})();

document.addEventListener("DOMContentLoaded", () => {
    SpendShare.init();
});
