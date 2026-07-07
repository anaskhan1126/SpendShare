const Expense = require("../models/Expense");
const Member = require("../models/Member"); // Resolves to User
const Settlement = require("../models/Settlement");
const { buildFlatFilter, approvedMembersQuery } = require("./flatHelpers");
const calculateFlatBalances = require("./balanceCalculator");

const calculateSettlements = async (flatId = null) => {
    const expenseQuery = buildFlatFilter(flatId);
    const memberQuery = approvedMembersQuery(flatId);

    const members = await Member.find(memberQuery);
    if (members.length === 0) return;

    const balances = await calculateFlatBalances(flatId);

    const creditors = [];
    const debtors = [];

    balances.members.forEach(item => {
        const memberDoc = members.find(m => m._id.toString() === item.memberId.toString());
        if (!memberDoc) return;

        if (item.outstandingBalance > 0.01) {
            creditors.push({
                member: memberDoc,
                amount: item.outstandingBalance
            });
        } else if (item.outstandingBalance < -0.01) {
            debtors.push({
                member: memberDoc,
                amount: Math.abs(item.outstandingBalance)
            });
        }
    });

    const activePairs = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
        const payAmount = Math.min(
            debtors[i].amount,
            creditors[j].amount
        );

        const from = debtors[i].member._id;
        const to = creditors[j].member._id;

        const fromStr = from ? from.toString() : "";
        const toStr = to ? to.toString() : "";

        // Backend Validation: Ignore amount <= 0, self-payments, or missing/invalid members
        if (payAmount <= 0.01 || !fromStr || !toStr || fromStr === toStr) {
            debtors[i].amount -= payAmount;
            creditors[j].amount -= payAmount;
            if (debtors[i].amount <= 0.01) i++;
            if (creditors[j].amount <= 0.01) j++;
            continue;
        }

        // Validate payer and receiver IDs exist in flat approved members list
        const fromMember = members.find(m => m._id.toString() === fromStr);
        const toMember = members.find(m => m._id.toString() === toStr);
        if (!fromMember || !toMember) {
            debtors[i].amount -= payAmount;
            creditors[j].amount -= payAmount;
            if (debtors[i].amount <= 0.01) i++;
            if (creditors[j].amount <= 0.01) j++;
            continue;
        }

        // Aggregate matching pairs if any duplicates arise
        const existingPair = activePairs.find(p => p.from === fromStr && p.to === toStr);
        if (existingPair) {
            existingPair.amount = Number((existingPair.amount + payAmount).toFixed(2));
        } else {
            activePairs.push({
                from: fromStr,
                to: toStr,
                amount: Number(payAmount.toFixed(2))
            });
        }

        debtors[i].amount -= payAmount;
        creditors[j].amount -= payAmount;

        if (debtors[i].amount <= 0.01) i++;
        if (creditors[j].amount <= 0.01) j++;
    }

    // Upsert unique calculated active pairs
    for (const pair of activePairs) {
        const from = pair.from;
        const to = pair.to;
        const amount = pair.amount;

        const settlementFilter = flatId
            ? { flatId, from, to, status: "Pending" }
            : { from, to, status: "Pending", flatId: null };

        await Settlement.findOneAndUpdate(
            settlementFilter,
            {
                $set: {
                    amount: amount
                },
                $setOnInsert: {
                    status: "Pending",
                    flatId: flatId || null
                }
            },
            {
                upsert: true,
                new: true
            }
        );
    }

    const settlementQuery = flatId
        ? { flatId }
        : { $or: [{ flatId: null }, { flatId: { $exists: false } }] };

    const settlements = await Settlement.find(settlementQuery);
    const processedPendingKeys = new Set();

    for (const settlement of settlements) {
        if (!settlement.from || !settlement.to) {
            // Clean up orphaned settlements
            await Settlement.findByIdAndDelete(settlement._id);
            continue;
        }

        const fromStr = settlement.from.toString();
        const toStr = settlement.to.toString();
        const pairKey = `${fromStr}_${toStr}`;

        if (settlement.status === "Pending") {
            const exists = activePairs.some(pair =>
                pair.from === fromStr &&
                pair.to === toStr
            );

            // Prune duplicate or stale pending settlements
            if (!exists || processedPendingKeys.has(pairKey)) {
                await Settlement.findByIdAndDelete(settlement._id);
            } else {
                processedPendingKeys.add(pairKey);
            }
        } else if (settlement.status === "Paid") {
            // Prune invalid paid settlements with <= 0 amounts
            if (settlement.amount <= 0) {
                await Settlement.findByIdAndDelete(settlement._id);
            }
        }
    }
};

module.exports = calculateSettlements;
