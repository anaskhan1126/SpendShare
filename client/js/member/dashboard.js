/**
 * SpendShare — Member Dashboard
 */

let expenseChart = null;
let trendChart = null;
let lastCategories = [];
let lastTrend = [];

const CHART_COLORS = [
    "#7C3AED", "#2563EB", "#22C55E", "#F59E0B",
    "#EF4444", "#0891B2", "#EC4899", "#8B5CF6"
];

document.addEventListener("DOMContentLoaded", async () => {
    if (!SpendShare.requireAuth()) return;

    SpendShare.initAuthUI();
    initDropdownLogout();
    initNotificationBtn();
    await loadDashboard();

    // Card navigation listeners
    const cards = ["cardSpent", "cardOwe", "cardReceive", "cardNet"];
    cards.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.cursor = "pointer";
    });

    document.getElementById("cardSpent")?.addEventListener("click", () => {
        window.location.href = "expenses.html?filter=my-expenses";
    });
    document.getElementById("cardOwe")?.addEventListener("click", () => {
        window.location.href = "settlement.html?filter=you-owe";
    });
    document.getElementById("cardReceive")?.addEventListener("click", () => {
        window.location.href = "settlement.html?filter=owed-to-you";
    });
    document.getElementById("cardNet")?.addEventListener("click", () => {
        window.location.href = "settlement.html?filter=net-balance";
    });
});

function initNotificationBtn() {
    const btn = document.getElementById("notificationBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
        const dot = document.getElementById("notificationDot");
        if (dot && dot.style.display !== "none") {
            SpendShare.showToast("You have pending settlements", "warning");
            setTimeout(() => {
                window.location.href = "settlement.html";
            }, 1200);
        } else {
            SpendShare.showToast("No new notifications", "info", 2000);
        }
    });
}

function initDropdownLogout() {
    const btn = document.getElementById("dropdownLogout");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

/* ===========================
   MAIN LOAD
=========================== */

async function loadDashboard() {
    const { memberId } = SpendShare.getAuth();
    const currentMonth = SpendShare.getCurrentMonth();
    const prevMonth = SpendShare.getPreviousMonth(currentMonth);

    try {
        const results = await Promise.allSettled([
            SpendShare.apiFetch(`/expense/member/${memberId}`),
            SpendShare.apiFetch("/settlement/member"),
            SpendShare.apiFetch(`/member/monthly-summary?month=${currentMonth}`),
            SpendShare.apiFetch(`/member/monthly-summary?month=${prevMonth}`)
        ]);

        const expensesData = results[0].status === "fulfilled" ? results[0].value : { success: false };
        const settlementData = results[1].status === "fulfilled" ? results[1].value : { success: false };
        const summaryData = results[2].status === "fulfilled" ? results[2].value : { success: false };
        const prevSummaryData = results[3].status === "fulfilled" ? results[3].value : { success: false };

        if (!expensesData.success && !summaryData.success) {
            SpendShare.showToast("Failed to load core dashboard data", "error");
            return;
        }

        revealStatCards();
        updateSummaryCards(expensesData, settlementData, summaryData, prevSummaryData);
        renderRecentExpenses((summaryData && summaryData.expenses) || (expensesData && expensesData.expenses) || []);
        renderInsights(summaryData || { success: false }, prevSummaryData || { success: false });
        renderSettlementOverview(settlementData || { success: false });
        
        lastCategories = (summaryData && summaryData.categories) || [];
        lastTrend = (summaryData && summaryData.trend) || [];
        renderCategoryChart(lastCategories);
        renderTrendChart(lastTrend);

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load dashboard data", "error");
    }
}

/* ===========================
   STAT CARDS
=========================== */

function revealStatCards() {
    document.querySelectorAll(".stat-card").forEach(card => {
        const skeleton = card.querySelector(".stat-card-skeleton");
        const content = card.querySelector(".stat-card-content");
        if (skeleton) skeleton.style.display = "none";
        if (content) content.style.display = "flex";
    });
}

function updateSummaryCards(expensesData, settlementData, summaryData, prevSummaryData) {
    const currentMonth = SpendShare.getCurrentMonth();
    const [year, mon] = currentMonth.split("-").map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 1);

    let totalPaid = 0;
    (expensesData.expenses || []).forEach(expense => {
        const d = new Date(expense.expenseDate);
        if (d >= startDate && d < endDate) {
            totalPaid += expense.amount;
        }
    });

    SpendShare.animateCounter(document.getElementById("totalPaid"), totalPaid);

    if (settlementData.success && settlementData.summary) {
        const { totalOwe, totalReceive, netBalance } = settlementData.summary;

        SpendShare.animateCounter(document.getElementById("totalOwe"), totalOwe);
        SpendShare.animateCounter(document.getElementById("totalReceive"), totalReceive);

        const netEl = document.getElementById("netBalance");
        const sign = netBalance >= 0 ? "+" : "-";
        SpendShare.animateCounter(netEl, Math.abs(netBalance));
        setTimeout(() => {
            netEl.textContent = `${sign}₹${Math.abs(netBalance).toFixed(2)}`;
            netEl.style.color = netBalance >= 0 ? "var(--success)" : "var(--danger)";
        }, 1300);

        const pending = (settlementData.transactions || []).filter(t => t.status === "Pending");
        const dot = document.getElementById("notificationDot");
        if (dot && pending.length > 0) {
            dot.style.display = "block";
        }
    }

    const paidChange = document.getElementById("paidChange");
    if (paidChange && prevSummaryData.success) {
        const prevTotal = prevSummaryData.summary?.totalExpense || 0;
        const currTotal = summaryData.summary?.totalExpense || 0;
        if (prevTotal > 0) {
            const change = ((currTotal - prevTotal) / prevTotal * 100).toFixed(1);
            const isUp = change >= 0;
            paidChange.textContent = `${isUp ? "↑" : "↓"} ${Math.abs(change)}% vs last month`;
            paidChange.className = `stat-change ${isUp ? "up" : "down"}`;
        }
    }
}

/* ===========================
   RECENT EXPENSES
=========================== */

function renderRecentExpenses(expenses) {
    const tbody = document.getElementById("recentExpensesBody");
    const empty = document.getElementById("recentEmpty");
    const tableWrapper = document.querySelector(".recent-card .table-wrapper");

    if (!tbody) return;

    const recent = (expenses || []).slice(0, 6);

    if (recent.length === 0) {
        tbody.innerHTML = "";
        if (tableWrapper) tableWrapper.style.display = "none";
        if (empty) empty.style.display = "flex";
        return;
    }

    if (empty) empty.style.display = "none";
    if (tableWrapper) tableWrapper.style.display = "block";

    tbody.innerHTML = recent.map(expense => `
        <tr class="fade-in">
            <td><span class="expense-title">${escapeHtml(expense.title)}</span></td>
            <td>
                <span class="badge badge-primary expense-category">
                    ${escapeHtml(expense.category || "Other")}
                </span>
            </td>
            <td>${escapeHtml(expense.paidBy?.name || expense.paidBy || "—")}</td>
            <td>${SpendShare.formatDate(expense.expenseDate || expense.date)}</td>
            <td class="amount-cell">${SpendShare.formatCurrency(expense.amount)}</td>
        </tr>
    `).join("");
}

/* ===========================
   INSIGHTS
=========================== */

function renderInsights(current, previous) {
    const grid = document.getElementById("insightsGrid");
    if (!grid || !current.success) return;

    const expenses = current.expenses || [];
    const categories = current.categories || [];
    const summary = current.summary || {};
    const prevSummary = previous.success ? previous.summary : {};

    const topCategory = categories.length
        ? categories.reduce((a, b) => a.amount > b.amount ? a : b)
        : null;

    const largestExpense = expenses.length
        ? expenses.reduce((a, b) => a.amount > b.amount ? a : b)
        : null;

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const dailyAvg = summary.totalExpense
        ? summary.totalExpense / daysElapsed
        : 0;

    const memberActivity = {};
    expenses.forEach(e => {
        const name = e.paidBy?.name || "Unknown";
        memberActivity[name] = (memberActivity[name] || 0) + 1;
    });
    const mostActive = Object.keys(memberActivity).length
        ? Object.entries(memberActivity).sort((a, b) => b[1] - a[1])[0]
        : null;

    const currTotal = summary.totalExpense || 0;
    const prevTotal = prevSummary.totalExpense || 0;
    let monthCompare = "No data";
    if (prevTotal > 0) {
        const diff = ((currTotal - prevTotal) / prevTotal * 100).toFixed(1);
        monthCompare = `${diff >= 0 ? "+" : ""}${diff}%`;
    } else if (currTotal > 0) {
        monthCompare = "First month";
    }

    const insights = [
        {
            icon: "fa-tag", cls: "purple",
            label: "Top Category",
            value: topCategory ? `${topCategory.category} (${SpendShare.formatCurrency(topCategory.amount)})` : "—"
        },
        {
            icon: "fa-receipt", cls: "red",
            label: "Largest Expense",
            value: largestExpense ? `${largestExpense.title} (${SpendShare.formatCurrency(largestExpense.amount)})` : "—"
        },
        {
            icon: "fa-calendar-day", cls: "blue",
            label: "Daily Average",
            value: dailyAvg > 0 ? SpendShare.formatCurrency(dailyAvg) : "—"
        },
        {
            icon: "fa-chart-bar", cls: "orange",
            label: "Monthly Comparison",
            value: monthCompare
        },
        {
            icon: "fa-user-check", cls: "green",
            label: "Most Active Member",
            value: mostActive ? `${mostActive[0]} (${mostActive[1]} expenses)` : "—"
        },
        {
            icon: "fa-coins", cls: "purple",
            label: "Total This Month",
            value: SpendShare.formatCurrency(currTotal)
        }
    ];

    grid.innerHTML = insights.map(item => `
        <div class="insight-item fade-in">
            <div class="insight-icon ${item.cls}">
                <i class="fa-solid ${item.icon}"></i>
            </div>
            <div class="insight-detail">
                <h4>${item.label}</h4>
                <p>${escapeHtml(item.value)}</p>
            </div>
        </div>
    `).join("");
}

/* ===========================
   SETTLEMENT OVERVIEW
=========================== */

function renderSettlementOverview(data) {
    const list = document.getElementById("settlementList");
    const empty = document.getElementById("settlementEmpty");
    if (!list) return;

    if (!data.success) {
        list.innerHTML = "";
        if (empty) empty.style.display = "flex";
        return;
    }

    const pending = (data.transactions || [])
        .filter(t => t.status === "Pending")
        .slice(0, 5);

    if (pending.length === 0) {
        list.innerHTML = "";
        if (empty) empty.style.display = "flex";
        return;
    }

    if (empty) empty.style.display = "none";

    list.innerHTML = pending.map(item => `
        <div class="settlement-item fade-in">
            <div class="settlement-flow">
                <span class="from">${escapeHtml(item.from?.name || "—")}</span>
                <i class="fa-solid fa-arrow-right arrow"></i>
                <span class="to">${escapeHtml(item.to?.name || "—")}</span>
            </div>
            <span class="settlement-amount">${SpendShare.formatCurrency(item.amount)}</span>
        </div>
    `).join("");
}

/* ===========================
   CHARTS
=========================== */

function renderCategoryChart(categories) {
    const skeleton = document.getElementById("overviewSkeleton");
    const wrap = document.getElementById("overviewChartWrap");
    const empty = document.getElementById("overviewEmpty");
    const canvas = document.getElementById("expenseChart");

    if (skeleton) skeleton.style.display = "none";

    if (!categories.length) {
        if (empty) empty.style.display = "flex";
        return;
    }

    if (wrap) wrap.style.display = "block";

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#94A3B8" : "#6B7280";

    if (expenseChart) expenseChart.destroy();

    expenseChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: categories.map(c => c.category),
            datasets: [{
                data: categories.map(c => c.amount),
                backgroundColor: CHART_COLORS,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            animation: { animateRotate: true, duration: 1200 },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        padding: 16,
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

function renderTrendChart(trend) {
    const skeleton = document.getElementById("trendSkeleton");
    const wrap = document.getElementById("trendChartWrap");
    const empty = document.getElementById("trendEmpty");
    const canvas = document.getElementById("trendChart");

    if (skeleton) skeleton.style.display = "none";

    if (!trend.length) {
        if (empty) empty.style.display = "flex";
        return;
    }

    if (wrap) wrap.style.display = "block";

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#94A3B8" : "#6B7280";
    const gridColor = isDark ? "rgba(148,163,184,0.1)" : "rgba(0,0,0,0.05)";

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: trend.map(t => t.label),
            datasets: [{
                label: "Daily Spending",
                data: trend.map(t => t.amount),
                borderColor: "#7C3AED",
                backgroundColor: "rgba(124, 58, 237, 0.1)",
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: "#7C3AED",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1200, easing: "easeOutQuart" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            return ` ${SpendShare.formatCurrency(ctx.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 11 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 11 },
                        callback: val => `₹${val}`
                    }
                }
            }
        }
    });
}

/* ===========================
   UTILS
=========================== */

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// Re-render charts on theme change without full reload
document.getElementById("themeToggle")?.addEventListener("click", () => {
    setTimeout(() => {
        if (lastCategories.length) renderCategoryChart(lastCategories);
        if (lastTrend.length) renderTrendChart(lastTrend);
    }, 300);
});
