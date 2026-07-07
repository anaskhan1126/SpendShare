/**
 * SpendShare — Admin Monthly Summary
 */

const PAGE_SIZE = 10;
const CHART_COLORS = [
    "#7C3AED", "#2563EB", "#22C55E", "#F59E0B",
    "#EF4444", "#0891B2", "#EC4899", "#8B5CF6"
];

let trendChart = null;
let categoryChart = null;
let allExpenses = [];
let filteredExpenses = [];
let lastTrend = [];
let lastCategories = [];
let currentPage = 1;
let currentMonthLabel = "";

document.addEventListener("DOMContentLoaded", () => {
    if (!SpendShare.requireAdminAuth()) return;

    SpendShare.initAdminAuthUI();
    SpendShare.initAdminLogout();
    initDropdownLogout();
    initActions();
    initThemeChartRefresh();
    loadAvailableMonths();
});

function initThemeChartRefresh() {
    document.getElementById("themeToggle")?.addEventListener("click", () => {
        setTimeout(() => {
            if (lastTrend.length) drawTrendChart(lastTrend);
            if (lastCategories.length) drawCategoryChart(lastCategories);
        }, 300);
    });
}

function initDropdownLogout() {
    document.getElementById("dropdownLogout")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

function initActions() {
    document.getElementById("refreshBtn")?.addEventListener("click", () => {
        const btn = document.getElementById("refreshBtn");
        const month = document.getElementById("monthFilter")?.value;
        btn?.classList.add("loading");
        loadMonthlySummary(month, true).finally(() => btn?.classList.remove("loading"));
    });

    document.getElementById("searchExpense")?.addEventListener("input", () => {
        filterExpenses();
    });

    document.getElementById("pdfBtn")?.addEventListener("click", exportPDF);
    document.getElementById("excelBtn")?.addEventListener("click", exportExcel);
}

async function loadAvailableMonths() {
    try {
        const data = await SpendShare.adminApiFetch("/admin/monthly-summary/months");

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load months", "error");
            return;
        }

        const monthFilter = document.getElementById("monthFilter");
        monthFilter.innerHTML = "";

        (data.months || []).forEach(month => {
            monthFilter.innerHTML += `<option value="${month.value}">${month.label}</option>`;
        });

        if (!data.months?.length) {
            const now = SpendShare.getCurrentMonth();
            const label = new Date(now + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
            monthFilter.innerHTML = `<option value="${now}">${label}</option>`;
        }

        monthFilter.onchange = () => loadMonthlySummary(monthFilter.value);
        loadMonthlySummary(monthFilter.value);

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load months", "error");
    }
}

async function loadMonthlySummary(month, showToast = false) {
    try {
        const data = await SpendShare.adminApiFetch(`/admin/monthly-summary?month=${month}`);

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load report", "error");
            return;
        }

        allExpenses = data.expenses || [];
        lastTrend = data.trend || [];
        lastCategories = data.categories || [];

        const monthFilter = document.getElementById("monthFilter");
        currentMonthLabel = monthFilter?.selectedOptions[0]?.text || month;

        updateCards(data.summary);
        filterExpenses();
        drawTrendChart(lastTrend);
        drawCategoryChart(lastCategories);

        if (showToast) {
            SpendShare.showToast("Report updated", "success", 2000);
        }

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load monthly report", "error");
    }
}

function updateCards(summary) {
    if (!summary) return;

    SpendShare.animateCounter(
        document.getElementById("totalExpense"),
        summary.totalExpense || 0,
        "₹",
        ""
    );
    SpendShare.animateCounter(
        document.getElementById("memberCount"),
        summary.memberCount || 0,
        "",
        ""
    );
    SpendShare.animateCounter(
        document.getElementById("equalShare"),
        summary.equalShare || 0,
        "₹",
        ""
    );
    SpendShare.animateCounter(
        document.getElementById("expenseCount"),
        summary.expenseCount || 0,
        "",
        ""
    );
}

function filterExpenses() {
    const value = document.getElementById("searchExpense")?.value.trim().toLowerCase() || "";

    filteredExpenses = allExpenses.filter(expense => {
        if (!value) return true;
        return (
            expense.title.toLowerCase().includes(value) ||
            expense.category.toLowerCase().includes(value) ||
            (expense.paidBy?.name || "").toLowerCase().includes(value)
        );
    });

    currentPage = 1;
    renderTable();
    renderPagination();
}

function renderTable() {
    const tbody = document.getElementById("reportBody");
    const wrap = document.getElementById("tableWrapper");
    const empty = document.getElementById("tableEmpty");

    if (!filteredExpenses.length) {
        tbody.innerHTML = "";
        wrap.style.display = "none";
        empty.style.display = "flex";
        return;
    }

    wrap.style.display = "block";
    empty.style.display = "none";

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = filteredExpenses.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageData.map(expense => `
        <tr class="fade-in">
            <td>${SpendShare.formatDate(expense.expenseDate)}</td>
            <td><strong>${escapeHtml(expense.title)}</strong></td>
            <td>${escapeHtml(expense.paidBy?.name || "—")}</td>
            <td><span class="badge badge-primary">${escapeHtml(expense.category)}</span></td>
            <td class="amount-cell">${SpendShare.formatCurrency(expense.amount)}</td>
        </tr>
    `).join("");
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

function getChartTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
        textColor: isDark ? "#94A3B8" : "#6B7280",
        gridColor: isDark ? "rgba(148,163,184,0.1)" : "rgba(0,0,0,0.05)"
    };
}

function drawTrendChart(trend) {
    const skeleton = document.getElementById("trendSkeleton");
    const wrap = document.getElementById("trendChartWrap");
    const empty = document.getElementById("trendEmpty");
    const canvas = document.getElementById("trendChart");

    if (skeleton) skeleton.style.display = "none";

    if (!trend.length) {
        if (wrap) wrap.style.display = "none";
        if (empty) empty.style.display = "flex";
        if (trendChart) { trendChart.destroy(); trendChart = null; }
        return;
    }

    if (wrap) wrap.style.display = "block";
    if (empty) empty.style.display = "none";

    const { textColor, gridColor } = getChartTheme();

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: trend.map(item => item.label),
            datasets: [{
                label: "Daily Spending",
                data: trend.map(item => item.amount),
                backgroundColor: "rgba(124, 58, 237, 0.75)",
                borderColor: "#7C3AED",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const item = trend[context.dataIndex];
                            const lines = [`Total: ${SpendShare.formatCurrency(item.amount)}`];
                            (item.members || []).forEach(member => {
                                lines.push(`${member.name}: ${SpendShare.formatCurrency(member.amount)}`);
                            });
                            return lines;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor, font: { family: "Inter", size: 11 } },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor, font: { family: "Inter", size: 11 } },
                    grid: { color: gridColor }
                }
            }
        }
    });
}

function drawCategoryChart(categories) {
    const skeleton = document.getElementById("categorySkeleton");
    const wrap = document.getElementById("categoryChartWrap");
    const empty = document.getElementById("categoryEmpty");
    const canvas = document.getElementById("categoryChart");

    if (skeleton) skeleton.style.display = "none";

    if (!categories.length) {
        if (wrap) wrap.style.display = "none";
        if (empty) empty.style.display = "flex";
        if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
        return;
    }

    if (wrap) wrap.style.display = "block";
    if (empty) empty.style.display = "none";

    const { textColor } = getChartTheme();

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: categories.map(item => item.category),
            datasets: [{
                data: categories.map(item => item.amount),
                backgroundColor: CHART_COLORS,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        padding: 14,
                        usePointStyle: true,
                        pointStyle: "circle",
                        color: textColor,
                        font: { family: "Inter", size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            return ` ${ctx.label}: ${SpendShare.formatCurrency(ctx.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

function exportExcel() {
    const source = filteredExpenses.length ? filteredExpenses : allExpenses;

    if (!source.length) {
        SpendShare.showToast("No data to export", "warning");
        return;
    }

    const headers = ["Date", "Expense", "Paid By", "Category", "Amount"];
    const rows = source.map(expense => [
        SpendShare.formatDate(expense.expenseDate),
        expense.title,
        expense.paidBy?.name || "",
        expense.category,
        expense.amount
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SpendShare-Monthly-${currentMonthLabel.replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    SpendShare.showToast("Excel file downloaded", "success");
}

function exportPDF() {
    const source = filteredExpenses.length ? filteredExpenses : allExpenses;

    if (!source.length) {
        SpendShare.showToast("No data to export", "warning");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(124, 58, 237);
    doc.text("SpendShare", 105, 18, { align: "center" });

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Monthly Expense Report", 105, 28, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Month: ${currentMonthLabel}`, 14, 40);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 140, 40);

    doc.autoTable({
        startY: 48,
        theme: "grid",
        head: [["Metric", "Value"]],
        body: [
            ["Total Expense", document.getElementById("totalExpense").textContent],
            ["Members", document.getElementById("memberCount").textContent],
            ["Equal Share", document.getElementById("equalShare").textContent],
            ["Expenses", document.getElementById("expenseCount").textContent]
        ],
        headStyles: { fillColor: [124, 58, 237] }
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 12,
        head: [["Date", "Expense", "Paid By", "Category", "Amount"]],
        body: source.map(expense => [
            SpendShare.formatDate(expense.expenseDate),
            expense.title,
            expense.paidBy?.name || "",
            expense.category,
            SpendShare.formatCurrency(expense.amount)
        ]),
        theme: "striped",
        headStyles: { fillColor: [124, 58, 237] },
        styles: { fontSize: 9, cellPadding: 3 }
    });

    doc.setFontSize(9);
    doc.text("Generated by SpendShare", 105, doc.internal.pageSize.height - 12, { align: "center" });

    doc.save(`SpendShare-Monthly-${currentMonthLabel.replace(/\s+/g, "-")}.pdf`);
    SpendShare.showToast("PDF downloaded", "success");
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
