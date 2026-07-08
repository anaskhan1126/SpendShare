/**
 * SpendShare — Settlement
 */

let allTransactions = [];
let confirmCallback = null;
let activeUrlFilter = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!SpendShare.requireAuth()) return;

    SpendShare.initAuthUI();
    initDropdownLogout();
    initConfirmDialog();
    initFilters();
    initActions();
    initPayDelegation();
    initAdminSection();

    const urlParams = new URLSearchParams(window.location.search);
    activeUrlFilter = urlParams.get("filter");

    loadSettlement();
});

function initDropdownLogout() {
    document.getElementById("dropdownLogout")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

function initActions() {
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
        loadSettlement();
        SpendShare.showToast("Refreshing settlements...", "info", 1500);
    });

    document.getElementById("printBtn")?.addEventListener("click", () => window.print());
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
   LOAD SETTLEMENT
=========================== */

async function loadSettlement() {
    try {
        const data = await SpendShare.apiFetch("/settlement/member");

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load settlement", "error");
            return;
        }

        revealStatCards();
        updateSummary(data.summary);
        
        // Frontend Validation: Filter out amount <= 0, self-payments, and duplicate pending transactions
        const rawTransactions = data.transactions || [];
        const seenPending = new Set();
        allTransactions = rawTransactions.filter(t => {
            if (!t.from || !t.to || !t.amount || t.amount <= 0) return false;
            const fromId = t.from._id?.toString() || t.from;
            const toId = t.to._id?.toString() || t.to;
            if (fromId === toId) return false;

            if (t.status === "Pending") {
                const pairKey = `${fromId}_${toId}`;
                if (seenPending.has(pairKey)) return false;
                seenPending.add(pairKey);
            }
            return true;
        });

        const { memberId } = SpendShare.getAuth();
        let displayTransactions = [...allTransactions];
        if (activeUrlFilter === "you-owe") {
            displayTransactions = displayTransactions.filter(t => {
                const fromId = t.from._id?.toString() || t.from;
                return fromId === memberId;
            });
            const searchInput = document.getElementById("settlementSearch");
            if (searchInput) {
                searchInput.placeholder = "Filtering: Settlements You Owe";
            }
        } else if (activeUrlFilter === "owed-to-you") {
            displayTransactions = displayTransactions.filter(t => {
                const toId = t.to._id?.toString() || t.to;
                return toId === memberId;
            });
            const searchInput = document.getElementById("settlementSearch");
            if (searchInput) {
                searchInput.placeholder = "Filtering: Owed to You";
            }
        } else if (activeUrlFilter === "net-balance") {
            const searchInput = document.getElementById("settlementSearch");
            if (searchInput) {
                searchInput.placeholder = "Showing: Net Balance Overview";
            }
        }

        renderSmartSettlement(displayTransactions);
        renderTable(displayTransactions);
        renderCards(displayTransactions);
        
        const rawHistory = data.history || [];
        const filteredHistory = rawHistory.filter(item => {
            if (!item.from || !item.to || !item.amount || item.amount <= 0) return false;
            const fromId = item.from._id?.toString() || item.from;
            const toId = item.to._id?.toString() || item.to;
            return fromId !== toId;
        });
        renderHistory(filteredHistory);

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load settlement", "error");
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

function updateSummary(summary) {
    SpendShare.animateCounter(document.getElementById("totalOwe"), summary.totalOwe);
    SpendShare.animateCounter(document.getElementById("totalReceive"), summary.totalReceive);

    const netEl = document.getElementById("netBalance");
    const net = summary.netBalance;
    const sign = net >= 0 ? "+" : "-";
    SpendShare.animateCounter(netEl, Math.abs(net));
    setTimeout(() => {
        netEl.textContent = `${sign}₹${Math.abs(net).toFixed(2)}`;
        netEl.style.color = net >= 0 ? "var(--success)" : "var(--danger)";
    }, 1300);
}

/* ===========================
   SMART SETTLEMENT
=========================== */

function renderSmartSettlement(transactions) {
    const list = document.getElementById("smartSettlementList");
    const empty = document.getElementById("smartEmpty");
    const { memberId, role } = SpendShare.getAuth();

    // Frontend Validation: Only pending, valid amounts, unique
    const pending = transactions.filter(t => t.status === "Pending" && t.amount > 0);

    document.getElementById("pendingCount").textContent =
        `${pending.length} pending`;

    if (!pending.length) {
        list.innerHTML = "";
        list.style.display = "none";
        empty.style.display = "flex";
        return;
    }

    empty.style.display = "none";
    list.style.display = "flex";

    list.innerHTML = pending.map(t => {
        const actionBtn = SpendShare.getSettlementActionHtml(SpendShare.getAuth(), t);

        return `
            <div class="smart-item fade-in">
                <div class="smart-flow">
                    <div class="smart-avatar">${getInitials(t.from.name)}</div>
                    <div class="smart-names">
                        <span class="from" title="${escapeHtml(t.from.name)}">${escapeHtml(t.from.name)}</span>
                        <i class="fa-solid fa-arrow-right arrow"></i>
                        <span class="to" title="${escapeHtml(t.to.name)}">${escapeHtml(t.to.name)}</span>
                    </div>
                </div>
                <span class="smart-amount">${SpendShare.formatCurrency(t.amount)}</span>
                ${actionBtn}
            </div>
        `;
    }).join("");
}

/* ===========================
   TABLE
=========================== */

function renderTable(transactions) {
    const tbody = document.getElementById("settlementTableBody");
    const wrapper = document.getElementById("tableWrapper");
    const empty = document.getElementById("tableEmpty");
    const { memberId } = SpendShare.getAuth();

    // Frontend Validation: Filter out invalid/zero rows
    const validTransactions = transactions.filter(t => t.amount > 0 && t.from && t.to);

    if (!validTransactions.length) {
        tbody.innerHTML = "";
        if (wrapper) wrapper.classList.add("hidden");
        if (empty) empty.classList.remove("hidden");
        return;
    }

    if (wrapper) wrapper.classList.remove("hidden");
    if (empty) empty.classList.add("hidden");

    tbody.innerHTML = validTransactions.map(t => {
        const action = getActionHtml(t, memberId);
        const statusClass = t.status === "Paid" ? "status-paid" : "status-pending";

        return `
            <tr data-status="${t.status}" class="settlement-row fade-in">
                <td>
                    <div class="member-profile-cell">
                        <div class="member-avatar">${getInitials(t.from.name)}</div>
                        <span class="member-name" title="${escapeHtml(t.from.name)}">${escapeHtml(t.from.name)}</span>
                    </div>
                </td>
                <td class="flow-arrow"><i class="fa-solid fa-arrow-right"></i></td>
                <td>
                    <div class="member-profile-cell">
                        <div class="member-avatar">${getInitials(t.to.name)}</div>
                        <span class="member-name" title="${escapeHtml(t.to.name)}">${escapeHtml(t.to.name)}</span>
                    </div>
                </td>
                <td class="amount-cell">${SpendShare.formatCurrency(t.amount)}</td>
                <td><span class="${statusClass}">${t.status}</span></td>
                <td>${action}</td>
            </tr>
        `;
    }).join("");

    applyFilters();
}

function getActionHtml(transaction, memberId) {
    const currentUser = SpendShare.getAuth();
    return SpendShare.getSettlementActionHtml(currentUser, transaction);
}

/* ===========================
   CARDS GRID
=========================== */

function renderCards(transactions) {
    const container = document.getElementById("settlementCards");
    const empty = document.getElementById("cardsEmpty");
    const { memberId } = SpendShare.getAuth();

    const validCards = transactions.filter(t => t.amount > 0 && t.from && t.to);

    if (!validCards.length) {
        container.innerHTML = "";
        if (empty) empty.classList.remove("hidden");
        return;
    }

    if (empty) empty.classList.add("hidden");

    container.innerHTML = validCards.map(t => {
        const action = getActionHtml(t, memberId);
        return `
            <div class="settlement-card ${t.status.toLowerCase()} fade-in">
                <h4>
                    ${escapeHtml(t.from.name)}
                    <i class="fa-solid fa-arrow-right arrow-icon"></i>
                    ${escapeHtml(t.to.name)}
                </h4>
                <div class="card-amount">${SpendShare.formatCurrency(t.amount)}</div>
                <div class="card-action-container">
                    ${action}
                </div>
            </div>
        `;
    }).join("");

    applyFilters();
}

/* ===========================
   HISTORY
=========================== */

function renderHistory(history) {
    const tbody = document.getElementById("historyTableBody");
    const empty = document.getElementById("historyEmpty");

    const validHistory = history.filter(item => item.amount > 0 && item.from && item.to);

    if (!validHistory.length) {
        tbody.innerHTML = "";
        empty.style.display = "flex";
        return;
    }

    empty.style.display = "none";

    tbody.innerHTML = validHistory.map(item => `
        <tr class="fade-in">
            <td>${item.paidAt ? SpendShare.formatDate(item.paidAt) : "—"}</td>
            <td>
                <div class="member-profile-cell">
                    <div class="member-avatar">${getInitials(item.from.name)}</div>
                    <span class="member-name" title="${escapeHtml(item.from.name)}">${escapeHtml(item.from.name)}</span>
                </div>
            </td>
            <td>
                <div class="member-profile-cell">
                    <div class="member-avatar">${getInitials(item.to.name)}</div>
                    <span class="member-name" title="${escapeHtml(item.to.name)}">${escapeHtml(item.to.name)}</span>
                </div>
            </td>
            <td class="amount-cell">${SpendShare.formatCurrency(item.amount)}</td>
            <td><span class="status-paid">${item.status}</span></td>
        </tr>
    `).join("");
}

/* ===========================
   PAY BUTTON
=========================== */

function initPayDelegation() {
    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".pay-btn");
        if (btn) markAsPaid(btn.dataset.id);
    });
}

async function markAsPaid(id) {
    const transaction = allTransactions.find(t => t._id === id) || (typeof adminAllSettlements !== "undefined" ? adminAllSettlements.find(t => t._id === id) : null);
    const isReceiver = SpendShare.canConfirmSettlement(SpendShare.getAuth(), transaction);
    
    const confirmTitle = isReceiver ? "Confirm Payment Received" : "Mark Settlement as Paid";
    const confirmMessage = isReceiver 
        ? "Are you sure you have received this payment? This action cannot be undone."
        : "Are you sure you want to mark this settlement as Paid? This action cannot be undone.";

    showConfirm(
        confirmTitle,
        confirmMessage,
        async () => {
            try {
                const { token } = SpendShare.getAuth();
                const response = await fetch(
                    `${API_BASE_URL}/api/settlement/${id}/pay`,
                    {
                        method: "PUT",
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );

                const contentType = response.headers.get("content-type");
                const result = (contentType && contentType.includes("application/json"))
                    ? await response.json()
                    : { success: false, message: `Server error: ${response.status} ${response.statusText}` };

                if (!response.ok || !result.success) {
                    SpendShare.showToast(result.message || "Failed to confirm", "error");
                    return;
                }

                SpendShare.showToast(result.message || "Payment confirmed!", "success");
                loadSettlement();
                if (typeof loadAdminSettlements === "function") {
                    loadAdminSettlements();
                }

            } catch (error) {
                console.error(error);
                SpendShare.showToast("Unable to confirm payment", "error");
            }
        }
    );
}

/* ===========================
   FILTERS
=========================== */

function initFilters() {
    document.getElementById("settlementSearch")?.addEventListener("input", applyFilters);
    document.getElementById("statusFilter")?.addEventListener("change", applyFilters);
}

function applyFilters() {
    const search = document.getElementById("settlementSearch")?.value.trim().toLowerCase() || "";
    const status = document.getElementById("statusFilter")?.value || "all";

    let visibleTableRows = 0;
    document.querySelectorAll(".settlement-row").forEach(row => {
        const text = row.textContent.toLowerCase();
        const rowStatus = row.dataset.status;
        const matchSearch = !search || text.includes(search);
        const matchStatus = status === "all" || rowStatus === status;
        const visible = matchSearch && matchStatus;
        row.style.display = visible ? "" : "none";
        if (visible) visibleTableRows++;
    });

    const tableWrapper = document.getElementById("tableWrapper");
    const tableEmpty = document.getElementById("tableEmpty");
    if (tableWrapper && tableEmpty) {
        if (allTransactions.length === 0 || visibleTableRows === 0) {
            tableWrapper.classList.add("hidden");
            tableEmpty.classList.remove("hidden");
        } else {
            tableWrapper.classList.remove("hidden");
            tableEmpty.classList.add("hidden");
        }
    }

    let visibleCards = 0;
    document.querySelectorAll(".settlement-card").forEach(card => {
        const text = card.textContent.toLowerCase();
        const cardStatus = card.classList.contains("paid") ? "Paid" : "Pending";
        const matchSearch = !search || text.includes(search);
        const matchStatus = status === "all" || cardStatus === status;
        const visible = matchSearch && matchStatus;
        card.style.display = visible ? "" : "none";
        if (visible) visibleCards++;
    });

    const cardsContainer = document.getElementById("settlementCards");
    const cardsEmpty = document.getElementById("cardsEmpty");
    if (cardsContainer && cardsEmpty) {
        if (allTransactions.length === 0 || visibleCards === 0) {
            cardsContainer.classList.add("hidden");
            cardsEmpty.classList.remove("hidden");
        } else {
            cardsContainer.classList.remove("hidden");
            cardsEmpty.classList.add("hidden");
        }
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

/* ===========================
   ADMIN FLAT SETTLEMENTS SECTION (SECTION 2)
   =========================== */

let adminAllSettlements = [];
let adminFilteredSettlements = [];

function initAdminSection() {
    const { role } = SpendShare.getAuth();
    if (role !== "admin") return;

    const panel = document.getElementById("adminAllFlatSettlementsPanel");
    if (panel) panel.style.display = "block";

    // Setup filters
    document.getElementById("adminSettlementSearch")?.addEventListener("input", applyAdminFilters);
    document.getElementById("adminStatusFilter")?.addEventListener("change", applyAdminFilters);
    document.getElementById("adminDateFilter")?.addEventListener("change", applyAdminFilters);

    // Refresh btn
    document.getElementById("adminRefreshBtn")?.addEventListener("click", () => {
        loadAdminSettlements(true);
    });

    // Export btns
    document.getElementById("adminExportExcelBtn")?.addEventListener("click", exportAdminExcel);
    document.getElementById("adminExportPdfBtn")?.addEventListener("click", exportAdminPdf);

    loadAdminSettlements();
}

async function loadAdminSettlements(showToast = false) {
    try {
        const data = await SpendShare.apiFetch("/settlement/all");
        if (data.success) {
            const rawAdmin = data.settlements || [];
            const seenPending = new Set();
            adminAllSettlements = rawAdmin.filter(s => {
                if (!s.from || !s.to || !s.amount || s.amount <= 0) return false;
                const fromId = s.from._id?.toString() || s.from;
                const toId = s.to._id?.toString() || s.to;
                if (fromId === toId) return false;

                if (s.status === "Pending") {
                    const pairKey = `${fromId}_${toId}`;
                    if (seenPending.has(pairKey)) return false;
                    seenPending.add(pairKey);
                }
                return true;
            });

            applyAdminFilters();
            if (showToast) {
                SpendShare.showToast("All flat settlements refreshed", "success");
            }
        }
    } catch (err) {
        console.error("Failed to load all settlements:", err);
    }
}

function applyAdminFilters() {
    const search = document.getElementById("adminSettlementSearch")?.value.trim().toLowerCase() || "";
    const status = document.getElementById("adminStatusFilter")?.value || "all";
    const date = document.getElementById("adminDateFilter")?.value || "";

    adminFilteredSettlements = adminAllSettlements.filter(s => {
        const fromName = (s.from?.name || "").toLowerCase();
        const toName = (s.to?.name || "").toLowerCase();
        
        const matchSearch = !search || fromName.includes(search) || toName.includes(search);
        const matchStatus = status === "all" || s.status === status;
        
        let matchDate = true;
        if (date) {
            const sDate = new Date(s.paidAt || s.createdAt).toISOString().split("T")[0];
            matchDate = sDate === date;
        }

        return matchSearch && matchStatus && matchDate;
    });

    renderAdminTable();
}

function renderAdminTable() {
    const tbody = document.getElementById("adminSettlementTableBody");
    const wrapper = document.getElementById("adminTableWrapper");
    const empty = document.getElementById("adminTableEmpty");

    if (!tbody) return;

    if (!adminFilteredSettlements.length) {
        tbody.innerHTML = "";
        if (wrapper) wrapper.style.display = "none";
        if (empty) empty.style.display = "flex";
        return;
    }

    if (wrapper) wrapper.style.display = "block";
    if (empty) empty.style.display = "none";

    tbody.innerHTML = adminFilteredSettlements.map(s => {
        const statusClass = s.status === "Paid" ? "status-paid" : "status-pending";
        const dateStr = new Date(s.paidAt || s.createdAt).toLocaleDateString("en-IN");
        const fromName = s.from?.name || "—";
        const toName = s.to?.name || "—";
        
        const actionHtml = SpendShare.getSettlementActionHtml(SpendShare.getAuth(), s);

        return `
            <tr class="fade-in">
                <td>${dateStr}</td>
                <td>
                    <div class="member-profile-cell">
                        <div class="member-avatar">${getInitials(fromName)}</div>
                        <span class="member-name" title="${escapeHtml(fromName)}">${escapeHtml(fromName)}</span>
                    </div>
                </td>
                <td class="flow-arrow"><i class="fa-solid fa-arrow-right"></i></td>
                <td>
                    <div class="member-profile-cell">
                        <div class="member-avatar">${getInitials(toName)}</div>
                        <span class="member-name" title="${escapeHtml(toName)}">${escapeHtml(toName)}</span>
                    </div>
                </td>
                <td class="amount-cell">${SpendShare.formatCurrency(s.amount)}</td>
                <td><span class="${statusClass}">${s.status}</span></td>
                <td>${actionHtml}</td>
            </tr>
        `;
    }).join("");
}

function exportAdminExcel() {
    if (!adminFilteredSettlements.length) {
        SpendShare.showToast("No data to export", "warning");
        return;
    }

    const headers = ["Date", "From", "To", "Amount", "Status", "Paid On"];
    const rows = adminFilteredSettlements.map(item => [
        new Date(item.paidAt || item.createdAt).toLocaleDateString("en-IN"),
        item.from?.name || "",
        item.to?.name || "",
        item.amount,
        item.status,
        item.paidAt ? new Date(item.paidAt).toLocaleDateString("en-IN") : ""
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SpendShare-All-Settlements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    SpendShare.showToast("Excel file downloaded", "success");
}

function exportAdminPdf() {
    if (!adminFilteredSettlements.length) {
        SpendShare.showToast("No data to export", "warning");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("SpendShare — Flat Settlements Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")} · ${adminFilteredSettlements.length} records`, 14, 28);

    doc.autoTable({
        startY: 35,
        head: [["Date", "From", "To", "Amount", "Status"]],
        body: adminFilteredSettlements.map(item => [
            new Date(item.paidAt || item.createdAt).toLocaleDateString("en-IN"),
            item.from?.name || "",
            item.to?.name || "",
            SpendShare.formatCurrency(item.amount),
            item.status
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [124, 58, 237] }
    });

    doc.save(`SpendShare-All-Settlements-${new Date().toISOString().slice(0, 10)}.pdf`);
    SpendShare.showToast("PDF downloaded", "success");
}
