/**
 * SpendShare — Admin Dashboard
 */

let allMembers = [];
let pendingRequests = [];
let confirmCallback = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!SpendShare.requireAdminAuth()) return;

    SpendShare.initAdminAuthUI();
    SpendShare.initAdminLogout();
    initDropdownLogout();
    initRefresh();
    initMemberSearch();
    initConfirmDialog();
    initPendingRequestActions();
    initWelcomeFlatInfo();

    // Copy join code handler
    document.getElementById("copyCodeBtn")?.addEventListener("click", () => {
        const code = document.getElementById("flatCodeDisplay")?.textContent;
        if (code && code !== "—") {
            navigator.clipboard.writeText(code)
                .then(() => {
                    SpendShare.showToast("Flat code copied to clipboard!", "success", 2000);
                })
                .catch(err => {
                    console.error("Clipboard copy failed: ", err);
                    SpendShare.showToast("Failed to copy code", "error");
                });
        }
    });

    loadDashboard();
    loadMembers();
    loadPendingRequests();

    // Card navigation listeners
    const cards = ["cardSpent", "cardOwe", "cardReceive", "cardNet"];
    cards.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.cursor = "pointer";
    });

    document.getElementById("cardSpent")?.addEventListener("click", () => {
        window.location.href = "../member/expenses.html?filter=my-expenses";
    });
    document.getElementById("cardOwe")?.addEventListener("click", () => {
        window.location.href = "../member/settlement.html?filter=you-owe";
    });
    document.getElementById("cardReceive")?.addEventListener("click", () => {
        window.location.href = "../member/settlement.html?filter=owed-to-you";
    });
    document.getElementById("cardNet")?.addEventListener("click", () => {
        window.location.href = "../member/settlement.html?filter=net-balance";
    });
});

function initDropdownLogout() {
    document.getElementById("dropdownLogout")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

function initRefresh() {
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
        loadDashboard();
        loadMembers();
        loadPendingRequests();
        SpendShare.showToast("Dashboard refreshed", "success", 2000);
    });
}

function initWelcomeFlatInfo() {
    const subtitle = document.getElementById("welcomeSubtitle");
    const flatName = localStorage.getItem("adminFlatName");
    const flatCode = localStorage.getItem("adminFlatCode");

    if (subtitle && flatName) {
        subtitle.textContent = flatCode
            ? `Managing ${flatName} · Share code ${flatCode} with new members`
            : `Managing ${flatName}`;
    }
}

function revealStatCards() {
    document.querySelectorAll(".stat-card").forEach(card => {
        const skeleton = card.querySelector(".stat-card-skeleton");
        const content = card.querySelector(".stat-card-content");
        if (skeleton) skeleton.style.display = "none";
        if (content) content.style.display = "flex";
    });
}

/* ===========================
   CONFIRM DIALOG
=========================== */

function initConfirmDialog() {
    document.getElementById("confirmCancel")?.addEventListener("click", closeConfirm);
    document.getElementById("confirmOk")?.addEventListener("click", () => {
        if (confirmCallback) confirmCallback();
        closeConfirm();
    });
    document.getElementById("confirmDialog")?.addEventListener("click", (e) => {
        if (e.target.id === "confirmDialog") closeConfirm();
    });
}

function showConfirm(title, message, onConfirm) {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;
    confirmCallback = onConfirm;
    document.getElementById("confirmDialog").classList.add("open");
}

function closeConfirm() {
    document.getElementById("confirmDialog").classList.remove("open");
    confirmCallback = null;
}

/* ===========================
   DASHBOARD DATA
=========================== */

async function loadDashboard() {
    try {
        const data = await SpendShare.adminApiFetch("/admin/dashboard");

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load dashboard", "error");
            return;
        }

        if (data.flatCode) {
            localStorage.setItem("adminFlatCode", data.flatCode);
            const codeDisplay = document.getElementById("flatCodeDisplay");
            if (codeDisplay) {
                codeDisplay.textContent = data.flatCode;
            }
        }
        if (data.flatName) {
            localStorage.setItem("adminFlatName", data.flatName);
        }

        initWelcomeFlatInfo();
        revealStatCards();

        SpendShare.animateCounter(
            document.getElementById("totalMembers"),
            data.totalMembers,
            "",
            ""
        );
        SpendShare.animateCounter(
            document.getElementById("totalAmount"),
            data.totalAmount
        );
        SpendShare.animateCounter(
            document.getElementById("totalExpenses"),
            data.totalExpenses,
            "",
            ""
        );

        renderRecentExpenses(data.recentExpenses || []);

        await loadPersonalMetrics();

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load dashboard", "error");
    }
}

async function loadPersonalMetrics() {
    const { memberId } = SpendShare.getAuth();
    if (!memberId) return;

    try {
        const results = await Promise.allSettled([
            SpendShare.apiFetch(`/expense/member/${memberId}`),
            SpendShare.apiFetch("/settlement/member")
        ]);

        const expensesVal = results[0].status === "fulfilled" ? results[0].value : { success: false };
        const settlementsVal = results[1].status === "fulfilled" ? results[1].value : { success: false };

        const currentMonth = SpendShare.getCurrentMonth();
        const [year, mon] = currentMonth.split("-").map(Number);
        const startDate = new Date(year, mon - 1, 1);
        const endDate = new Date(year, mon, 1);

        let totalPaid = 0;
        if (expensesVal.success && expensesVal.expenses) {
            expensesVal.expenses.forEach(expense => {
                const d = new Date(expense.expenseDate);
                if (d >= startDate && d < endDate) {
                    totalPaid += expense.amount;
                }
            });
        }

        SpendShare.animateCounter(document.getElementById("totalPaid"), totalPaid);

        if (settlementsVal.success && settlementsVal.summary) {
            const { totalOwe, totalReceive, netBalance } = settlementsVal.summary;

            SpendShare.animateCounter(document.getElementById("totalOwe"), totalOwe);
            SpendShare.animateCounter(document.getElementById("totalReceive"), totalReceive);

            const netEl = document.getElementById("netBalance");
            const sign = netBalance >= 0 ? "+" : "-";
            SpendShare.animateCounter(netEl, Math.abs(netBalance));
            setTimeout(() => {
                if (netEl) {
                    netEl.textContent = `${sign}₹${Math.abs(netBalance).toFixed(2)}`;
                    netEl.style.color = netBalance >= 0 ? "var(--success)" : "var(--danger)";
                }
            }, 1300);
        }
    } catch (err) {
        console.error("Failed to load admin's personal metrics:", err);
    }
}

function renderRecentExpenses(expenses) {
    const tbody = document.getElementById("recentExpenseBody");
    const wrap = document.getElementById("expenseTableWrap");
    const empty = document.getElementById("expenseEmpty");

    if (!expenses.length) {
        tbody.innerHTML = "";
        wrap.style.display = "none";
        empty.style.display = "flex";
        return;
    }

    wrap.style.display = "block";
    empty.style.display = "none";

    tbody.innerHTML = expenses.map(expense => `
        <tr class="fade-in">
            <td>${SpendShare.formatDate(expense.expenseDate)}</td>
            <td><strong>${escapeHtml(expense.title)}</strong></td>
            <td>${escapeHtml(expense.paidBy?.name || "—")}</td>
            <td class="amount-cell">${SpendShare.formatCurrency(expense.amount)}</td>
            <td><span class="badge badge-primary">${escapeHtml(expense.category)}</span></td>
        </tr>
    `).join("");
}

/* ===========================
   MEMBERS
=========================== */

async function loadMembers() {
    try {
        const data = await SpendShare.adminApiFetch("/admin/members");

        if (!data.success) return;

        allMembers = data.members || [];
        renderMembers(allMembers);

    } catch (error) {
        console.error(error);
    }
}

function renderMembers(members) {
    const tbody = document.getElementById("memberTableBody");
    const wrap = document.getElementById("memberTableWrap");
    const empty = document.getElementById("memberEmpty");

    if (!members.length) {
        tbody.innerHTML = "";
        wrap.style.display = "none";
        empty.style.display = "flex";
        return;
    }

    wrap.style.display = "block";
    empty.style.display = "none";

    tbody.innerHTML = members.map(member => `
        <tr class="fade-in member-row">
            <td><strong>${escapeHtml(member.name)}</strong></td>
            <td>${escapeHtml(member.email)}</td>
            <td><span class="role-badge">${escapeHtml(member.role || "member")}</span></td>
        </tr>
    `).join("");
}

function initMemberSearch() {
    document.getElementById("memberSearch")?.addEventListener("input", (e) => {
        const search = e.target.value.trim().toLowerCase();
        const filtered = allMembers.filter(m =>
            m.name.toLowerCase().includes(search) ||
            m.email.toLowerCase().includes(search)
        );
        renderMembers(filtered);
    });
}

/* ===========================
   PENDING REQUESTS
=========================== */

async function loadPendingRequests() {
    try {
        const data = await SpendShare.adminApiFetch("/admin/member-requests");

        if (!data.success) return;

        pendingRequests = data.requests || [];
        const count = pendingRequests.length;

        const el = document.getElementById("pendingRequests");
        if (el) SpendShare.animateCounter(el, count, "", "");

        renderPendingRequestsPreview(pendingRequests);

    } catch (error) {
        console.error(error);
    }
}

function renderPendingRequestsPreview(requests) {
    const list = document.getElementById("pendingRequestsList");
    const empty = document.getElementById("pendingRequestsEmpty");
    const viewAll = document.getElementById("pendingViewAll");
    const preview = requests.slice(0, 5);

    if (!list || !empty) return;

    if (!preview.length) {
        list.innerHTML = "";
        list.style.display = "none";
        empty.style.display = "flex";
        if (viewAll) viewAll.style.display = "none";
        return;
    }

    list.style.display = "flex";
    empty.style.display = "none";
    if (viewAll) viewAll.style.display = requests.length > 5 ? "inline-flex" : "none";

    list.innerHTML = preview.map(req => {
        const requestedAt = req.requestedAt || req.createdAt;
        return `
            <div class="pending-request-item fade-in">
                <div class="request-avatar">${getInitials(req.name)}</div>
                <div class="pending-request-info">
                    <strong>${escapeHtml(req.name)}</strong>
                    <span class="pending-request-email">${escapeHtml(req.email)}</span>
                    <span class="pending-request-meta">
                        @${escapeHtml(req.username)} · ${formatRelativeDate(requestedAt)}
                    </span>
                </div>
                <div class="action-btns compact">
                    <button class="approve-btn" data-id="${req._id}" data-action="approve" title="Approve">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="reject-btn" data-id="${req._id}" data-action="reject" title="Reject">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function initPendingRequestActions() {
    document.getElementById("pendingRequestsList")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;

        const id = btn.dataset.id;
        const req = pendingRequests.find(r => String(r._id) === id);
        const name = req?.name || "this member";
        const action = btn.dataset.action;

        if (action === "approve") {
            showConfirm(
                "Approve Member",
                `Approve ${name} and grant access to your flat?`,
                () => approveRequest(id)
            );
        } else if (action === "reject") {
            showConfirm(
                "Reject Request",
                `Reject ${name}'s join request?`,
                () => rejectRequest(id)
            );
        }
    });
}

async function approveRequest(id) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/admin/member-request/${id}/approve`,
            {
                method: "PUT",
                headers: { Authorization: `Bearer ${SpendShare.getAdminAuth().token}` }
            }
        );
        const contentType = response.headers.get("content-type");
        const data = (contentType && contentType.includes("application/json"))
            ? await response.json()
            : { success: false, message: `Server error: ${response.status} ${response.statusText}` };

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to approve", "error");
            return;
        }

        SpendShare.showToast(data.message || "Member approved!", "success");
        loadPendingRequests();
        loadMembers();
        loadDashboard();

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to approve request", "error");
    }
}

async function rejectRequest(id) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/admin/member-request/${id}/reject`,
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${SpendShare.getAdminAuth().token}` }
            }
        );
        const contentType = response.headers.get("content-type");
        const data = (contentType && contentType.includes("application/json"))
            ? await response.json()
            : { success: false, message: `Server error: ${response.status} ${response.statusText}` };

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to reject", "error");
            return;
        }

        SpendShare.showToast(data.message || "Request rejected", "success");
        loadPendingRequests();

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to reject request", "error");
    }
}

function getInitials(name) {
    return (name || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join("");
}

function formatRelativeDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return SpendShare.formatDate(dateStr);
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
