/**
 * SpendShare — Admin Add Member
 */

let confirmCallback = null;
let pendingRequests = [];
const isLegacyAdmin = !localStorage.getItem("adminFlatId");

document.addEventListener("DOMContentLoaded", () => {
    if (!SpendShare.requireAdminAuth()) return;

    SpendShare.initAdminAuthUI();
    SpendShare.initAdminLogout();
    initDropdownLogout();
    initConfirmDialog();
    initPasswordToggle();
    initForm();
    initRequestActions();
    initRefresh();
    initFlatInfoBanner();

    loadPendingRequests();
});

function initDropdownLogout() {
    document.getElementById("dropdownLogout")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

function initRefresh() {
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
        loadPendingRequests();
        SpendShare.showToast("Requests refreshed", "info", 2000);
    });
}

function initFlatInfoBanner() {
    const banner = document.getElementById("flatInfoBanner");
    const textEl = document.getElementById("flatInfoText");
    const copyBtn = document.getElementById("copyFlatCodeBtn");
    const flatName = localStorage.getItem("adminFlatName");
    const flatCode = localStorage.getItem("adminFlatCode");

    if (!banner || !flatName) return;

    banner.classList.remove("hidden");
    textEl.textContent = flatCode
        ? `${flatName} · Code: ${flatCode}`
        : flatName;

    if (flatCode && copyBtn) {
        copyBtn.classList.remove("hidden");
        copyBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(flatCode);
                SpendShare.showToast("Flat code copied!", "success");
            } catch {
                SpendShare.showToast("Could not copy flat code", "warning");
            }
        });
    }
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
   PENDING REQUESTS
=========================== */

async function loadPendingRequests() {
    try {
        const data = await SpendShare.adminApiFetch("/admin/member-requests");

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load requests", "error");
            return;
        }

        pendingRequests = data.requests || [];
        document.getElementById("requestCount").textContent =
            `${pendingRequests.length} pending`;

        renderRequests(pendingRequests);

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load requests", "error");
    }
}

function renderRequests(requests) {
    const tbody = document.getElementById("requestTableBody");
    const wrap = document.getElementById("requestTableWrap");
    const empty = document.getElementById("requestEmpty");
    const showFlatCol = isLegacyAdmin && requests.some(r => r.flatId || r.flatCode);

    document.querySelectorAll(".flat-col").forEach(el => {
        el.classList.toggle("hidden", !showFlatCol);
    });

    if (!requests.length) {
        tbody.innerHTML = "";
        wrap.style.display = "none";
        empty.style.display = "flex";
        return;
    }

    wrap.style.display = "block";
    empty.style.display = "none";

    const colSpan = showFlatCol ? 5 : 4;

    tbody.innerHTML = requests.map(req => {
        const requestedAt = getRequestDate(req);
        const flatLabel = getFlatLabel(req);

        return `
        <tr class="fade-in">
            <td>
                <div class="request-member">
                    <div class="request-avatar">${getInitials(req.name)}</div>
                    <div>
                        <strong>${escapeHtml(req.name)}</strong>
                        <span class="request-username">@${escapeHtml(req.username)}</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="request-contact">
                    <span><i class="fa-solid fa-envelope"></i> ${escapeHtml(req.email)}</span>
                    <span><i class="fa-solid fa-phone"></i> ${escapeHtml(req.phone || "—")}</span>
                </div>
            </td>
            ${showFlatCol ? `<td><span class="flat-tag">${escapeHtml(flatLabel)}</span></td>` : ""}
            <td>
                <div class="request-date">
                    <span>${SpendShare.formatDate(requestedAt)}</span>
                    <small>${formatRelativeDate(requestedAt)}</small>
                </div>
            </td>
            <td>
                <div class="action-btns">
                    <button class="approve-btn" data-id="${req._id}" data-action="approve">
                        <i class="fa-solid fa-check"></i> Approve
                    </button>
                    <button class="reject-btn" data-id="${req._id}" data-action="reject">
                        <i class="fa-solid fa-xmark"></i> Reject
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join("");
}

function initRequestActions() {
    document.getElementById("requestTableBody")?.addEventListener("click", (e) => {
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
                `Reject ${name}'s join request? They will need to register again.`,
                () => rejectRequest(id)
            );
        }
    });
}

async function approveRequest(id) {
    try {
        const response = await fetch(
            `${SpendShare.API_BASE}/admin/member-request/${id}/approve`,
            {
                method: "PUT",
                headers: { Authorization: `Bearer ${SpendShare.getAdminAuth().token}` }
            }
        );
        const data = await response.json();

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to approve", "error");
            return;
        }

        SpendShare.showToast(data.message || "Member approved!", "success");
        loadPendingRequests();

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to approve request", "error");
    }
}

async function rejectRequest(id) {
    try {
        const response = await fetch(
            `${SpendShare.API_BASE}/admin/member-request/${id}/reject`,
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${SpendShare.getAdminAuth().token}` }
            }
        );
        const data = await response.json();

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

/* ===========================
   MANUAL ADD FORM
=========================== */

function initPasswordToggle() {
    document.querySelector(".toggle-password")?.addEventListener("click", (e) => {
        const btn = e.currentTarget;
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        const icon = btn.querySelector("i");
        if (icon) icon.className = isPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
    });
}

const rules = {
    name: { validate: v => v.trim().length >= 2, message: "Name must be at least 2 characters" },
    username: { validate: v => v.trim().length >= 3, message: "Username must be at least 3 characters" },
    email: { validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: "Enter a valid email" },
    phone: { validate: v => v.trim().length >= 10, message: "Enter a valid phone number" },
    password: { validate: v => v.length >= 6, message: "Password must be at least 6 characters" }
};

function validateField(name) {
    const input = document.getElementById(name);
    const group = document.querySelector(`[data-field="${name}"]`);
    const errorEl = group?.querySelector(".field-error");
    if (!input || !group || !rules[name]) return true;

    const isValid = rules[name].validate(input.value.trim());
    group.classList.toggle("has-error", !isValid);
    if (errorEl) errorEl.textContent = isValid ? "" : rules[name].message;
    return isValid;
}

function initForm() {
    Object.keys(rules).forEach(name => {
        document.getElementById(name)?.addEventListener("blur", () => validateField(name));
    });

    document.getElementById("addMemberForm")?.addEventListener("submit", handleSubmit);
}

async function handleSubmit(e) {
    e.preventDefault();

    if (!Object.keys(rules).every(validateField)) {
        SpendShare.showToast("Please fix the errors in the form", "error");
        return;
    }

    const submitBtn = document.getElementById("submitBtn");
    const btnText = submitBtn.querySelector("span");
    const btnLoader = submitBtn.querySelector(".btn-loader");

    const body = {
        name: document.getElementById("name").value.trim(),
        username: document.getElementById("username").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        password: document.getElementById("password").value
    };

    submitBtn.disabled = true;
    btnText.style.display = "none";
    btnLoader.style.display = "flex";

    try {
        const response = await fetch(`${SpendShare.API_BASE}/admin/add-member`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SpendShare.getAdminAuth().token}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to add member", "error");
            return;
        }

        SpendShare.showToast(data.message || "Member added successfully!", "success");
        document.getElementById("addMemberForm").reset();
        document.querySelectorAll(".float-group").forEach(g => g.classList.remove("has-error"));

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to add member", "error");
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = "inline";
        btnLoader.style.display = "none";
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

function getRequestDate(req) {
    return req.requestedAt || req.createdAt;
}

function getFlatLabel(req) {
    if (req.flatId?.name) {
        return req.flatId.flatCode
            ? `${req.flatId.name} (${req.flatId.flatCode})`
            : req.flatId.name;
    }
    return req.flatCode || "—";
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
