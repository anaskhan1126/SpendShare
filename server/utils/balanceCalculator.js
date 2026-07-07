const Expense = require("../models/Expense");
const Member = require("../models/Member"); // Resolves to User
const Settlement = require("../models/Settlement");
const { mergeFlatFilter, approvedMembersQuery } = require("./flatHelpers");

const calculateFlatBalances = async (flatId, month = null) => {
    let dateFilter = {};
    let settlementDateFilter = {};
    
    if (month) {
        const [year, mon] = month.split("-").map(Number);
        const startDate = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(year, mon, 1, 0, 0, 0, 0));
        dateFilter = {
            expenseDate: {
                $gte: startDate,
                $lt: endDate
            }
        };
        settlementDateFilter = {
            paidAt: {
                $gte: startDate,
                $lt: endDate
            }
        };
    }

    const expenseQuery = mergeFlatFilter(flatId, {
        amount: { $gt: 0 },
        ...dateFilter
    });

    const members = await Member.find(approvedMembersQuery(flatId));
    const expenses = await Expense.find(expenseQuery).populate("paidBy", "name");
    
    // Scopes paid settlements: status = "Paid"
    const settlementQuery = mergeFlatFilter(flatId, {
        status: "Paid",
        amount: { $gt: 0 },
        ...settlementDateFilter
    });
    
    const paidSettlements = await Settlement.find(settlementQuery)
        .populate("from", "name")
        .populate("to", "name");

    const totalExpense = expenses.filter(e => e.paidBy).reduce((sum, item) => sum + item.amount, 0);
    const equalShare = members.length ? totalExpense / members.length : 0;

    const memberMap = {};
    members.forEach(m => {
        memberMap[m._id.toString()] = {
            memberId: m._id,
            name: m.name,
            totalPaid: 0,
            completedOutgoing: 0,
            completedIncoming: 0
        };
    });

    // Populate totalPaid from expenses
    expenses.forEach(e => {
        if (!e.paidBy) return;
        const payerId = e.paidBy._id ? e.paidBy._id.toString() : e.paidBy.toString();
        if (memberMap[payerId]) {
            memberMap[payerId].totalPaid += e.amount;
        }
    });

    // Populate completedOutgoing and completedIncoming from paid settlements
    paidSettlements.forEach(s => {
        if (!s.from || !s.to) return;
        const fromId = s.from._id ? s.from._id.toString() : s.from.toString();
        const toId = s.to._id ? s.to._id.toString() : s.to.toString();

        if (memberMap[fromId]) {
            memberMap[fromId].completedOutgoing += s.amount;
        }
        if (memberMap[toId]) {
            memberMap[toId].completedIncoming += s.amount;
        }
    });

    const calculatedMembers = members.map(m => {
        const idStr = m._id.toString();
        const data = memberMap[idStr];
        
        const outstandingBalance = (data.totalPaid + data.completedOutgoing) - (equalShare + data.completedIncoming);
        
        let status = "Settled";
        if (outstandingBalance > 0.01) {
            status = "Gets Back";
        } else if (outstandingBalance < -0.01) {
            status = "Needs to Pay";
        }

        return {
            memberId: m._id,
            name: m.name,
            totalPaid: Number(data.totalPaid.toFixed(2)),
            completedOutgoing: Number(data.completedOutgoing.toFixed(2)),
            completedIncoming: Number(data.completedIncoming.toFixed(2)),
            outstandingBalance: Number(outstandingBalance.toFixed(2)),
            status
        };
    });

    return {
        totalExpense: Number(totalExpense.toFixed(2)),
        equalShare: Number(equalShare.toFixed(2)),
        members: calculatedMembers
    };
};

module.exports = calculateFlatBalances;
