/**
 * SpendShare — Members
 */

let allMembers = [];
let filteredMembers = [];
let pendingRequests = [];
const AVATAR_CLASSES = ["", "alt-1", "alt-2", "alt-3", "alt-4"];

document.addEventListener("DOMContentLoaded", async () => {
    if (!SpendShare.requireAuth()) return;

    SpendShare.initAuthUI();
    initDropdownLogout();
    initFilters();
    initModal();
    await loadMembers();
    
    // Check if logged in user is admin
    const isAdmin = localStorage.getItem("adminToken") !== null;
    if (isAdmin) {
        // Show headers and panels
        document.querySelectorAll(".admin-actions-header").forEach(h => h.style.display = "table-cell");
        const panel = document.getElementById("pendingRequestsPanel");
        if (panel) panel.style.display = "block";
        await loadPendingRequests();
    }
});

function initDropdownLogout() {
    document.getElementById("dropdownLogout")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

/* ===========================
   LOAD MEMBERS
=========================== */

async function loadMembers() {
    try {
        const data = await SpendShare.apiFetch("/member/members");

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load members", "error");
            return;
        }

        allMembers = data.members || [];
        applyFilters();

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load members", "error");
    }
}

async function loadPendingRequests() {
    try {
        const data = await SpendShare.apiFetch("/admin/member-requests");
        if (data.success) {
            pendingRequests = data.requests || [];
            renderPendingRequests();
        }
    } catch (error) {
        console.error("Failed to load requests:", error);
    }
}

/* ===========================
   FILTER & SORT
=========================== */

function initFilters() {
    document.getElementById("memberSearch")?.addEventListener("input", applyFilters);
    document.getElementById("sortFilter")?.addEventListener("change", applyFilters);
}

function applyFilters() {
    const search = document.getElementById("memberSearch")?.value.trim().toLowerCase() || "";
    const sortBy = document.getElementById("sortFilter")?.value || "name";

    filteredMembers = [...allMembers];

    if (search) {
        filteredMembers = filteredMembers.filter(m =>
            m.name.toLowerCase().includes(search) ||
            m.email.toLowerCase().includes(search)
        );
    }

    filteredMembers.sort((a, b) => {
        switch (sortBy) {
            case "expenses":
                return b.expenseCount - a.expenseCount;
            case "spent":
                return b.totalPaid - a.totalPaid;
            default:
                return a.name.localeCompare(b.name);
        }
    });

    updateStats();
    renderCards();
    renderTable();
}

function updateStats() {
    const totalExpenses = allMembers.reduce((s, m) => s + m.expenseCount, 0);
    const combined = allMembers.reduce((s, m) => s + m.totalPaid, 0);

    document.getElementById("totalMembers").textContent = allMembers.length;
    document.getElementById("totalExpenses").textContent = totalExpenses;
    document.getElementById("combinedSpending").textContent = SpendShare.formatCurrency(combined);
    document.getElementById("memberCount").textContent =
        `${filteredMembers.length} member${filteredMembers.length !== 1 ? "s" : ""}`;
}

/* ===========================
   RENDER CARDS
=========================== */

function renderCards() {
    const grid = document.getElementById("memberCardsGrid");
    const empty = document.getElementById("cardsEmpty");
    const { memberId } = SpendShare.getAuth();

    if (!filteredMembers.length) {
        grid.innerHTML = "";
        grid.style.display = "none";
        empty.style.display = "flex";
        return;
    }

    empty.style.display = "none";
    grid.style.display = "grid";

    // Calculate equal share
    const totalSpent = allMembers.reduce((s, m) => s + m.totalPaid, 0);
    const equalShare = allMembers.length > 0 ? totalSpent / allMembers.length : 0;

    grid.innerHTML = filteredMembers.map((member, i) => {
        const isYou = member._id === memberId;
        const avatarClass = AVATAR_CLASSES[i % AVATAR_CLASSES.length];
        const balance = member.totalPaid - equalShare;
        
        let balText = "";
        if (balance > 0) {
            balText = `<span style="color:#0284c7; font-weight:700;">+₹${balance.toFixed(2)} (Gets Back)</span>`;
        } else if (balance < 0) {
            balText = `<span style="color:#d97706; font-weight:700;">-₹${Math.abs(balance).toFixed(2)} (Owes)</span>`;
        } else {
            balText = `<span style="color:var(--text-muted);">₹0.00 (Settled)</span>`;
        }

        const roleBadge = member.role === "admin" 
            ? `<span class="badge badge-primary" style="font-size:10px; padding:2px 6px;">Admin</span>` 
            : `<span class="badge badge-secondary" style="font-size:10px; padding:2px 6px;">Member</span>`;

        return `
            <div class="member-card fade-in ${isYou ? "is-you" : ""}" data-id="${member._id}">
                <div class="member-card-top">
                    <div class="member-avatar ${avatarClass}">${getInitials(member.name)}</div>
                    <div class="member-card-info">
                        <h4 style="display:flex; align-items:center; gap:6px;">
                            ${escapeHtml(member.name)}
                            ${roleBadge}
                        </h4>
                        <p>${escapeHtml(member.email)}</p>
                    </div>
                </div>
                <div class="member-card-stats" style="flex-direction:column; gap:8px; align-items:flex-start; border-top:1px solid var(--border-light); padding-top:12px; margin-top:12px;">
                    <div style="display:flex; justify-content:space-between; width:100%; font-size:12px;">
                        <span>Join Date:</span>
                        <strong>${SpendShare.formatDate(member.createdAt)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; width:100%; font-size:12px;">
                        <span>Expenses Added:</span>
                        <strong>${member.expenseCount}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; width:100%; font-size:12px;">
                        <span>Total Spent:</span>
                        <strong>${SpendShare.formatCurrency(member.totalPaid)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; width:100%; font-size:12px; border-top:1px dashed var(--border-light); padding-top:8px; margin-top:4px;">
                        <span>Net Balance:</span>
                        <strong>${balText}</strong>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    grid.querySelectorAll(".member-card").forEach(card => {
        card.style.cursor = "pointer";
        card.addEventListener("click", () => openModal(card.dataset.id));
    });
}

/* ===========================
   RENDER TABLE
=========================== */

function renderTable() {
    const tbody = document.getElementById("membersTableBody");
    const wrapper = document.getElementById("tableWrapper");
    const empty = document.getElementById("tableEmpty");
    const { memberId } = SpendShare.getAuth();
    const isAdmin = localStorage.getItem("adminToken") !== null;

    if (!filteredMembers.length) {
        tbody.innerHTML = "";
        wrapper.style.display = "none";
        empty.style.display = "flex";
        return;
    }

    wrapper.style.display = "block";
    empty.style.display = "none";

    const totalSpent = allMembers.reduce((s, m) => s + m.totalPaid, 0);
    const equalShare = allMembers.length > 0 ? totalSpent / allMembers.length : 0;

    tbody.innerHTML = filteredMembers.map((member, i) => {
        const isYou = member._id === memberId;
        const balance = member.totalPaid - equalShare;
        
        let balText = "";
        if (balance > 0) {
            balText = `<span style="color:#0284c7; font-weight:700;">+₹${balance.toFixed(2)} (Gets Back)</span>`;
        } else if (balance < 0) {
            balText = `<span style="color:#d97706; font-weight:700;">-₹${Math.abs(balance).toFixed(2)} (Owes)</span>`;
        } else {
            balText = `<span style="color:var(--text-muted);">₹0.00 (Settled)</span>`;
        }

        const roleBadge = member.role === "admin" 
            ? `<span style="background:#e0f2fe; color:#0369a1; padding: 4px 8px; border-radius: 4px; font-weight:600; font-size:12px;">Admin</span>` 
            : `<span style="background:#f3f4f6; color:#374151; padding: 4px 8px; border-radius: 4px; font-weight:600; font-size:12px;">Member</span>`;

        let actionCell = "";
        if (isAdmin) {
            actionCell = isYou 
                ? `<td class="admin-actions-cell" style="padding: 12px 16px;">—</td>` 
                : `<td class="admin-actions-cell" style="padding: 12px 16px;">
                       <button class="delete-btn" data-id="${member._id}" data-name="${escapeHtml(member.name)}" style="background:#fee2e2; color:#b91c1c; border:none; padding:6px 12px; border-radius:6px; font-weight:600; cursor:pointer;" onclick="deleteMember(event, '${member._id}', '${escapeHtml(member.name)}')">
                           <i class="fa-solid fa-trash"></i> Remove
                       </button>
                   </td>`;
        }

        return `
            <tr class="fade-in ${isYou ? "is-you" : ""}">
                <td style="padding: 12px 16px;">
                    <div class="member-cell">
                        <div class="mini-avatar">${getInitials(member.name)}</div>
                        <strong>${escapeHtml(member.name)}</strong>
                        ${isYou ? '<span class="you-badge" style="background:#d1fae5; color:#065f46; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px;">You</span>' : ""}
                    </div>
                </td>
                <td style="padding: 12px 16px;">${roleBadge}</td>
                <td style="padding: 12px 16px;">${escapeHtml(member.email)}</td>
                <td style="padding: 12px 16px;">${escapeHtml(member.phone || "—")}</td>
                <td style="padding: 12px 16px;">${SpendShare.formatDate(member.createdAt)}</td>
                <td style="padding: 12px 16px;"><span class="badge badge-success">${escapeHtml(member.status)}</span></td>
                <td style="padding: 12px 16px; text-align:center;">${member.expenseCount}</td>
                <td style="padding: 12px 16px; font-weight:700;">${balText}</td>
                ${actionCell}
            </tr>
        `;
    }).join("");
}

function renderPendingRequests() {
    const tbody = document.getElementById("pendingRequestsBody");
    if (!tbody) return;

    if (pendingRequests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No pending requests.</td></tr>`;
        return;
    }

    tbody.innerHTML = pendingRequests.map(req => `
        <tr>
            <td style="padding: 12px 16px;"><strong>${escapeHtml(req.name)}</strong></td>
            <td style="padding: 12px 16px;">@${escapeHtml(req.username)}</td>
            <td style="padding: 12px 16px;">${escapeHtml(req.email)}</td>
            <td style="padding: 12px 16px;">${escapeHtml(req.phone || "—")}</td>
            <td style="padding: 12px 16px;">${SpendShare.formatDate(req.createdAt)}</td>
            <td style="padding: 12px 16px;">
                <div style="display:flex; gap:8px;">
                    <button style="background:#d1fae5; color:#065f46; border:none; padding:6px 12px; border-radius:6px; font-weight:600; cursor:pointer;" onclick="approveRequest('${req._id}')">
                        <i class="fa-solid fa-check"></i> Approve
                    </button>
                    <button style="background:#fee2e2; color:#b91c1c; border:none; padding:6px 12px; border-radius:6px; font-weight:600; cursor:pointer;" onclick="rejectRequest('${req._id}')">
                        <i class="fa-solid fa-xmark"></i> Reject
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
}

/* ===========================
   ACTIONS
=========================== */

window.approveRequest = async (id) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/member-request/${id}/approve`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${SpendShare.getAdminAuth().token}` }
        });
        const contentType = response.headers.get("content-type");
        const data = (contentType && contentType.includes("application/json"))
            ? await response.json()
            : { success: false, message: `Server error: ${response.status} ${response.statusText}` };

        if (data.success) {
            SpendShare.showToast("Member approved successfully", "success");
            await loadPendingRequests();
            await loadMembers();
        } else {
            SpendShare.showToast(data.message || "Failed to approve request", "error");
        }
    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to approve request", "error");
    }
};

window.rejectRequest = async (id) => {
    if (!confirm("Are you sure you want to reject this request?")) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/member-request/${id}/reject`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${SpendShare.getAdminAuth().token}` }
        });
        const contentType = response.headers.get("content-type");
        const data = (contentType && contentType.includes("application/json"))
            ? await response.json()
            : { success: false, message: `Server error: ${response.status} ${response.statusText}` };

        if (data.success) {
            SpendShare.showToast("Request rejected successfully", "success");
            await loadPendingRequests();
        } else {
            SpendShare.showToast(data.message || "Failed to reject request", "error");
        }
    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to reject request", "error");
    }
};

window.deleteMember = async (event, id, name) => {
    event.stopPropagation();
    if (!confirm(`Are you sure you want to remove ${name} from this flat? This cannot be undone.`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/member/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${SpendShare.getAdminAuth().token}` }
        });
        const contentType = response.headers.get("content-type");
        const data = (contentType && contentType.includes("application/json"))
            ? await response.json()
            : { success: false, message: `Server error: ${response.status} ${response.statusText}` };

        if (data.success) {
            SpendShare.showToast("Member removed successfully", "success");
            await loadMembers();
        } else {
            SpendShare.showToast(data.message || "Failed to remove member", "error");
        }
    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to remove member", "error");
    }
};

/* ===========================
   MODAL
=========================== */

function initModal() {
    document.getElementById("modalClose")?.addEventListener("click", closeModal);

    document.getElementById("memberModal")?.addEventListener("click", (e) => {
        if (e.target.id === "memberModal") closeModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });
}

function openModal(id) {
    const member = allMembers.find(m => m._id === id);
    if (!member) return;

    document.getElementById("modalAvatar").textContent = getInitials(member.name);
    document.getElementById("modalMemberName").textContent = member.name;
    document.getElementById("modalMemberEmail").textContent = member.email;
    document.getElementById("modalExpenseCount").textContent = member.expenseCount;
    document.getElementById("modalTotalPaid").textContent = SpendShare.formatCurrency(member.totalPaid);

    const avg = member.expenseCount > 0
        ? member.totalPaid / member.expenseCount
        : 0;
    document.getElementById("modalAvgExpense").textContent = SpendShare.formatCurrency(avg);

    document.getElementById("memberModal").classList.add("open");
}

function closeModal() {
    document.getElementById("memberModal").classList.remove("open");
}

/* ===========================
   UTILS
=========================== */

function getInitials(name) {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
