/**
 * SpendShare — Admin Expense History
 */

const PAGE_SIZE = 10;
const API_BASE = API_BASE_URL;

let allExpenses = [];
let filteredExpenses = [];
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
    setDefaultMonth();
    loadExpenses();
});

function initDropdownLogout() {
    document.getElementById("dropdownLogout")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

function setDefaultMonth() {
    const el = document.getElementById("monthFilter");
    if (el) el.value = SpendShare.getCurrentMonth();
}

async function loadExpenses() {
    try {
        const data = await SpendShare.adminApiFetch("/expense");

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load expenses", "error");
            return;
        }

        allExpenses = data.expenses || [];
        applyFilters();

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load expenses", "error");
    }
}

function applyFilters() {
    const search = document.getElementById("expenseSearch")?.value.trim().toLowerCase() || "";
    const category = document.getElementById("categoryFilter")?.value || "";
    const payment = document.getElementById("paymentFilter")?.value || "";
    const month = document.getElementById("monthFilter")?.value || "";
    const date = document.getElementById("dateFilter")?.value || "";

    filteredExpenses = [...allExpenses];

    if (search) {
        filteredExpenses = filteredExpenses.filter(e =>
            e.title.toLowerCase().includes(search) ||
            e.category.toLowerCase().includes(search) ||
            (e.paidBy?.name || "").toLowerCase().includes(search) ||
            (e.paymentMethod || "").toLowerCase().includes(search)
        );
    }

    if (category) {
        filteredExpenses = filteredExpenses.filter(e => e.category === category);
    }

    if (payment) {
        filteredExpenses = filteredExpenses.filter(e => e.paymentMethod === payment);
    }

    if (month) {
        const [year, mon] = month.split("-").map(Number);
        const start = new Date(year, mon - 1, 1);
        const end = new Date(year, mon, 1);
        filteredExpenses = filteredExpenses.filter(e => {
            const d = new Date(e.expenseDate);
            return d >= start && d < end;
        });
    }

    if (date) {
        filteredExpenses = filteredExpenses.filter(e => {
            const d = new Date(e.expenseDate).toISOString().split("T")[0];
            return d === date;
        });
    }

    currentPage = 1;
    sortExpenses();
    updateStats();
    renderTable();
    renderPagination();
}

function initFilters() {
    ["expenseSearch", "categoryFilter", "paymentFilter", "monthFilter", "dateFilter"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(id === "expenseSearch" ? "input" : "change", applyFilters);
    });

    document.getElementById("clearFilters")?.addEventListener("click", () => {
        document.getElementById("expenseSearch").value = "";
        document.getElementById("categoryFilter").value = "";
        document.getElementById("paymentFilter").value = "";
        document.getElementById("dateFilter").value = "";
        setDefaultMonth();
        applyFilters();
        SpendShare.showToast("Filters cleared", "info", 2000);
    });
}

function sortExpenses() {
    filteredExpenses.sort((a, b) => {
        let valA, valB;
        switch (sortField) {
            case "date":
                valA = new Date(a.expenseDate);
                valB = new Date(b.expenseDate);
                break;
            case "amount":
                valA = a.amount;
                valB = b.amount;
                break;
            case "title":
                valA = a.title.toLowerCase();
                valB = b.title.toLowerCase();
                break;
            case "paidBy":
                valA = (a.paidBy?.name || "").toLowerCase();
                valB = (b.paidBy?.name || "").toLowerCase();
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

            sortExpenses();
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
    const total = filteredExpenses.length;
    const amount = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    document.getElementById("totalRecords").textContent = allExpenses.length;
    document.getElementById("totalAmount").textContent = SpendShare.formatCurrency(amount);
    document.getElementById("showingRange").textContent = total === 0 ? "0" : `${start}–${end} of ${total}`;
}

function renderTable() {
    const tbody = document.getElementById("expenseTableBody");
    const wrap = document.getElementById("tableWrapper");
    const mobileList = document.getElementById("expenseMobileList");
    const empty = document.getElementById("tableEmpty");

    if (!filteredExpenses.length) {
        tbody.innerHTML = "";
        if (mobileList) mobileList.innerHTML = "";
        if (wrap) wrap.classList.add("hidden");
        if (mobileList) mobileList.classList.add("hidden");
        if (empty) empty.style.display = "flex";
        return;
    }

    if (wrap) wrap.classList.remove("hidden");
    if (mobileList) mobileList.classList.remove("hidden");
    if (empty) empty.style.display = "none";

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = filteredExpenses.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageData.map(expense => `
        <tr class="fade-in">
            <td>${SpendShare.formatDate(expense.expenseDate)}</td>
            <td><strong>${escapeHtml(expense.title)}</strong></td>
            <td><span class="badge badge-primary">${escapeHtml(expense.category)}</span></td>
            <td>${escapeHtml(expense.paidBy?.name || "—")}</td>
            <td class="amount-cell">${SpendShare.formatCurrency(expense.amount)}</td>
            <td><span class="payment-badge">${escapeHtml(expense.paymentMethod || "—")}</span></td>
            <td>
                <button class="view-btn" data-id="${expense._id}">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join("");

    if (mobileList) {
        mobileList.innerHTML = pageData.map(expense => `
            <div class="expense-mobile-card fade-in">
                <div class="card-header">
                    <strong>${escapeHtml(expense.title)}</strong>
                    <span class="card-amount">${SpendShare.formatCurrency(expense.amount)}</span>
                </div>
                <div class="card-body">
                    <div class="info-row">
                        <span class="info-label">Category</span>
                        <span class="badge badge-primary">${escapeHtml(expense.category)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Paid By</span>
                        <span class="info-value">${escapeHtml(expense.paidBy?.name || "—")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Payment</span>
                        <span class="payment-badge">${escapeHtml(expense.paymentMethod || "—")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Date</span>
                        <span class="info-value">${SpendShare.formatDate(expense.expenseDate)}</span>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="view-btn btn-action-mobile" data-id="${expense._id}">
                        <i class="fa-solid fa-eye"></i> View Details
                    </button>
                </div>
            </div>
        `).join("");
    }

    const handleView = (e) => {
        const btn = e.target.closest(".view-btn");
        if (btn) openModal(btn.dataset.id);
    };

    tbody.removeEventListener("click", handleView);
    tbody.addEventListener("click", handleView);

    if (mobileList) {
        mobileList.removeEventListener("click", handleView);
        mobileList.addEventListener("click", handleView);
    }
}

function renderPagination() {
    const container = document.getElementById("pagination");
    const totalPages = Math.ceil(filteredExpenses.length / PAGE_SIZE);

    if (totalPages <= 1) {
        container.innerHTML = filteredExpenses.length > 0
            ? `<span class="page-info">${filteredExpenses.length} record${filteredExpenses.length !== 1 ? "s" : ""}</span>`
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
        if (currentPage > 1) { currentPage--; renderTable(); renderPagination(); updateStats(); }
    });
    document.getElementById("nextPage")?.addEventListener("click", () => {
        if (currentPage < totalPages) { currentPage++; renderTable(); renderPagination(); updateStats(); }
    });
    container.querySelectorAll(".page-num").forEach(btn => {
        btn.addEventListener("click", () => {
            currentPage = Number(btn.dataset.page);
            renderTable();
            renderPagination();
            updateStats();
        });
    });
}

function initModal() {
    document.getElementById("modalClose")?.addEventListener("click", closeModal);
    document.getElementById("expenseModal")?.addEventListener("click", (e) => {
        if (e.target.id === "expenseModal") closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });
}

function openModal(id) {
    const expense = allExpenses.find(e => e._id === id);
    if (!expense) return;

    document.getElementById("detailExpense").textContent = expense.title;
    document.getElementById("detailAmount").textContent = SpendShare.formatCurrency(expense.amount);
    document.getElementById("detailCategory").innerHTML = `<span class="badge badge-primary">${escapeHtml(expense.category)}</span>`;
    document.getElementById("detailPaidBy").textContent = expense.paidBy?.name || "—";
    document.getElementById("detailDate").textContent = SpendShare.formatDate(expense.expenseDate);
    document.getElementById("detailPayment").textContent = expense.paymentMethod || "—";
    document.getElementById("detailNotes").textContent = expense.notes || "No notes added.";

    const receiptPreview = document.getElementById("receiptPreview");
    const receiptImage = document.getElementById("receiptImage");
    const receiptPdfLink = document.getElementById("receiptPdfLink");

    if (expense.receipt) {
        receiptPreview.style.display = "block";
        const url = `${API_BASE}/uploads/${expense.receipt}`;
        if (expense.receipt.toLowerCase().endsWith(".pdf")) {
            receiptImage.style.display = "none";
            receiptPdfLink.style.display = "inline-flex";
            receiptPdfLink.href = url;
        } else {
            receiptImage.style.display = "block";
            receiptImage.src = url;
            receiptPdfLink.style.display = "none";
        }
    } else {
        receiptPreview.style.display = "none";
    }

    document.getElementById("expenseModal").classList.add("open");
}

function closeModal() {
    document.getElementById("expenseModal").classList.remove("open");
}

function initExport() {
    document.getElementById("excelBtn")?.addEventListener("click", exportExcel);
    document.getElementById("pdfBtn")?.addEventListener("click", exportPDF);
}

function exportExcel() {
    if (!filteredExpenses.length) {
        SpendShare.showToast("No data to export", "warning");
        return;
    }

    const headers = ["Date", "Expense", "Category", "Paid By", "Amount", "Payment", "Notes"];
    const rows = filteredExpenses.map(e => [
        SpendShare.formatDate(e.expenseDate),
        e.title,
        e.category,
        e.paidBy?.name || "",
        e.amount,
        e.paymentMethod || "",
        e.notes || ""
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SpendShare-Admin-Expenses-${SpendShare.getCurrentMonth()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    SpendShare.showToast("Excel file downloaded", "success");
}

function exportPDF() {
    if (!filteredExpenses.length) {
        SpendShare.showToast("No data to export", "warning");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("SpendShare — Admin Expense Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")} · ${filteredExpenses.length} records`, 14, 28);

    const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    doc.text(`Total: ${SpendShare.formatCurrency(total)}`, 14, 34);

    doc.autoTable({
        startY: 42,
        head: [["Date", "Expense", "Category", "Paid By", "Amount", "Payment"]],
        body: filteredExpenses.map(e => [
            SpendShare.formatDate(e.expenseDate),
            e.title,
            e.category,
            e.paidBy?.name || "",
            SpendShare.formatCurrency(e.amount),
            e.paymentMethod || ""
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [124, 58, 237] }
    });

    doc.save(`SpendShare-Admin-Expenses-${SpendShare.getCurrentMonth()}.pdf`);
    SpendShare.showToast("PDF downloaded", "success");
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
