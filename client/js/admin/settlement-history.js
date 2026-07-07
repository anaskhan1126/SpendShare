/**
 * SpendShare — Admin Settlement History
 */

const PAGE_SIZE = 10;

let allSettlements = [];
let filteredSettlements = [];
let currentPage = 1;
let sortField = "date";
let sortDir = "desc";

document.addEventListener("DOMContentLoaded", () => {
    if (!SpendShare.requireAdminAuth()) return;

    SpendShare.initAdminAuthUI();
    SpendShare.initAdminLogout();
    initDropdownLogout();
    initFilters();
    initSort();
    initModal();
    initExport();
    initRefresh();
    setDefaultMonth();
    loadSettlements();
});

function initDropdownLogout() {
    document.getElementById("dropdownLogout")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

function setDefaultMonth() {
    const el = document.getElementById("monthFilter");
    if (el) el.value = "";
}

function initRefresh() {
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
        const btn = document.getElementById("refreshBtn");
        btn?.classList.add("loading");
        loadSettlements(true).finally(() => btn?.classList.remove("loading"));
    });
}

async function loadSettlements(showSuccessToast = false) {
    try {
        const data = await SpendShare.adminApiFetch("/settlement/all");

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load settlements", "error");
            return;
        }

        allSettlements = data.settlements || [];
        applyFilters();
        if (showSuccessToast) {
            SpendShare.showToast("Settlements updated", "success", 2000);
        }

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load settlements", "error");
    }
}

function getSettlementDate(item) {
    return item.paidAt || item.createdAt;
}

function applyFilters() {
    const search = document.getElementById("memberSearch")?.value.trim().toLowerCase() || "";
    const status = document.getElementById("statusFilter")?.value || "";
    const month = document.getElementById("monthFilter")?.value || "";
    const date = document.getElementById("dateFilter")?.value || "";

    filteredSettlements = [...allSettlements];

    if (search) {
        filteredSettlements = filteredSettlements.filter(item =>
            (item.from?.name || "").toLowerCase().includes(search) ||
            (item.to?.name || "").toLowerCase().includes(search)
        );
    }

    if (status) {
        filteredSettlements = filteredSettlements.filter(item => item.status === status);
    }

    if (month) {
        const [year, mon] = month.split("-").map(Number);
        const start = new Date(year, mon - 1, 1);
        const end = new Date(year, mon, 1);
        filteredSettlements = filteredSettlements.filter(item => {
            const d = new Date(getSettlementDate(item));
            return d >= start && d < end;
        });
    }

    if (date) {
        filteredSettlements = filteredSettlements.filter(item => {
            const d = new Date(getSettlementDate(item)).toISOString().split("T")[0];
            return d === date;
        });
    }

    currentPage = 1;
    sortSettlements();
    updateStats();
    renderTable();
    renderPagination();
}

function initFilters() {
    ["memberSearch", "statusFilter", "monthFilter", "dateFilter"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(id === "memberSearch" ? "input" : "change", applyFilters);
    });

    document.getElementById("clearFilters")?.addEventListener("click", () => {
        document.getElementById("memberSearch").value = "";
        document.getElementById("statusFilter").value = "";
        document.getElementById("monthFilter").value = "";
        document.getElementById("dateFilter").value = "";
        applyFilters();
        SpendShare.showToast("Filters cleared", "info", 2000);
    });
}

function sortSettlements() {
    filteredSettlements.sort((a, b) => {
        let valA, valB;
        switch (sortField) {
            case "date":
                valA = new Date(getSettlementDate(a));
                valB = new Date(getSettlementDate(b));
                break;
            case "amount":
                valA = a.amount;
                valB = b.amount;
                break;
            case "from":
                valA = (a.from?.name || "").toLowerCase();
                valB = (b.from?.name || "").toLowerCase();
                break;
            case "to":
                valA = (a.to?.name || "").toLowerCase();
                valB = (b.to?.name || "").toLowerCase();
                break;
            default:
                return 0;
        }
        if (valA < valB) return sortDir === "asc" ? -1 : 1;
        if (valA > valB) return sortDir === "asc" ? 1 : -1;
        return 0;
    });
}

function initSort() {
    document.querySelectorAll(".sortable").forEach(th => {
        th.addEventListener("click", () => {
            const field = th.dataset.sort;
            if (sortField === field) {
                sortDir = sortDir === "asc" ? "desc" : "asc";
            } else {
                sortField = field;
                sortDir = "desc";
            }

            document.querySelectorAll(".sortable").forEach(h => {
                h.classList.remove("sorted-asc", "sorted-desc");
                const icon = h.querySelector(".sort-icon");
                if (icon) icon.className = "fa-solid fa-sort sort-icon";
            });

            th.classList.add(sortDir === "asc" ? "sorted-asc" : "sorted-desc");
            const icon = th.querySelector(".sort-icon");
            if (icon) icon.className = `fa-solid fa-sort-${sortDir === "asc" ? "up" : "down"} sort-icon`;

            sortSettlements();
            renderTable();
        });
    });

    const dateTh = document.querySelector('[data-sort="date"]');
    if (dateTh) {
        dateTh.classList.add("sorted-desc");
        const icon = dateTh.querySelector(".sort-icon");
        if (icon) icon.className = "fa-solid fa-sort-down sort-icon";
    }
}

function updateStats() {
    const pending = allSettlements.filter(s => s.status === "Pending");
    const paid = allSettlements.filter(s => s.status === "Paid");
    const pendingTotal = pending.reduce((sum, s) => sum + s.amount, 0);

    document.getElementById("totalRecords").textContent = allSettlements.length;
    document.getElementById("pendingCount").textContent = pending.length;
    document.getElementById("paidCount").textContent = paid.length;
    document.getElementById("pendingAmount").textContent = SpendShare.formatCurrency(pendingTotal);
}

function renderTable() {
    const tbody = document.getElementById("settlementTableBody");
    const wrap = document.getElementById("tableWrapper");
    const empty = document.getElementById("tableEmpty");

    if (!filteredSettlements.length) {
        tbody.innerHTML = "";
        wrap.style.display = "none";
        empty.style.display = "flex";
        return;
    }

    wrap.style.display = "block";
    empty.style.display = "none";

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = filteredSettlements.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageData.map(item => {
        const statusClass = item.status.toLowerCase();
        const statusIcon = item.status === "Paid" ? "fa-circle-check" : "fa-clock";
        return `
        <tr class="fade-in">
            <td>${SpendShare.formatDate(getSettlementDate(item))}</td>
            <td><strong>${escapeHtml(item.from?.name || "—")}</strong></td>
            <td><strong>${escapeHtml(item.to?.name || "—")}</strong></td>
            <td class="amount-cell">${SpendShare.formatCurrency(item.amount)}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    <i class="fa-solid ${statusIcon}"></i> ${item.status}
                </span>
            </td>
            <td>
                <button class="view-btn" data-id="${item._id}">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll(".view-btn").forEach(btn => {
        btn.addEventListener("click", () => openModal(btn.dataset.id));
    });
}

function renderPagination() {
    const container = document.getElementById("pagination");
    const totalPages = Math.ceil(filteredSettlements.length / PAGE_SIZE);

    if (totalPages <= 1) {
        container.innerHTML = filteredSettlements.length > 0
            ? `<span class="page-info">${filteredSettlements.length} record${filteredSettlements.length !== 1 ? "s" : ""}</span>`
            : "";
        return;
    }

    let html = `<button class="page-btn" id="prevPage" ${currentPage === 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-num ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
    }

    html += `<button class="page-btn" id="nextPage" ${currentPage === totalPages ? "disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>`;
    html += `<span class="page-info">Page ${currentPage} of ${totalPages}</span>`;

    container.innerHTML = html;

    document.getElementById("prevPage")?.addEventListener("click", () => {
        if (currentPage > 1) { currentPage--; renderTable(); renderPagination(); }
    });
    document.getElementById("nextPage")?.addEventListener("click", () => {
        if (currentPage < totalPages) { currentPage++; renderTable(); renderPagination(); }
    });
    container.querySelectorAll(".page-num").forEach(btn => {
        btn.addEventListener("click", () => {
            currentPage = Number(btn.dataset.page);
            renderTable();
            renderPagination();
        });
    });
}

function initModal() {
    document.getElementById("modalClose")?.addEventListener("click", closeModal);
    document.getElementById("settlementModal")?.addEventListener("click", (e) => {
        if (e.target.id === "settlementModal") closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });
}

function openModal(id) {
    const item = allSettlements.find(s => s._id === id);
    if (!item) return;

    document.getElementById("detailFrom").textContent = item.from?.name || "—";
    document.getElementById("detailTo").textContent = item.to?.name || "—";
    document.getElementById("detailAmount").textContent = SpendShare.formatCurrency(item.amount);

    const statusEl = document.getElementById("detailStatus");
    statusEl.innerHTML = `<span class="status-badge ${item.status.toLowerCase()}">${item.status}</span>`;

    document.getElementById("detailDate").textContent = SpendShare.formatDate(getSettlementDate(item));
    document.getElementById("detailCreated").textContent = SpendShare.formatDate(item.createdAt);
    document.getElementById("detailPaidAt").textContent = item.paidAt
        ? SpendShare.formatDate(item.paidAt)
        : "—";

    document.getElementById("settlementModal").classList.add("open");
}

function closeModal() {
    document.getElementById("settlementModal").classList.remove("open");
}

function initExport() {
    document.getElementById("excelBtn")?.addEventListener("click", exportExcel);
    document.getElementById("pdfBtn")?.addEventListener("click", exportPDF);
}

function exportExcel() {
    if (!filteredSettlements.length) {
        SpendShare.showToast("No data to export", "warning");
        return;
    }

    const headers = ["Date", "From", "To", "Amount", "Status", "Paid On"];
    const rows = filteredSettlements.map(item => [
        SpendShare.formatDate(getSettlementDate(item)),
        item.from?.name || "",
        item.to?.name || "",
        item.amount,
        item.status,
        item.paidAt ? SpendShare.formatDate(item.paidAt) : ""
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SpendShare-Admin-Settlements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    SpendShare.showToast("Excel file downloaded", "success");
}

function exportPDF() {
    if (!filteredSettlements.length) {
        SpendShare.showToast("No data to export", "warning");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("SpendShare — Settlement Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")} · ${filteredSettlements.length} records`, 14, 28);

    const pending = filteredSettlements.filter(s => s.status === "Pending");
    const pendingTotal = pending.reduce((sum, s) => sum + s.amount, 0);
    doc.text(`Pending: ${pending.length} (${SpendShare.formatCurrency(pendingTotal)})`, 14, 34);

    doc.autoTable({
        startY: 42,
        head: [["Date", "From", "To", "Amount", "Status"]],
        body: filteredSettlements.map(item => [
            SpendShare.formatDate(getSettlementDate(item)),
            item.from?.name || "",
            item.to?.name || "",
            SpendShare.formatCurrency(item.amount),
            item.status
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [124, 58, 237] }
    });

    doc.save(`SpendShare-Admin-Settlements-${new Date().toISOString().slice(0, 10)}.pdf`);
    SpendShare.showToast("PDF downloaded", "success");
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
