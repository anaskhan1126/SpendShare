let activeChart;
let activeTab = "trend";
let allExpenses = [];
let filteredExpenses = [];
let flatMembers = [];
let prevMonthSummary = null;
let lastMemberBalances = [];

// ======================================
// Page Load
// ======================================

document.addEventListener("DOMContentLoaded", async () => {
    if (!SpendShare.requireAuth()) return;

    SpendShare.initAuthUI();
    initDropdownLogout();
    await loadFlatMembers();
    initFilterBindings();
    loadAvailableMonths();

    document.getElementById("refreshBtn")?.addEventListener("click", () => {
        loadMonthlySummary(document.getElementById("monthFilter").value, true);
    });

    document.getElementById("searchExpense")?.addEventListener("keyup", searchFilterExpenses);
    document.getElementById("printBtn")?.addEventListener("click", () => window.print());
    document.getElementById("pdfBtn")?.addEventListener("click", exportPDF);
    document.getElementById("excelBtn")?.addEventListener("click", exportExcel);

    // Initialize Analytics tabs listeners
    const tabs = document.querySelectorAll(".analytics-tabs .tab-btn");
    tabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            tabs.forEach(t => t.classList.remove("active"));
            e.target.classList.add("active");
            activeTab = e.target.getAttribute("data-tab");
            updateChartsForFilteredData(filteredExpenses);
        });
    });

    // Theme toggle listener to redraw chart immediately
    document.getElementById("themeToggle")?.addEventListener("click", () => {
        setTimeout(() => {
            updateChartsForFilteredData(filteredExpenses);
        }, 50);
    });

    // Interactive Summary Cards navigation listeners
    // Interactive Summary Cards navigation listeners
    const { role } = SpendShare.getAuth();
    const prefix = role === "admin" ? "../admin/" : "";
    const settlementPage = role === "admin" ? "settlement-history.html" : "settlement.html";
    const expensesPage = role === "admin" ? "expense-history.html" : "expenses.html";

    document.getElementById("cardTotalExpense")?.addEventListener("click", () => {
        window.location.href = `${prefix}${settlementPage}?filter=net-balance`;
    });
    document.getElementById("cardYourContribution")?.addEventListener("click", () => {
        window.location.href = `${prefix}${expensesPage}?filter=my-expenses`;
    });
    document.getElementById("cardAmountToPay")?.addEventListener("click", () => {
        window.location.href = `${prefix}${settlementPage}?filter=you-owe`;
    });
    document.getElementById("cardAmountToReceive")?.addEventListener("click", () => {
        window.location.href = `${prefix}${settlementPage}?filter=owed-to-you`;
    });
});

function initDropdownLogout() {
    const btn = document.getElementById("dropdownLogout");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("logoutBtn")?.click();
    });
}

async function loadFlatMembers() {
    try {
        const data = await SpendShare.apiFetch("/member/members");
        if (data.success) {
            flatMembers = data.members || [];
            
            const memberFilter = document.getElementById("memberFilter");
            if (memberFilter) {
                memberFilter.innerHTML = '<option value="">All Members</option>';
                flatMembers.forEach(m => {
                    memberFilter.innerHTML += `<option value="${m._id}">${escapeHtml(m.name)}</option>`;
                });
            }
        }
    } catch (error) {
        console.error("Failed to load members:", error);
    }
}

function initFilterBindings() {
    document.getElementById("categoryFilter")?.addEventListener("change", applyMonthlySummaryFilters);
    document.getElementById("memberFilter")?.addEventListener("change", applyMonthlySummaryFilters);
    document.getElementById("dateFrom")?.addEventListener("change", applyMonthlySummaryFilters);
    document.getElementById("dateTo")?.addEventListener("change", applyMonthlySummaryFilters);
}

// ======================================
// Load Available Months
// ======================================

async function loadAvailableMonths() {
    try {
        const data = await SpendShare.apiFetch("/member/monthly-summary/months");

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load months", "error");
            return;
        }

        const monthFilter = document.getElementById("monthFilter");
        monthFilter.innerHTML = "";

        data.months.forEach(month => {
            monthFilter.innerHTML += `
                <option value="${month.value}">
                    ${month.label}
                </option>
            `;
        });

        loadMonthlySummary(monthFilter.value);

        monthFilter.onchange = () => {
            loadMonthlySummary(monthFilter.value);
        };

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load months.", "error");
    }
}

// ======================================
// Load Monthly Summary
// ======================================

async function loadMonthlySummary(month, showToast = false) {
    try {
        const data = await SpendShare.apiFetch(`/member/monthly-summary?month=${month}`);

        if (!data.success) {
            SpendShare.showToast(data.message || "Failed to load report", "error");
            return;
        }

        allExpenses = data.expenses || [];
        lastMemberBalances = data.summary?.memberWiseBalance || [];
        
        // Fetch previous month for MoM comparison
        const prevMonth = SpendShare.getPreviousMonth(month);
        const prevData = await SpendShare.apiFetch(`/member/monthly-summary?month=${prevMonth}`);
        prevMonthSummary = prevData.success ? prevData.summary : null;

        // Apply filters
        applyMonthlySummaryFilters();

        if (showToast) {
            SpendShare.showToast("Data refreshed", "success", 1500);
        }

    } catch (error) {
        console.error(error);
        SpendShare.showToast("Unable to load monthly report.", "error");
    }
}

// ======================================
// Apply Filters
// ======================================

function applyMonthlySummaryFilters() {
    const category = document.getElementById("categoryFilter")?.value || "";
    const memberId = document.getElementById("memberFilter")?.value || "";
    const dateFrom = document.getElementById("dateFrom")?.value || "";
    const dateTo = document.getElementById("dateTo")?.value || "";

    filteredExpenses = [...allExpenses];

    if (category) {
        filteredExpenses = filteredExpenses.filter(e => e.category === category);
    }

    if (memberId) {
        filteredExpenses = filteredExpenses.filter(e => e.paidBy && (e.paidBy._id === memberId || e.paidBy === memberId));
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

    // Calculate user contribution and balance details
    const { memberId: currentUserId } = SpendShare.getAuth();
    let userPaidAmount = 0;
    filteredExpenses.forEach(e => {
        const paidById = e.paidBy ? (e.paidBy._id || e.paidBy) : null;
        if (paidById === currentUserId || (e.paidBy && e.paidBy.name === localStorage.getItem("memberName"))) {
            userPaidAmount += e.amount;
        }
    });

    const totalExpense = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const equalShare = flatMembers.length > 0 ? totalExpense / flatMembers.length : 0;

    // Update cards, list tables, stats and insights
    updateCards(
        { totalExpense, equalShare, memberCount: flatMembers.length },
        prevMonthSummary,
        userPaidAmount
    );

    renderMemberContributions(lastMemberBalances);
    calculateMonthlyStats(filteredExpenses);
    loadSettlements();
    displayExpenses(filteredExpenses);
    generateAIInsights(filteredExpenses);

    // Update charts based on filtered results
    updateChartsForFilteredData(filteredExpenses);
}

// ======================================
// Update Summary Cards
// ======================================

function updateCards(summary, prevSummary, userPaid) {
    if (!summary) return;
    SpendShare.animateCounter(document.getElementById("totalExpense"), summary.totalExpense || 0);
    SpendShare.animateCounter(document.getElementById("yourContribution"), userPaid || 0);
    SpendShare.animateCounter(document.getElementById("equalShare"), summary.equalShare || 0);
    SpendShare.animateCounter(document.getElementById("memberCount"), summary.memberCount || 0, "", "");

    const comparisonText = document.getElementById("comparisonText");
    if (comparisonText) {
        if (prevSummary && prevSummary.totalExpense > 0) {
            const currentTotal = summary.totalExpense || 0;
            const prevTotal = prevSummary.totalExpense;
            const percentChange = ((currentTotal - prevTotal) / prevTotal) * 100;
            const isIncrease = percentChange > 0;
            comparisonText.textContent = `${isIncrease ? "↑" : "↓"} ${Math.abs(percentChange).toFixed(1)}% vs last month`;
            comparisonText.style.color = isIncrease ? "#ef4444" : "#10b981";
        } else {
            comparisonText.textContent = "No data for previous month";
            comparisonText.style.color = "#9ca3af";
        }
    }
}

// ======================================
// Load Settlements
// ======================================

async function loadSettlements() {
    const listContainer = document.getElementById("settlementsList");
    if (!listContainer) return;

    listContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Calculating settlements...</div>`;

    try {
        const data = await SpendShare.apiFetch("/settlement");
        if (!data.success || !data.transactions || data.transactions.length === 0) {
            SpendShare.animateCounter(document.getElementById("amountToPay"), 0);
            SpendShare.animateCounter(document.getElementById("amountToReceive"), 0);
            listContainer.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--text-muted); text-align:center;">
                    <i class="fa-solid fa-circle-check" style="font-size:32px; color:#10b981;"></i>
                    <strong>All Settled Up!</strong>
                    <p style="font-size:12px; margin:0;">No pending transactions in your flat.</p>
                </div>
            `;
            return;
        }

        const pending = data.transactions.filter(t => t.status === "Pending");
        if (pending.length === 0) {
            SpendShare.animateCounter(document.getElementById("amountToPay"), 0);
            SpendShare.animateCounter(document.getElementById("amountToReceive"), 0);
            listContainer.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--text-muted); text-align:center;">
                    <i class="fa-solid fa-circle-check" style="font-size:32px; color:#10b981;"></i>
                    <strong>All Settled Up!</strong>
                    <p style="font-size:12px; margin:0;">No pending transactions in your flat.</p>
                </div>
            `;
            return;
        }

        const { memberId } = SpendShare.getAuth();
        let toPay = 0;
        let toReceive = 0;

        pending.forEach(t => {
            const fromId = t.from._id ? t.from._id.toString() : t.from.toString();
            const toId = t.to._id ? t.to._id.toString() : t.to.toString();

            if (fromId === memberId && toId !== memberId) {
                toPay += t.amount;
            }
            if (toId === memberId) {
                toReceive += t.amount;
            }
        });

        SpendShare.animateCounter(document.getElementById("amountToPay"), toPay);
        SpendShare.animateCounter(document.getElementById("amountToReceive"), toReceive);

        listContainer.innerHTML = pending.map(t => {
            const fromName = t.from ? t.from.name : "Unknown";
            const toName = t.to ? t.to.name : "Unknown";
            return `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--background); border: 1px solid var(--border-light); border-radius:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-weight:600;">${escapeHtml(fromName)}</span>
                        <i class="fa-solid fa-arrow-right" style="color:var(--text-muted); font-size:12px;"></i>
                        <span style="font-weight:600; color:var(--primary);">${escapeHtml(toName)}</span>
                    </div>
                    <strong style="color:var(--danger);">₹${Number(t.amount).toFixed(2)}</strong>
                </div>
            `;
        }).join("");

    } catch (e) {
        console.error(e);
        SpendShare.animateCounter(document.getElementById("amountToPay"), 0);
        SpendShare.animateCounter(document.getElementById("amountToReceive"), 0);
        listContainer.innerHTML = `<div style="text-align:center; color:var(--danger);">Failed to calculate settlements.</div>`;
    }
}

// ======================================
// Calculate Monthly Stats
// ======================================

function calculateMonthlyStats(expenses) {
    if (!expenses || expenses.length === 0) {
        document.getElementById("statHighest").textContent = "₹0.00";
        document.getElementById("statLowest").textContent = "₹0.00";
        document.getElementById("statAverage").textContent = "₹0.00";
        document.getElementById("statCategory").textContent = "—";
        document.getElementById("statActiveMember").textContent = "—";
        return;
    }

    let highest = -Infinity;
    let lowest = Infinity;
    let sum = 0;
    const catMap = {};
    const memberMap = {};

    expenses.forEach(e => {
        const amt = e.amount;
        if (amt > highest) highest = amt;
        if (amt < lowest) lowest = amt;
        sum += amt;

        catMap[e.category] = (catMap[e.category] || 0) + amt;
        
        const memberName = e.paidBy ? e.paidBy.name : "Unknown";
        memberMap[memberName] = (memberMap[memberName] || 0) + 1;
    });

    const avg = sum / expenses.length;

    let mostCategory = "—";
    let maxCatAmt = -1;
    for (const cat in catMap) {
        if (catMap[cat] > maxCatAmt) {
            maxCatAmt = catMap[cat];
            mostCategory = cat;
        }
    }

    let mostActive = "—";
    let maxCount = -1;
    for (const member in memberMap) {
        if (memberMap[member] > maxCount) {
            maxCount = memberMap[member];
            mostActive = member;
        }
    }

    document.getElementById("statHighest").textContent = `₹${highest.toFixed(2)}`;
    document.getElementById("statLowest").textContent = `₹${lowest.toFixed(2)}`;
    document.getElementById("statAverage").textContent = `₹${avg.toFixed(2)}`;
    document.getElementById("statCategory").textContent = mostCategory;
    document.getElementById("statActiveMember").textContent = mostActive;
}

// ======================================
// Render Member Contributions
// ======================================

function renderMemberContributions(memberBalances) {
    const tbody = document.getElementById("contributionsBody");
    const cardsContainer = document.getElementById("contributionsCards");
    if (!tbody) return;

    if (!memberBalances || memberBalances.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No members loaded</td></tr>`;
        if (cardsContainer) {
            cardsContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No members loaded</div>`;
        }
        return;
    }

    tbody.innerHTML = memberBalances.map(m => {
        const paid = m.paid || 0;
        const equalShare = m.equalShare || 0;
        const balance = m.balance || 0;
        
        let statusBadge = "";
        let statusColor = "";
        if (balance > 0.01) {
            statusBadge = `<span style="background:#e0f2fe; color:#0369a1; padding: 4px 8px; border-radius: 4px; font-weight:600; font-size:12px;">Gets Back</span>`;
            statusColor = "#0284c7";
        } else if (balance < -0.01) {
            statusBadge = `<span style="background:#fef3c7; color:#b45309; padding: 4px 8px; border-radius: 4px; font-weight:600; font-size:12px;">Needs to Pay</span>`;
            statusColor = "#d97706";
        } else {
            statusBadge = `<span style="background:#f3f4f6; color:#374151; padding: 4px 8px; border-radius: 4px; font-weight:600; font-size:12px;">Settled</span>`;
            statusColor = "inherit";
        }

        const balanceText = balance >= 0.01 
            ? `+₹${balance.toFixed(2)}` 
            : (balance <= -0.01 ? `-₹${Math.abs(balance).toFixed(2)}` : `₹0.00`);

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:30px; height:30px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">
                            ${getInitials(m.name)}
                        </div>
                        <strong>${escapeHtml(m.name)}</strong>
                    </div>
                </td>
                <td class="text-right">₹${paid.toFixed(2)}</td>
                <td class="text-right">₹${equalShare.toFixed(2)}</td>
                <td class="text-right" style="color: ${statusColor}; font-weight: 700;">${balanceText}</td>
                <td class="text-center">${statusBadge}</td>
            </tr>
        `;
    }).join("");

    if (cardsContainer) {
        cardsContainer.innerHTML = memberBalances.map(m => {
            const paid = m.paid || 0;
            const equalShare = m.equalShare || 0;
            const balance = m.balance || 0;
            
            let statusBadge = "";
            let statusColor = "";
            if (balance > 0.01) {
                statusBadge = `<span style="background:#e0f2fe; color:#0369a1; padding: 4px 8px; border-radius: 4px; font-weight:600; font-size:12px;">Gets Back</span>`;
                statusColor = "#0284c7";
            } else if (balance < -0.01) {
                statusBadge = `<span style="background:#fef3c7; color:#b45309; padding: 4px 8px; border-radius: 4px; font-weight:600; font-size:12px;">Needs to Pay</span>`;
                statusColor = "#d97706";
            } else {
                statusBadge = `<span style="background:#f3f4f6; color:#374151; padding: 4px 8px; border-radius: 4px; font-weight:600; font-size:12px;">Settled</span>`;
                statusColor = "inherit";
            }

            const balanceText = balance >= 0.01 
                ? `+₹${balance.toFixed(2)}` 
                : (balance <= -0.01 ? `-₹${Math.abs(balance).toFixed(2)}` : `₹0.00`);

            return `
                <div class="mobile-card">
                    <div class="mobile-card-row header-row">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:30px; height:30px; border-radius:50%; background:var(--primary-light); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">
                                ${getInitials(m.name)}
                            </div>
                            <span class="mobile-card-value title">${escapeHtml(m.name)}</span>
                        </div>
                        <div>${statusBadge}</div>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Total Paid</span>
                        <span class="mobile-card-value">₹${paid.toFixed(2)}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Equal Share</span>
                        <span class="mobile-card-value">₹${equalShare.toFixed(2)}</span>
                    </div>
                    <div class="mobile-card-row border-top">
                        <span class="mobile-card-label">Net Balance</span>
                        <span class="mobile-card-value amount" style="color:${statusColor};"><strong>${balanceText}</strong></span>
                    </div>
                </div>
            `;
        }).join("");
    }
}

// ======================================
// Display Monthly Expenses
// ======================================

function displayExpenses(expenses) {
    const tbody = document.getElementById("reportBody");
    const cardsContainer = document.getElementById("reportCards");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (cardsContainer) {
        cardsContainer.innerHTML = "";
    }

    if (expenses.length === 0) {
        const emptyHtml = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <i class="fa-solid fa-receipt" style="font-size: 32px; color: #d1d5db;"></i>
                        <strong>No Expenses Found</strong>
                        <p style="font-size:12px; margin:0;">No items match the active filters.</p>
                    </div>
                </td>
            </tr>
        `;
        tbody.innerHTML = emptyHtml;

        if (cardsContainer) {
            cardsContainer.innerHTML = `
                <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); border: 1px solid var(--border-light); border-radius: var(--radius-lg); background: var(--background);">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <i class="fa-solid fa-receipt" style="font-size: 32px; color: #d1d5db;"></i>
                        <strong>No Expenses Found</strong>
                        <p style="font-size:12px; margin:0;">No items match the active filters.</p>
                    </div>
                </div>
            `;
        }
        return;
    }

    expenses.forEach(expense => {
        const paidByName = expense.paidBy ? (expense.paidBy.name || "Unknown") : "Unknown";
        const hasReceipt = expense.receipt
            ? `<a href="${SpendShare.API_BASE}/uploads/${expense.receipt}" target="_blank" style="color:var(--primary); font-weight:600;"><i class="fa-solid fa-file-invoice"></i> View</a>`
            : `<span style="color:var(--text-muted);">None</span>`;

        tbody.innerHTML += `
            <tr>
                <td>${new Date(expense.expenseDate).toLocaleDateString("en-IN")}</td>
                <td><strong>${escapeHtml(expense.title)}</strong></td>
                <td>${escapeHtml(paidByName)}</td>
                <td class="text-center"><span class="badge badge-primary">${escapeHtml(expense.category)}</span></td>
                <td class="text-right" style="font-weight:700;">₹${Number(expense.amount).toFixed(2)}</td>
                <td class="text-center">${escapeHtml(expense.paymentMethod || "—")}</td>
                <td class="text-center">${hasReceipt}</td>
            </tr>
        `;
    });

    if (cardsContainer) {
        let cardsHtml = "";
        expenses.forEach(expense => {
            const paidByName = expense.paidBy ? (expense.paidBy.name || "Unknown") : "Unknown";
            const hasReceipt = expense.receipt
                ? `<a href="${SpendShare.API_BASE}/uploads/${expense.receipt}" target="_blank" style="color:var(--primary); font-weight:600;"><i class="fa-solid fa-file-invoice"></i> View</a>`
                : `<span style="color:var(--text-muted);">None</span>`;

            const options = { day: 'numeric', month: 'short', year: 'numeric' };
            const formattedDate = new Date(expense.expenseDate).toLocaleDateString("en-IN", options);

            cardsHtml += `
                <div class="mobile-card">
                    <div class="mobile-card-row header-row">
                        <span class="mobile-card-value title"><strong>${escapeHtml(expense.title)}</strong></span>
                        <span class="badge badge-primary">${escapeHtml(expense.category)}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Paid By</span>
                        <span class="mobile-card-value">${escapeHtml(paidByName)}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Payment Method</span>
                        <span class="mobile-card-value">${escapeHtml(expense.paymentMethod || "—")}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Date</span>
                        <span class="mobile-card-value">${formattedDate}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Receipt</span>
                        <span class="mobile-card-value">${hasReceipt}</span>
                    </div>
                    <div class="mobile-card-row border-top">
                        <span class="mobile-card-label">Amount</span>
                        <span class="mobile-card-value amount">₹${Number(expense.amount).toFixed(2)}</span>
                    </div>
                </div>
            `;
        });
        cardsContainer.innerHTML = cardsHtml;
    }
}

// ======================================
// Search Expenses Filter
// ======================================

function searchFilterExpenses() {
    const value = document.getElementById("searchExpense").value.toLowerCase();
    const filtered = filteredExpenses.filter(expense => {
        const paidByName = expense.paidBy ? (expense.paidBy.name || "") : "";
        return expense.title.toLowerCase().includes(value)
            || expense.category.toLowerCase().includes(value)
            || paidByName.toLowerCase().includes(value);
    });
    displayExpenses(filtered);
}

// ======================================
// Update Charts For Filtered Data
// ======================================

function updateChartsForFilteredData(expenses) {
    const ctx = document.getElementById("analyticsChart");
    if (!ctx) return;

    if (activeChart) {
        activeChart.destroy();
    }

    const theme = getThemeColors();

    if (activeTab === "trend") {
        const trendMap = {};
        expenses.forEach(e => {
            const dateStr = new Date(e.expenseDate).toLocaleDateString("en-IN");
            trendMap[dateStr] = (trendMap[dateStr] || 0) + e.amount;
        });
        
        const trendData = Object.keys(trendMap).map(date => ({
            label: date,
            amount: trendMap[date]
        }));

        activeChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: trendData.map(item => item.label),
                datasets: [{
                    label: "Total Expense",
                    data: trendData.map(item => item.amount),
                    backgroundColor: theme.primary,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: "index",
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: theme.grid
                        },
                        ticks: {
                            color: theme.text
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: theme.grid
                        },
                        ticks: {
                            color: theme.text
                        }
                    }
                }
            }
        });
    } else if (activeTab === "category") {
        const catMap = {};
        expenses.forEach(e => {
            catMap[e.category] = (catMap[e.category] || 0) + e.amount;
        });

        const categoryData = Object.keys(catMap).map(cat => ({
            category: cat,
            amount: catMap[cat]
        }));

        const total = categoryData.reduce((sum, item) => sum + item.amount, 0);

        activeChart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: categoryData.map(item => {
                    const pct = total > 0 ? ((item.amount / total) * 100).toFixed(0) : 0;
                    return `${item.category} (${pct}%)`;
                }),
                datasets: [{
                    data: categoryData.map(item => item.amount),
                    backgroundColor: theme.colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: theme.text,
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ₹${context.raw.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    } else if (activeTab === "member") {
        // Build map of contributions per member name
        const memberData = lastMemberBalances.map(m => ({
            name: m.name,
            paid: m.paid || 0
        }));

        activeChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: memberData.map(item => item.name),
                datasets: [{
                    label: "Contribution",
                    data: memberData.map(item => item.paid),
                    backgroundColor: theme.colors,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` Total Paid: ₹${context.raw.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: theme.grid
                        },
                        ticks: {
                            color: theme.text
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: theme.grid
                        },
                        ticks: {
                            color: theme.text
                        }
                    }
                }
            }
        });
    }
}

function getThemeColors() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
        text: isDark ? "#cbd5e1" : "#475569",
        grid: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
        primary: "#7c3aed",
        colors: ["#7c3aed", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"]
    };
}

// ======================================
// AI-like Insights Generator
// ======================================

function generateAIInsights(expenses) {
    const container = document.getElementById("aiInsightsContainer");
    if (!container) return;

    if (expenses.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-style:italic;">No expense data available this month to compute insights.</p>`;
        return;
    }

    const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
    const catMap = {};
    const memberMap = {};

    expenses.forEach(e => {
        catMap[e.category] = (catMap[e.category] || 0) + e.amount;
        const name = e.paidBy ? (e.paidBy.name || "Unknown") : "Unknown";
        memberMap[name] = (memberMap[name] || 0) + e.amount;
    });

    const insights = [];

    // Concentration
    let highestCat = "";
    let maxCatAmt = -1;
    for (const cat in catMap) {
        if (catMap[cat] > maxCatAmt) {
            maxCatAmt = catMap[cat];
            highestCat = cat;
        }
    }
    const catPct = totalAmount > 0 ? (maxCatAmt / totalAmount) * 100 : 0;
    insights.push(`🍔 <strong>Category Concentration:</strong> <strong>${highestCat}</strong> is your highest category, comprising <strong>${catPct.toFixed(0)}%</strong> of this month's budget (₹${maxCatAmt.toFixed(0)}).`);

    // MoM trend
    if (prevMonthSummary && prevMonthSummary.totalExpense > 0) {
        const momDiff = totalAmount - prevMonthSummary.totalExpense;
        const momPct = (momDiff / prevMonthSummary.totalExpense) * 100;
        if (momDiff > 0) {
            insights.push(`📈 <strong>MoM Trend:</strong> Total spending has increased by <strong>${momPct.toFixed(1)}%</strong> compared to last month. Consider review sessions on major bills.`);
        } else {
            insights.push(`📉 <strong>MoM Trend:</strong> Amazing! Flat spending decreased by <strong>${Math.abs(momPct).toFixed(1)}%</strong> compared to last month. Keep it up!`);
        }
    }

    // Contributor
    let highestSpender = "";
    let maxSpend = -1;
    for (const member in memberMap) {
        if (memberMap[member] > maxSpend) {
            maxSpend = memberMap[member];
            highestSpender = member;
        }
    }
    insights.push(`👑 <strong>Top Contributor:</strong> <strong>${highestSpender}</strong> contributed the most this month (₹${maxSpend.toFixed(0)}).`);

    // Savings recommendation
    if (totalAmount > 5000) {
        insights.push(`💡 <strong>Savings Recommendation:</strong> Sharing subscriptions or optimizing bulk groceries in <strong>${highestCat}</strong> could save approximately ₹${(maxCatAmt * 0.1).toFixed(0)} next month.`);
    } else {
        insights.push(`✅ <strong>Savings Recommendation:</strong> Monthly spending is well controlled. Continue tracking to maintain healthy reserves!`);
    }

    container.innerHTML = `
        <ul style="margin: 0; padding-left: 20px; display:flex; flex-direction:column; gap:8px;">
            ${insights.map(i => `<li>${i}</li>`).join("")}
        </ul>
    `;
}

// ======================================
// Exports
// ======================================

async function exportExcel() {
    if (filteredExpenses.length === 0) {
        SpendShare.showToast("No data available to export.", "warning");
        return;
    }

    const excelBtn = document.getElementById("excelBtn");
    const originalText = excelBtn.innerHTML;
    excelBtn.disabled = true;
    excelBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating Excel...`;

    try {
        const month = document.getElementById("monthFilter").selectedOptions[0]?.text || "Report";
        const wb = XLSX.utils.book_new();

        // 1. Summary sheet
        const summaryData = [
            ["SpendShare Summary Report", ""],
            ["Month", month],
            ["Generated Date", new Date().toLocaleDateString("en-IN")],
            ["", ""],
            ["Metric", "Value"],
            ["Total Monthly Expense", parseFloat(document.getElementById("totalExpense").innerText.replace(/[^\d.]/g, '')) || 0],
            ["Your Contribution", parseFloat(document.getElementById("yourContribution").innerText.replace(/[^\d.]/g, '')) || 0],
            ["Equal Share", parseFloat(document.getElementById("equalShare").innerText.replace(/[^\d.]/g, '')) || 0],
            ["Amount to Pay", parseFloat(document.getElementById("amountToPay").innerText.replace(/[^\d.]/g, '')) || 0],
            ["Amount to Receive", parseFloat(document.getElementById("amountToReceive").innerText.replace(/[^\d.]/g, '')) || 0],
            ["Total Members", parseInt(document.getElementById("memberCount").innerText) || 0]
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        // 2. Expenses sheet
        const expensesHeaders = ["Date", "Expense Title", "Paid By", "Category", "Amount", "Payment Method"];
        const expensesRows = filteredExpenses.map(e => [
            new Date(e.expenseDate).toLocaleDateString("en-IN"),
            e.title,
            e.paidBy ? (e.paidBy.name || "Unknown") : "Unknown",
            e.category,
            e.amount,
            e.paymentMethod || "—"
        ]);
        const wsExpenses = XLSX.utils.aoa_to_sheet([expensesHeaders, ...expensesRows]);
        XLSX.utils.book_append_sheet(wb, wsExpenses, "Expenses");

        // 3. Member Contributions sheet
        const totalSpent = allExpenses.reduce((s, e) => s + e.amount, 0);
        const equalShare = flatMembers.length > 0 ? totalSpent / flatMembers.length : 0;
        const memberHeaders = ["Member Name", "Total Paid", "Equal Share", "Net Balance", "Status"];
        
        const memberPaidMap = {};
        flatMembers.forEach(m => { memberPaidMap[m._id] = 0; });
        allExpenses.forEach(e => {
            const paidById = e.paidBy ? (e.paidBy._id || e.paidBy) : null;
            if (paidById) {
                const matchingMember = flatMembers.find(m => m._id === paidById || m.name === e.paidBy.name);
                if (matchingMember) {
                    memberPaidMap[matchingMember._id] = (memberPaidMap[matchingMember._id] || 0) + e.amount;
                }
            }
        });

        const memberRows = flatMembers.map(m => {
            const paid = memberPaidMap[m._id] || 0;
            const balance = paid - equalShare;
            const status = balance > 0 ? "Gets Back" : (balance < 0 ? "Needs to Pay" : "Settled");
            return [m.name, paid, equalShare, balance, status];
        });

        const wsMembers = XLSX.utils.aoa_to_sheet([memberHeaders, ...memberRows]);
        XLSX.utils.book_append_sheet(wb, wsMembers, "Member Contributions");

        // 4. Settlements sheet
        const settlementHeaders = ["From", "To", "Amount", "Status"];
        let settlementsData = [];
        try {
            const res = await SpendShare.apiFetch("/settlement");
            if (res.success && res.transactions) {
                settlementsData = res.transactions;
            }
        } catch (e) {
            console.error("Failed to load settlements for excel:", e);
        }

        const settlementRows = settlementsData.map(s => [
            s.from ? s.from.name : "Unknown",
            s.to ? s.to.name : "Unknown",
            s.amount,
            s.status
        ]);

        const wsSettlements = XLSX.utils.aoa_to_sheet([settlementHeaders, ...settlementRows]);
        XLSX.utils.book_append_sheet(wb, wsSettlements, "Settlements");

        XLSX.writeFile(wb, `SpendShare_Report_${month.replace(/\s+/g, "_")}.xlsx`);
        SpendShare.showToast("Excel workbook downloaded successfully!", "success");

    } catch (error) {
        console.error("Excel generation error:", error);
        SpendShare.showToast("Failed to generate Excel file.", "error");
    } finally {
        excelBtn.disabled = false;
        excelBtn.innerHTML = originalText;
    }
}

async function exportPDF() {
    if (filteredExpenses.length === 0) {
        SpendShare.showToast("No data available to export.", "warning");
        return;
    }

    const pdfBtn = document.getElementById("pdfBtn");
    const originalText = pdfBtn.innerHTML;
    pdfBtn.disabled = true;
    pdfBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...`;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const month = document.getElementById("monthFilter").selectedOptions[0]?.text || "Report";

        doc.setFontSize(22);
        doc.setTextColor(124, 58, 237);
        doc.text("SpendShare", 105, 18, { align: "center" });

        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text("Monthly Summary & Reports Dashboard", 105, 28, { align: "center" });

        doc.setFontSize(11);
        doc.text(`Month : ${month}`, 14, 40);
        doc.text(`Generated Date : ${new Date().toLocaleDateString("en-IN")}`, 140, 40);

        // 1. Summary metrics card table
        doc.autoTable({
            startY: 46,
            theme: "grid",
            head: [["Metric", "Value"]],
            body: [
                ["Total Monthly Expense", document.getElementById("totalExpense").innerText],
                ["Your Contribution", document.getElementById("yourContribution").innerText],
                ["Equal Share", document.getElementById("equalShare").innerText],
                ["Amount to Pay", document.getElementById("amountToPay").innerText],
                ["Amount to Receive", document.getElementById("amountToReceive").innerText],
                ["Total Members", document.getElementById("memberCount").innerText]
            ],
            headStyles: { fillColor: [124, 58, 237] }
        });

        let currentY = doc.lastAutoTable.finalY + 12;

        // 1.5. Charts image embedding
        if (trendChart && categoryChart) {
            try {
                const trendImg = trendChart.toBase64Image();
                const categoryImg = categoryChart.toBase64Image();

                doc.setFontSize(14);
                doc.setTextColor(124, 58, 237);
                doc.text("Visual Analytics", 14, currentY);

                doc.addImage(trendImg, "PNG", 14, currentY + 4, 85, 50);
                doc.addImage(categoryImg, "PNG", 110, currentY + 4, 85, 50);
            } catch (err) {
                console.error("Failed to add charts to PDF:", err);
            }
        }

        // 2. Member contributions table
        const totalSpent = allExpenses.reduce((s, e) => s + e.amount, 0);
        const equalShare = flatMembers.length > 0 ? totalSpent / flatMembers.length : 0;
        
        const memberPaidMap = {};
        flatMembers.forEach(m => { memberPaidMap[m._id] = 0; });
        allExpenses.forEach(e => {
            const paidById = e.paidBy ? (e.paidBy._id || e.paidBy) : null;
            if (paidById) {
                const matchingMember = flatMembers.find(m => m._id === paidById || m.name === e.paidBy.name);
                if (matchingMember) {
                    memberPaidMap[matchingMember._id] = (memberPaidMap[matchingMember._id] || 0) + e.amount;
                }
            }
        });

        const memberRows = flatMembers.map(m => {
            const paid = memberPaidMap[m._id] || 0;
            const balance = paid - equalShare;
            const status = balance > 0 ? "Gets Back" : (balance < 0 ? "Needs to Pay" : "Settled");
            return [
                m.name,
                "₹" + paid.toFixed(2),
                "₹" + equalShare.toFixed(2),
                (balance >= 0 ? "+" : "") + "₹" + balance.toFixed(2),
                status
            ];
        });

        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(124, 58, 237);
        doc.text("Member Contributions Breakdown", 14, 20);
        doc.autoTable({
            startY: 24,
            head: [["Member Name", "Total Paid", "Equal Share", "Net Balance", "Status"]],
            body: memberRows,
            theme: "striped",
            headStyles: { fillColor: [124, 58, 237] }
        });

        // 3. Settlements overview
        let settlementsData = [];
        try {
            const res = await SpendShare.apiFetch("/settlement");
            if (res.success && res.transactions) {
                settlementsData = res.transactions.filter(t => t.status === "Pending");
            }
        } catch (e) {
            console.error("Failed to load settlements for pdf:", e);
        }

        const settlementRows = settlementsData.map(s => [
            s.from ? s.from.name : "Unknown",
            s.to ? s.to.name : "Unknown",
            "₹" + Number(s.amount).toFixed(2),
            s.status
        ]);

        doc.setFontSize(14);
        doc.setTextColor(124, 58, 237);
        doc.text("Settlement Summary", 14, doc.lastAutoTable.finalY + 12);
        if (settlementRows.length === 0) {
            doc.setFontSize(11);
            doc.setTextColor(100, 100, 100);
            doc.text("All settled up! No pending transactions.", 14, doc.lastAutoTable.finalY + 18);
            doc.lastAutoTable.finalY = doc.lastAutoTable.finalY + 8;
        } else {
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 16,
                head: [["From", "To", "Amount Owed", "Status"]],
                body: settlementRows,
                theme: "striped",
                headStyles: { fillColor: [124, 58, 237] }
            });
        }

        // 4. Expense log table
        const expenseRows = filteredExpenses.map(expense => {
            const paidByName = expense.paidBy ? (expense.paidBy.name || "Unknown") : "Unknown";
            return [
                new Date(expense.expenseDate).toLocaleDateString("en-IN"),
                expense.title,
                paidByName,
                expense.category,
                "₹" + Number(expense.amount).toFixed(2),
                expense.paymentMethod || "—"
            ];
        });

        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(124, 58, 237);
        doc.text("Expense Transactions Log", 14, 20);
        doc.autoTable({
            startY: 24,
            head: [["Date", "Expense", "Paid By", "Category", "Amount", "Payment Method"]],
            body: expenseRows,
            theme: "striped",
            headStyles: { fillColor: [124, 58, 237] }
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${i} of ${pageCount}`, 196, doc.internal.pageSize.height - 12, { align: "right" });
            doc.text("Generated by SpendShare Dashboard", 14, doc.internal.pageSize.height - 12);
        }

        doc.save(`SpendShare_Summary_${month.replace(/\s+/g, "_")}.pdf`);
        SpendShare.showToast("PDF report downloaded successfully!", "success");

    } catch (error) {
        console.error("PDF generation error:", error);
        SpendShare.showToast("Failed to generate PDF report.", "error");
    } finally {
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = originalText;
    }
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