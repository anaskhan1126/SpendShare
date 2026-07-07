const Expense = require("../models/Expense");
const Member = require("../models/Member"); // Resolves to User
const { mergeFlatFilter, approvedMembersQuery } = require("./flatHelpers");
const calculateFlatBalances = require("./balanceCalculator");

const fetchMonthlySummaryData = async (flatId, month) => {
    let startDate;
    let endDate;

    if (month) {
        const [year, mon] = month.split("-").map(Number);
        startDate = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(year, mon, 1, 0, 0, 0, 0));
    } else {
        const today = new Date();
        const year = today.getFullYear();
        const mon = today.getMonth() + 1;
        startDate = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(year, mon, 1, 0, 0, 0, 0));
    }

    const expenseQuery = mergeFlatFilter(flatId, {
        amount: { $gt: 0 },
        expenseDate: {
            $gte: startDate,
            $lt: endDate
        }
    });

    const expenses = await Expense.find(expenseQuery)
        .populate("paidBy", "name")
        .sort({ expenseDate: -1 });

    // Filter out expenses with invalid/deleted/orphaned users
    const validExpenses = expenses.filter(e => e.paidBy);

    const members = await Member.find(approvedMembersQuery(flatId));

    const totalExpense = validExpenses.reduce((sum, item) => sum + item.amount, 0);
    const totalMembers = members.length;
    const averageExpense = totalMembers ? totalExpense / totalMembers : 0;
    const equalShare = averageExpense;

    const highestExpense = validExpenses.length ? Math.max(...validExpenses.map(e => e.amount)) : 0;
    const lowestExpense = validExpenses.length ? Math.min(...validExpenses.map(e => e.amount)) : 0;

    const categoryMap = {};
    validExpenses.forEach(item => {
        categoryMap[item.category] = (categoryMap[item.category] || 0) + item.amount;
    });

    const categoryWiseExpenses = Object.keys(categoryMap).map(key => ({
        category: key,
        amount: Number(categoryMap[key].toFixed(2))
    }));

    const report = validExpenses.map(item => {
        const paidByName = item.paidBy.name;
        return {
            date: item.expenseDate,
            title: item.title,
            paidBy: paidByName,
            category: item.category,
            amount: item.amount,
            share: Number((item.amount / (totalMembers || 1)).toFixed(2)),
            balance: Number((item.amount - (item.amount / (totalMembers || 1))).toFixed(2))
        };
    });

    const trendMap = {};
    validExpenses.forEach(expense => {
        const date = new Date(expense.expenseDate).toLocaleDateString("en-IN");
        if (!trendMap[date]) {
            trendMap[date] = {
                label: date,
                amount: 0,
                members: []
            };
        }
        trendMap[date].amount = Number((trendMap[date].amount + expense.amount).toFixed(2));
        trendMap[date].members.push({
            name: expense.paidBy.name,
            amount: expense.amount
        });
    });

    // Member aggregation & balance calculations using central balance service
    const balances = await calculateFlatBalances(flatId, month);

    const memberWiseContributions = balances.members.map(m => ({
        memberId: m.memberId,
        name: m.name,
        amount: m.totalPaid
    }));

    const memberWiseBalance = balances.members.map(m => ({
        memberId: m.memberId,
        name: m.name,
        paid: m.totalPaid,
        equalShare: balances.equalShare,
        balance: m.outstandingBalance,
        status: m.status
    }));

    // Settlements calculations
    const Settlement = require("../models/Settlement");
    
    const pendingFilter = mergeFlatFilter(flatId, {
        status: "Pending",
        amount: { $gt: 0 }
    });

    const completedFilter = mergeFlatFilter(flatId, {
        status: "Paid",
        amount: { $gt: 0 },
        paidAt: {
            $gte: startDate,
            $lt: endDate
        }
    });

    const pendingSettlementsRaw = await Settlement.find(pendingFilter)
        .populate("from", "name")
        .populate("to", "name");

    const completedSettlementsRaw = await Settlement.find(completedFilter)
        .populate("from", "name")
        .populate("to", "name");

    // Deduplicate pending
    const seenPending = new Set();
    const pendingSettlements = pendingSettlementsRaw.filter(s => {
        if (!s.from || !s.to) return false;
        const fromId = s.from._id ? s.from._id.toString() : s.from.toString();
        const toId = s.to._id ? s.to._id.toString() : s.to.toString();
        if (fromId === toId) return false;
        const pairKey = `${fromId}_${toId}`;
        if (seenPending.has(pairKey)) return false;
        seenPending.add(pairKey);
        return true;
    }).map(s => ({
        _id: s._id,
        from: s.from.name,
        to: s.to.name,
        amount: s.amount,
        status: s.status
    }));

    const completedSettlements = completedSettlementsRaw.filter(s => {
        if (!s.from || !s.to) return false;
        const fromId = s.from._id ? s.from._id.toString() : s.from.toString();
        const toId = s.to._id ? s.to._id.toString() : s.to.toString();
        return fromId !== toId;
    }).map(s => ({
        _id: s._id,
        from: s.from.name,
        to: s.to.name,
        amount: s.amount,
        status: s.status,
        paidAt: s.paidAt
    }));

    const summary = {
        totalExpense: Number(totalExpense.toFixed(2)),
        totalMembers,
        memberCount: totalMembers,
        totalAmountPaid: Number(totalExpense.toFixed(2)),
        averageExpense: Number(averageExpense.toFixed(2)),
        equalShare: Number(equalShare.toFixed(2)),
        highestExpense: Number(highestExpense.toFixed(2)),
        lowestExpense: Number(lowestExpense.toFixed(2)),
        expenseCount: validExpenses.length,
        categoryWiseExpenses,
        monthlyExpenseTrend: Object.values(trendMap),
        memberWiseContributions,
        memberWiseBalance,
        pendingSettlements,
        completedSettlements
    };

    return {
        summary,
        expenses: validExpenses,
        report,
        categories: categoryWiseExpenses,
        trend: Object.values(trendMap)
    };
};

const fetchAvailableMonthsData = async (flatId) => {
    // Only include valid, non-zero expenses for flat
    const expenses = await Expense.find(mergeFlatFilter(flatId, {
        amount: { $gt: 0 }
    }))
    .populate("paidBy", "name")
    .sort({ expenseDate: -1 });

    const monthMap = {};
    expenses.forEach(expense => {
        if (!expense.paidBy || !expense.expenseDate) return;
        const date = new Date(expense.expenseDate);
        if (isNaN(date.getTime())) return;
        
        const year = date.getUTCFullYear();
        const mon = String(date.getUTCMonth() + 1).padStart(2, "0");
        const value = `${year}-${mon}`;

        if (!monthMap[value]) {
            monthMap[value] = date.toLocaleString("default", {
                month: "long",
                year: "numeric",
                timeZone: "UTC"
            });
        }
    });

    return Object.keys(monthMap).map(key => ({
        value: key,
        label: monthMap[key]
    }));
};

module.exports = {
    fetchMonthlySummaryData,
    fetchAvailableMonthsData
};
