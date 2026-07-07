/**
 * SpendShare — Reports & Exports
 */

let allExpenses = [];
let filteredExpenses = [];
let flatMembers = [];
let allSettlements = [];

let trendChart;
let categoryChart;
let memberChart;

document.addEventListener("DOMContentLoaded", async () => {
    if (!SpendShare.requireAuth()) return;

    SpendShare.initAuthUI();
    initDropdownLogout();
    await loadInitialData();
    initFilters();
    initActionButtons();
    
    // Automatically generate initial report on load
    generateReport();
});

function initDropdownLogout() {
    const btn = document.getElementById("dropdownLogout");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

async function loadInitialData() {
    try {
        // Load available months
        const monthFilter = document.getElementById("monthFilter");
        const monthsData = await SpendShare.apiFetch("/member/monthly-summary/months");
        if (monthsData.success && monthsData.months) {
            monthFilter.innerHTML = monthsData.months.map(m => `
                <option value="${m.value}">${escapeHtml(m.label)}</option>
            `).join("");
        } else {
            monthFilter.innerHTML = `<option value="${SpendShare.getCurrentMonth()}">${SpendShare.getCurrentMonth()}</option>`;
        }

        // Load flat members
        const memberFilter = document.getElementById("memberFilter");
        const membersData = await SpendShare.apiFetch("/member/members");
        if (membersData.success && membersData.members) {
            flatMembers = membersData.members;
            membersData.members.forEach(m => {
                memberFilter.innerHTML += `<option value="${m._id}">${escapeHtml(m.name)}</option>`;
            });
        }

        // Load flat-wide expenses
        const expensesData = await SpendShare.apiFetch("/expense/");
        if (expensesData.success && expensesData.expenses) {
            allExpenses = expensesData.expenses;
        }

        // Load settlements
        const settlementsData = await SpendShare.apiFetch("/settlement");
        if (settlementsData.success && settlementsData.transactions) {
            allSettlements = settlementsData.transactions;
        }

    } catch (e) {
        console.error("Failed to load initial report data:", e);
        SpendShare.showToast("Failed to initialize reports data", "error");
    }
}

function initFilters() {
    document.getElementById("generateBtn")?.addEventListener("click", generateReport);
    
    // Auto-refresh dates based on month selection
    document.getElementById("monthFilter")?.addEventListener("change", (e) => {
        const month = e.target.value;
        if (month) {
            const [year, mon] = month.split("-").map(Number);
            const start = new Date(year, mon - 1, 1).toISOString().split("T")[0];
            const end = new Date(year, mon, 0).toISOString().split("T")[0];
            document.getElementById("dateFrom").value = start;
            document.getElementById("dateTo").value = end;
        }
    });
}

function generateReport() {
    const reportType = document.getElementById("reportType").value;
    const month = document.getElementById("monthFilter").value;
    const category = document.getElementById("categoryFilter").value;
    const memberId = document.getElementById("memberFilter").value;
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;

    const spinner = document.getElementById("loadingSpinner");
    if (spinner) spinner.style.display = "inline-block";

    setTimeout(() => {
        // Filter expenses
        filteredExpenses = [...allExpenses];

        if (month && !dateFrom && !dateTo) {
            const [year, mon] = month.split("-").map(Number);
            const start = new Date(year, mon - 1, 1);
            const end = new Date(year, mon, 1);
            filteredExpenses = filteredExpenses.filter(e => {
                const d = new Date(e.expenseDate);
                return d >= start && d < end;
            });
        }

        if (dateFrom) {
            const start = new Date(dateFrom);
            filteredExpenses = filteredExpenses.filter(e => new Date(e.expenseDate) >= start);
        }

        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            filteredExpenses = filteredExpenses.filter(e => new Date(e.expenseDate) <= end);
        }

        if (category) {
            filteredExpenses = filteredExpenses.filter(e => e.category === category);
        }

        if (memberId) {
            filteredExpenses = filteredExpenses.filter(e => e.paidBy && (e.paidBy._id === memberId || e.paidBy === memberId));
        }

        // Render sections based on report type
        renderReportStats();
        renderReportCharts();
        renderReportTable(reportType);

        if (spinner) spinner.style.display = "none";
        SpendShare.showToast("Report generated successfully", "success", 1500);
    }, 300);
}

function renderReportStats() {
    const total = filteredExpenses.length;
    const totalAmount = filteredExpenses.reduce((s, e) => s + e.amount, 0);

    let highest = 0;
    let lowest = total > 0 ? Infinity : 0;
    filteredExpenses.forEach(e => {
        if (e.amount > highest) highest = e.amount;
        if (e.amount < lowest) lowest = e.amount;
    });
    if (lowest === Infinity) lowest = 0;

    const average = total > 0 ? totalAmount / total : 0;

    document.getElementById("totalExpense").textContent = SpendShare.formatCurrency(totalAmount);
    document.getElementById("totalMembers").textContent = flatMembers.length;
    document.getElementById("highestExpense").textContent = SpendShare.formatCurrency(highest);
    document.getElementById("lowestExpense").textContent = SpendShare.formatCurrency(lowest);
    document.getElementById("averageExpense").textContent = SpendShare.formatCurrency(average);
}

function renderReportCharts() {
    // 1. Monthly Trend Chart
    const trendCtx = document.getElementById("trendChart");
    if (trendChart) trendChart.destroy();

    const trendMap = {};
    filteredExpenses.forEach(e => {
        const dateStr = new Date(e.expenseDate).toLocaleDateString("en-IN");
        trendMap[dateStr] = (trendMap[dateStr] || 0) + e.amount;
    });

    trendChart = new Chart(trendCtx, {
        type: "bar",
        data: {
            labels: Object.keys(trendMap),
            datasets: [{
                label: "Amount",
                data: Object.values(trendMap),
                backgroundColor: "#7c3aed",
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });

    // 2. Category Distribution
    const catCtx = document.getElementById("categoryChart");
    if (categoryChart) categoryChart.destroy();

    const catMap = {};
    filteredExpenses.forEach(e => {
        catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });

    const catTotal = Object.values(catMap).reduce((s, v) => s + v, 0);

    categoryChart = new Chart(catCtx, {
        type: "pie",
        data: {
            labels: Object.keys(catMap).map(k => {
                const pct = catTotal > 0 ? ((catMap[k] / catTotal) * 100).toFixed(0) : 0;
                return `${k} (${pct}%)`;
            }),
            datasets: [{
                data: Object.values(catMap),
                backgroundColor: ["#7c3aed", "#10b981", "#3b82f6", "#f59e0b", "#ef4444"]
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: "bottom" } }
        }
    });

    // 3. Member Contribution
    const memCtx = document.getElementById("memberChart");
    if (memberChart) memberChart.destroy();

    const memMap = {};
    flatMembers.forEach(m => { memMap[m.name] = 0; });
    filteredExpenses.forEach(e => {
        const name = e.paidBy ? (e.paidBy.name || "Unknown") : "Unknown";
        memMap[name] = (memMap[name] || 0) + e.amount;
    });

    memberChart = new Chart(memCtx, {
        type: "doughnut",
        data: {
            labels: Object.keys(memMap),
            datasets: [{
                data: Object.values(memMap),
                backgroundColor: ["#06b6d4", "#ec4899", "#8b5cf6", "#10b981", "#f59e0b"]
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: "bottom" } }
        }
    });

    // 4. Settlement Overview List
    const settlementOverview = document.getElementById("settlementOverview");
    if (settlementOverview) {
        const pending = allSettlements.filter(t => t.status === "Pending");
        if (pending.length === 0) {
            settlementOverview.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:13px;"><i class="fa-solid fa-circle-check" style="color:#10b981;"></i> All debts fully settled!</div>`;
        } else {
            settlementOverview.innerHTML = pending.slice(0, 3).map(t => `
                <div style="display:flex; justify-content:space-between; font-size:12px; padding:8px 12px; background:var(--background); border-radius:6px; border:1px solid var(--border-light);">
                    <span><strong>${escapeHtml(t.from?.name)}</strong> owes <strong>${escapeHtml(t.to?.name)}</strong></span>
                    <strong style="color:var(--danger)">₹${Number(t.amount).toFixed(2)}</strong>
                </div>
            `).join("");
        }
    }
}

function renderReportTable(reportType) {
    const tbody = document.getElementById("reportTableBody");
    const head = document.getElementById("reportTableHead");
    if (!tbody || !head) return;

    if (reportType === "settlement") {
        head.innerHTML = `
            <tr>
                <th style="text-align: left; padding: 12px 16px;">From</th>
                <th style="text-align: left; padding: 12px 16px;">To</th>
                <th style="text-align: right; padding: 12px 16px;">Amount</th>
                <th style="text-align: center; padding: 12px 16px;">Status</th>
                <th style="text-align: left; padding: 12px 16px;">Created At</th>
            </tr>
        `;

        if (allSettlements.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--text-muted);">No settlements found.</td></tr>`;
            return;
        }

        tbody.innerHTML = allSettlements.map(t => `
            <tr>
                <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light); font-weight:600;">${escapeHtml(t.from?.name || "—")}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light); font-weight:600; color:var(--primary);">${escapeHtml(t.to?.name || "—")}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light); text-align:right; font-weight:700;">₹${Number(t.amount).toFixed(2)}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light); text-align:center;">
                    <span style="background:${t.status === "Paid" ? "#d1fae5" : "#fef3c7"}; color:${t.status === "Paid" ? "#065f46" : "#b45309"}; padding: 4px 8px; border-radius: 4px; font-weight:600; font-size:12px;">
                        ${t.status}
                    </span>
                </td>
                <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light);">${SpendShare.formatDate(t.createdAt)}</td>
            </tr>
        `).join("");

    } else {
        head.innerHTML = `
            <tr>
                <th style="text-align: left; padding: 12px 16px;">Expense</th>
                <th style="text-align: left; padding: 12px 16px;">Paid By</th>
                <th style="text-align: left; padding: 12px 16px;">Category</th>
                <th style="text-align: right; padding: 12px 16px;">Amount</th>
                <th style="text-align: left; padding: 12px 16px;">Date</th>
                <th style="text-align: left; padding: 12px 16px;">Payment Method</th>
                <th style="text-align: center; padding: 12px 16px;">Receipt</th>
            </tr>
        `;

        if (filteredExpenses.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                            <i class="fa-solid fa-receipt" style="font-size: 32px; color: #d1d5db;"></i>
                            <strong>No Expenses Match Filters</strong>
                            <p style="font-size:12px; margin:0;">Try adjusting your date range or category filters.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredExpenses.map(e => {
            const hasReceipt = e.receipt 
                ? `<a href="${SpendShare.API_BASE}/uploads/${e.receipt}" target="_blank" style="color:var(--primary); font-weight:600;"><i class="fa-solid fa-file-invoice"></i> View</a>` 
                : `<span style="color:var(--text-muted);">None</span>`;

            return `
                <tr>
                    <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light);"><strong>${escapeHtml(e.title)}</strong></td>
                    <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light);">${escapeHtml(e.paidBy?.name || "Unknown")}</td>
                    <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light);"><span class="badge badge-primary">${escapeHtml(e.category)}</span></td>
                    <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light); text-align:right; font-weight:700;">${SpendShare.formatCurrency(e.amount)}</td>
                    <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light);">${SpendShare.formatDate(e.expenseDate)}</td>
                    <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light);">${escapeHtml(e.paymentMethod || "—")}</td>
                    <td style="padding: 12px 16px; border-bottom: 1px solid var(--border-light); text-align:center;">${hasReceipt}</td>
                </tr>
            `;
        }).join("");
    }
}

function initActionButtons() {
    document.getElementById("pdfBtn")?.addEventListener("click", exportPDF);
    document.getElementById("excelBtn")?.addEventListener("click", exportExcel);
    document.getElementById("printBtn")?.addEventListener("click", () => window.print());
}

async function exportPDF() {
    const reportType = document.getElementById("reportType").value;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(124, 58, 237);
    doc.text("SpendShare", 105, 18, { align: "center" });

    doc.setFontSize(14);
    doc.setTextColor(50);
    const title = reportType === "settlement" ? "Settlement Report" : "Monthly Expense Report";
    doc.text(title, 105, 28, { align: "center" });

    const totalAmt = filteredExpenses.reduce((s, e) => s + e.amount, 0);

    doc.autoTable({
        startY: 38,
        theme: "grid",
        head: [["Metric", "Value"]],
        body: [
            ["Total Expense", SpendShare.formatCurrency(totalAmt)],
            ["Total Members", String(flatMembers.length)],
            ["Report Generated", new Date().toLocaleDateString("en-IN")]
        ]
    });

    if (reportType === "settlement") {
        const rows = allSettlements.map(t => [
            t.from?.name || "Unknown",
            t.to?.name || "Unknown",
            SpendShare.formatCurrency(t.amount),
            t.status,
            SpendShare.formatDate(t.createdAt)
        ]);
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 15,
            head: [["From", "To", "Amount", "Status", "Created At"]],
            body: rows,
            headStyles: { fillColor: [124, 58, 237] }
        });
    } else {
        const rows = filteredExpenses.map(e => [
            e.title,
            e.paidBy?.name || "Unknown",
            e.category,
            SpendShare.formatCurrency(e.amount),
            SpendShare.formatDate(e.expenseDate)
        ]);
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 15,
            head: [["Expense", "Paid By", "Category", "Amount", "Date"]],
            body: rows,
            headStyles: { fillColor: [124, 58, 237] }
        });
    }

    doc.save(`SpendShare_Report_${Date.now()}.pdf`);
    SpendShare.showToast("PDF report downloaded", "success");
}

function exportExcel() {
    const reportType = document.getElementById("reportType").value;
    let csv = "";

    if (reportType === "settlement") {
        csv = "From,To,Amount,Status,Created At\n";
        allSettlements.forEach(t => {
            csv += `"${t.from?.name || ""}","${t.to?.name || ""}",${t.amount},"${t.status}","${SpendShare.formatDate(t.createdAt)}"\n`;
        });
    } else {
        csv = "Expense,Paid By,Category,Amount,Date,Payment Method\n";
        filteredExpenses.forEach(e => {
            csv += `"${e.title}","${e.paidBy?.name || ""}","${e.category}",${e.amount},"${SpendShare.formatDate(e.expenseDate)}","${e.paymentMethod || ""}"\n`;
        });
    }

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SpendShare_${reportType}_Report_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    SpendShare.showToast("Excel sheet downloaded", "success");
}

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
