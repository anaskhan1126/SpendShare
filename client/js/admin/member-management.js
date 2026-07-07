/**
 * SpendShare — Admin Member Management
 */

let allMembers = [];
let filteredMembers = [];
let confirmCallback = null;
let deleteTargetId = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!SpendShare.requireAdminAuth()) return;

    SpendShare.initAdminAuthUI();
    SpendShare.initAdminLogout();
    initDropdownLogout();
    initConfirmDialog();
    initEditModal();
    initFilters();
    initTableActions();
    loadMembers();
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
        const data = await SpendShare.adminApiFetch("/admin/members");

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

function getGroupName(member) {
    if (!member.group) return "Flat Members";
    if (typeof member.group === "string") return member.group;
    return member.group.groupName || "Flat Members";
}

/* ===========================
   FILTER & SORT
=========================== */

function initFilters() {
    document.getElementById("searchMember")?.addEventListener("input", applyFilters);
    document.getElementById("sortFilter")?.addEventListener("change", applyFilters);
}

function applyFilters() {
    const search = document.getElementById("searchMember")?.value.trim().toLowerCase() || "";
    const sortBy = document.getElementById("sortFilter")?.value || "name";

    filteredMembers = [...allMembers];

    if (search) {
        filteredMembers = filteredMembers.filter(m =>
            m.name.toLowerCase().includes(search) ||
            m.email.toLowerCase().includes(search) ||
            (m.phone || "").toLowerCase().includes(search)
        );
    }

    filteredMembers.sort((a, b) => {
        switch (sortBy) {
            case "email": return a.email.localeCompare(b.email);
            case "role": return (a.role || "").localeCompare(b.role || "");
            default: return a.name.localeCompare(b.name);
        }
    });

    updateStats();
    renderTable();
}

function updateStats() {
    document.getElementById("totalMembers").textContent = allMembers.length;
    document.getElementById("activeMembers").textContent = allMembers.length;
    document.getElementById("showingCount").textContent = filteredMembers.length;
}

/* ===========================
   RENDER TABLE
=========================== */

function renderTable() {
    const tbody = document.getElementById("memberTableBody");
    const wrap = document.getElementById("tableWrapper");
    const empty = document.getElementById("tableEmpty");

    if (!filteredMembers.length) {
        tbody.innerHTML = "";
        wrap.style.display = "none";
        empty.style.display = "flex";
        return;
    }

    wrap.style.display = "block";
    empty.style.display = "none";

    tbody.innerHTML = filteredMembers.map(member => `
        <tr class="fade-in">
            <td>
                <div class="member-cell">
                    <div class="member-avatar">${getInitials(member.name)}</div>
                    <strong>${escapeHtml(member.name)}</strong>
                </div>
            </td>
            <td>${escapeHtml(member.email)}</td>
            <td>${escapeHtml(member.phone || "—")}</td>
            <td><span class="role-badge">${escapeHtml(member.role || "member")}</span></td>
            <td>${escapeHtml(getGroupName(member))}</td>
            <td>
                <div class="action-btns">
                    <button class="edit-btn" data-id="${member._id}" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="delete-btn" data-id="${member._id}" data-name="${escapeHtml(member.name)}" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
}

function initTableActions() {
    document.getElementById("memberTableBody")?.addEventListener("click", (e) => {
        const editBtn = e.target.closest(".edit-btn");
        const deleteBtn = e.target.closest(".delete-btn");

        if (editBtn) openEditModal(editBtn.dataset.id);
        if (deleteBtn) confirmDelete(deleteBtn.dataset.id, deleteBtn.dataset.name);
    });
}

/* ===========================
   EDIT MODAL
=========================== */

function initEditModal() {
    document.getElementById("modalClose")?.addEventListener("click", closeEditModal);
    document.getElementById("cancelEdit")?.addEventListener("click", closeEditModal);
    document.getElementById("editModal")?.addEventListener("click", (e) => {
        if (e.target.id === "editModal") closeEditModal();
    });
    document.getElementById("editForm")?.addEventListener("submit", saveEdit);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeEditModal();
    });
}

function openEditModal(id) {
    const member = allMembers.find(m => m._id === id);
    if (!member) return;

    document.getElementById("editMemberId").value = id;
    document.getElementById("editName").value = member.name;
    document.getElementById("editEmail").value = member.email;
    document.getElementById("editPhone").value = member.phone || "";

    document.querySelectorAll("#editForm .float-group").forEach(g => g.classList.remove("has-error"));
    document.getElementById("editModal").classList.add("open");
}

function closeEditModal() {
    document.getElementById("editModal").classList.remove("open");
}

async function saveEdit(e) {
    e.preventDefault();

    const id = document.getElementById("editMemberId").value;
    const name = document.getElementById("editName").value.trim();
    const email = document.getElementById("editEmail").value.trim();
    const phone = document.getElementById("editPhone").value.trim();

    if (!name || !email || !phone) {
        SpendShare.showToast("Please fill all fields", "error");
        return;
    }

    try {
        const response = await fetch(`${SpendShare.API_BASE}/admin/member/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SpendShare.getAdminAuth().token}`
            },
            body: JSON.stringify({ name, email, phone })
        });

        const data = await response.json();

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to update", "error");
            return;
        }

        SpendShare.showToast(data.message || "Member updated!", "success");
        closeEditModal();
        loadMembers();

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to update member", "error");
    }
}

/* ===========================
   DELETE
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

function confirmDelete(id, name) {
    deleteTargetId = id;
    document.getElementById("confirmTitle").textContent = "Delete Member";
    document.getElementById("confirmMessage").textContent =
        `Are you sure you want to delete ${name}? This action cannot be undone.`;
    confirmCallback = deleteMember;
    document.getElementById("confirmDialog").classList.add("open");
}

function closeConfirm() {
    document.getElementById("confirmDialog").classList.remove("open");
    confirmCallback = null;
    deleteTargetId = null;
}

async function deleteMember() {
    if (!deleteTargetId) return;

    try {
        const response = await fetch(
            `${SpendShare.API_BASE}/admin/member/${deleteTargetId}`,
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${SpendShare.getAdminAuth().token}` }
            }
        );

        const data = await response.json();

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to delete", "error");
            return;
        }

        SpendShare.showToast(data.message || "Member deleted", "success");
        loadMembers();

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to delete member", "error");
    }
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
