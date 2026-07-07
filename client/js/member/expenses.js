/**
 * SpendShare — Expense History
 */

const PAGE_SIZE = 10;
const API_BASE = window.location.origin;

let allExpenses = [];
let filteredExpenses = [];
let currentPage = 1;
let sortField = "date";
let sortDir = "desc";

document.addEventListener("DOMContentLoaded", async () => {
    if (!SpendShare.requireAuth()) return;

    SpendShare.initAuthUI();
    initDropdownLogout();
    setDefaultMonth();
    await loadMembers();
    initFilters();
    initSort();
    initModal();
    initExport();

    // Check query params for interactive navigation
    const urlParams = new URLSearchParams(window.location.search);
    const filter = urlParams.get("filter");
    if (filter === "my-expenses") {
        const { memberId } = SpendShare.getAuth();
        if (memberId) {
            const memberFilter = document.getElementById("memberFilter");
            if (memberFilter) {
                memberFilter.value = memberId;
            }
        }
    }

    loadExpenses();
});

function initDropdownLogout() {
    document.getElementById("dropdownLogout")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

function setDefaultMonth() {
    const monthFilter = document.getElementById("monthFilter");
    if (monthFilter) {
        monthFilter.value = SpendShare.getCurrentMonth();
    }
}

/* ===========================
   LOAD DATA
=========================== */

async function loadMembers() {
    const select = document.getElementById("memberFilter");
    if (!select) return;

    try {
        const data = await SpendShare.apiFetch("/member/members");
        if (!data.success) return;

        data.members.forEach(m => {
            select.innerHTML += `<option value="${m._id}">${escapeHtml(m.name)}</option>`;
        });
    } catch (error) {
        console.error(error);
    }
}

async function loadExpenses() {
    const tbody = document.getElementById("expenseTableBody");
    const { token } = SpendShare.getAuth();

    try {
        const response = await fetch(`${SpendShare.API_BASE}/expense/`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await response.json();

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load expenses", "error");
            return;
        }

        allExpenses = data.expenses || [];
        applyFilters();

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load expenses", "error");
        if (tbody) {
            tbody.innerHTML = "";
            showEmpty(true);
        }
    }
}

/* ===========================
   FILTER & SORT
=========================== */

function initFilters() {
    const inputs = [
        "searchExpense", "categoryFilter", "memberFilter",
        "paymentFilter", "monthFilter", "dateFrom", "dateTo"
    ];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(id === "searchExpense" ? "input" : "change", () => {
            currentPage = 1;
            applyFilters();
        });
    });

    document.getElementById("clearFilters")?.addEventListener("click", () => {
        document.getElementById("searchExpense").value = "";
        document.getElementById("categoryFilter").value = "";
        document.getElementById("memberFilter").value = "";
        document.getElementById("paymentFilter").value = "";
        document.getElementById("dateFrom").value = "";
        document.getElementById("dateTo").value = "";
        setDefaultMonth();
        currentPage = 1;
        applyFilters();
        SpendShare.showToast("Filters cleared", "info", 2000);
    });
}

function applyFilters() {
    filteredExpenses = [...allExpenses];

    const search = document.getElementById("searchExpense").value.trim().toLowerCase();
    const category = document.getElementById("categoryFilter").value;
    const member = document.getElementById("memberFilter").value;
    const payment = document.getElementById("paymentFilter").value;
    const month = document.getElementById("monthFilter").value;
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;

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

    if (member) {
        filteredExpenses = filteredExpenses.filter(
            e => e.paidBy?._id?.toString() === member
        );
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

    if (dateFrom) {
        const from = new Date(dateFrom);
        filteredExpenses = filteredExpenses.filter(e => new Date(e.expenseDate) >= from);
    }

    if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        filteredExpenses = filteredExpenses.filter(e => new Date(e.expenseDate) <= to);
    }

    sortExpenses();
    updateStats();
    renderTable();
    renderPagination();
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
            case "category":
                valA = a.category.toLowerCase();
                valB = b.category.toLowerCase();
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
            if (icon) {
                icon.className = `fa-solid fa-sort-${sortDir === "asc" ? "up" : "down"} sort-icon`;
            }

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

/* ===========================
   RENDER
=========================== */

function updateStats() {
    const total = filteredExpenses.length;
    const amount = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    document.getElementById("totalRecords").textContent = total;
    document.getElementById("totalAmount").textContent = SpendShare.formatCurrency(amount);
    document.getElementById("showingRange").textContent = total === 0 ? "0" : `${start}–${end}`;
}

function renderTable() {
    const tbody = document.getElementById("expenseTableBody");
    const wrapper = document.getElementById("tableWrapper");
    const empty = document.getElementById("tableEmpty");

    if (!filteredExpenses.length) {
        tbody.innerHTML = "";
        showEmpty(true);
        return;
    }

    showEmpty(false);

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = filteredExpenses.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageData.map(expense => `
        <tr class="fade-in">
            <td>${SpendShare.formatDate(expense.expenseDate)}</td>
            <td><span class="expense-title-cell" title="${escapeHtml(expense.title)}">${escapeHtml(expense.title)}</span></td>
            <td><span class="badge badge-primary">${escapeHtml(expense.category)}</span></td>
            <td>${escapeHtml(expense.paidBy?.name || "—")}</td>
            <td class="amount-cell">${SpendShare.formatCurrency(expense.amount)}</td>
            <td>${getPaymentBadge(expense.paymentMethod)}</td>
            <td>
                <button class="view-btn" data-id="${expense._id}">
                    <i class="fa-solid fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join("");
}

function showEmpty(show) {
    const wrapper = document.getElementById("tableWrapper");
    const empty = document.getElementById("tableEmpty");
    const pagination = document.getElementById("pagination");

    if (wrapper) wrapper.style.display = show ? "none" : "block";
    if (empty) empty.style.display = show ? "flex" : "none";
    if (pagination) pagination.style.display = show ? "none" : "flex";
}

function getPaymentBadge(method) {
    const map = {
        "Cash": "cash",
        "UPI": "upi",
        "Debit Card": "card",
        "Credit Card": "card",
        "Bank Transfer": "bank"
    };
    const cls = map[method] || "bank";
    return `<span class="payment-badge ${cls}">${escapeHtml(method || "—")}</span>`;
}

/* ===========================
   PAGINATION
=========================== */

function renderPagination() {
    const container = document.getElementById("pagination");
    const totalPages = Math.ceil(filteredExpenses.length / PAGE_SIZE);

    if (totalPages <= 1) {
        container.innerHTML = filteredExpenses.length > 0
            ? `<span class="page-info">${filteredExpenses.length} record${filteredExpenses.length !== 1 ? "s" : ""}</span>`
            : "";
        return;
    }

    let html = `
        <button class="page-btn" id="prevPage" ${currentPage === 1 ? "disabled" : ""}>
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-num ${i === currentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
    }

    html += `
        <button class="page-btn" id="nextPage" ${currentPage === totalPages ? "disabled" : ""}>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
        <span class="page-info">Page ${currentPage} of ${totalPages}</span>
    `;

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

/* ===========================
   MODAL
=========================== */

function initModal() {
    const modal = document.getElementById("expenseModal");
    const tbody = document.getElementById("expenseTableBody");

    tbody.addEventListener("click", (e) => {
        const btn = e.target.closest(".view-btn");
        if (!btn) return;
        openModal(btn.dataset.id);
    });

    document.getElementById("modalClose")?.addEventListener("click", closeModal);

    modal?.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
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
    document.getElementById("detailCategory").innerHTML =
        `<span class="badge badge-primary">${escapeHtml(expense.category)}</span>`;
    document.getElementById("detailPaidBy").textContent = expense.paidBy?.name || "—";
    document.getElementById("detailDate").textContent = SpendShare.formatDate(expense.expenseDate);
    document.getElementById("detailPayment").innerHTML = getPaymentBadge(expense.paymentMethod);
    document.getElementById("detailNotes").textContent = expense.notes || "No notes added.";

    const receiptPreview = document.getElementById("receiptPreview");
    const receiptImage = document.getElementById("receiptImage");
    const receiptPdfLink = document.getElementById("receiptPdfLink");

    if (expense.receipt) {
        receiptPreview.style.display = "block";
        const receiptUrl = `${API_BASE}/uploads/${expense.receipt}`;
        const isPdf = expense.receipt.toLowerCase().endsWith(".pdf");

        if (isPdf) {
            receiptImage.style.display = "none";
            receiptPdfLink.style.display = "inline-flex";
            receiptPdfLink.href = receiptUrl;
        } else {
            receiptImage.style.display = "block";
            receiptImage.src = receiptUrl;
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

/* ===========================
   EXPORT
=========================== */

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
    link.download = `SpendShare-Expenses-${SpendShare.getCurrentMonth()}.csv`;
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
    doc.text("SpendShare — Expense Report", 14, 20);
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
        headStyles: { fillColor: [124, 58, 237] },
        alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`SpendShare-Expenses-${SpendShare.getCurrentMonth()}.pdf`);
    SpendShare.showToast("PDF downloaded", "success");
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
