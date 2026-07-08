const Expense = require("../models/Expense");
const calculateSettlements = require("../utils/settlementCalculator");
const User = require("../models/User");
const Settlement = require("../models/Settlement");
const {
    mergeFlatFilter,
    assertFlatAccess,
    approvedMembersQuery
} = require("../utils/flatHelpers");

function memberSettlementFilter(memberId, flatId) {
    const base = {
        $or: [
            { from: memberId },
            { to: memberId }
        ]
    };
    return mergeFlatFilter(flatId, base);
}

// =====================================
// Admin Settlement
// =====================================

exports.getSettlement = async (req, res) => {
    try {
        const flatId = req.user?.flatId || null;

        await calculateSettlements(flatId);

        const settlements = await Settlement.find(mergeFlatFilter(flatId, {}))
            .populate("from", "name")
            .populate("to", "name")
            .sort({ createdAt: -1 });

        // Backend Validation: Ignore amount <= 0, self-payments, and duplicate pending pairs
        const seenPending = new Set();
        const filteredTransactions = settlements.filter(s => {
            if (!s.from || !s.to || !s.amount || s.amount <= 0) return false;
            const fromId = s.from._id ? s.from._id.toString() : s.from.toString();
            const toId = s.to._id ? s.to._id.toString() : s.to.toString();
            if (fromId === toId) return false;

            if (s.status === "Pending") {
                const pairKey = `${fromId}_${toId}`;
                if (seenPending.has(pairKey)) return false;
                seenPending.add(pairKey);
            }
            return true;
        });

        let totalOwe = 0;
        let totalReceive = 0;

        filteredTransactions.forEach(item => {
            if (item.status === "Pending") {
                totalOwe += item.amount;
            } else {
                totalReceive += item.amount;
            }
        });

        const history = filteredTransactions.filter(
            item => item.status === "Paid"
        );

        res.status(200).json({
            success: true,
            summary: {
                totalOwe: Number(totalOwe.toFixed(2)),
                totalReceive: Number(totalReceive.toFixed(2)),
                netBalance: Number((totalReceive - totalOwe).toFixed(2))
            },
            transactions: filteredTransactions,
            history
        });

    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =====================================
// Member Settlement
// =====================================

exports.getMemberSettlement = async (req, res) => {
    try {
        const flatId = req.user?.flatId || null;
        const userId = req.user?.id || req.user?._id;

        await calculateSettlements(flatId);

        const settlements = await Settlement.find(
            memberSettlementFilter(userId, flatId)
        )
            .populate("from", "name")
            .populate("to", "name")
            .sort({ createdAt: -1 });

        // Backend Validation: Ignore amount <= 0, self-payments, and duplicate pending pairs
        const seenPending = new Set();
        const filteredTransactions = settlements.filter(s => {
            if (!s.from || !s.to || !s.amount || s.amount <= 0) return false;
            const fromId = s.from._id ? s.from._id.toString() : s.from.toString();
            const toId = s.to._id ? s.to._id.toString() : s.to.toString();
            if (fromId === toId) return false;

            if (s.status === "Pending") {
                const pairKey = `${fromId}_${toId}`;
                if (seenPending.has(pairKey)) return false;
                seenPending.add(pairKey);
            }
            return true;
        });

        let totalOwe = 0;
        let totalReceive = 0;

        filteredTransactions.forEach(item => {
            if (item.status !== "Pending") {
                return;
            }

            if (item.from && item.from._id.toString() === userId.toString()) {
                totalOwe += item.amount;
            }

            if (item.to && item.to._id.toString() === userId.toString()) {
                totalReceive += item.amount;
            }
        });

        totalOwe = Number(totalOwe.toFixed(2));
        totalReceive = Number(totalReceive.toFixed(2));

        const netBalance = Number((totalReceive - totalOwe).toFixed(2));
        const history = filteredTransactions.filter(
            item => item.status === "Paid"
        );

        res.status(200).json({
            success: true,
            summary: {
                totalOwe,
                totalReceive,
                netBalance
            },
            transactions: filteredTransactions,
            history
        });

    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =====================================
// Settlement History
// =====================================

exports.getSettlementHistory = async (req, res) => {
    try {
        const flatId = req.user?.flatId || null;
        const userId = req.user?.id || req.user?._id;

        const history = await Settlement.find(
            memberSettlementFilter(userId, flatId)
        )
            .populate("from", "name")
            .populate("to", "name")
            .sort({ paidAt: -1 });

        // Backend Validation: Ignore amount <= 0 and self-payments
        const filteredHistory = history.filter(s => {
            if (!s.from || !s.to || !s.amount || s.amount <= 0) return false;
            const fromId = s.from._id ? s.from._id.toString() : s.from.toString();
            const toId = s.to._id ? s.to._id.toString() : s.to.toString();
            return fromId !== toId;
        });

        res.status(200).json({
            success: true,
            history: filteredHistory
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =====================================
// Mark Settlement Paid
// =====================================

exports.markSettlementPaid = async (req, res) => {
    try {
        const flatId = req.user?.flatId || null;
        const userId = req.user?.id || req.user?._id;

        const settlement = await Settlement.findOne({
            _id: req.params.id,
            ...mergeFlatFilter(flatId, {})
        });

        if (!settlement) {
            return res.status(404).json({
                success: false,
                message: "Settlement not found."
            });
        }

        if (settlement.status === "Paid") {
            return res.status(200).json({
                success: true,
                message: "Settlement already marked as Paid."
            });
        }

        const isReceiver = settlement.to.toString() === userId.toString();

        if (!isReceiver) {
            return res.status(403).json({
                success: false,
                message: "Only the receiver can confirm this settlement."
            });
        }

        settlement.status = "Paid";
        settlement.paidAt = new Date();
        settlement.payerMarkedPaid = true;
        await settlement.save();

        return res.status(200).json({
            success: true,
            message: "Payment confirmed successfully."
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =====================================
// Admin - Get All Settlements
// =====================================

exports.getAllSettlements = async (req, res) => {
    try {
        const flatId = req.user?.flatId || req.admin?.flatId || null;

        await calculateSettlements(flatId);

        const settlements = await Settlement.find(mergeFlatFilter(flatId, {}))
            .populate("from", "name")
            .populate("to", "name")
            .sort({ status: 1, createdAt: -1 });

        // Backend Validation: Ignore amount <= 0, self-payments, and duplicate pending pairs
        const seenPending = new Set();
        const filteredSettlements = settlements.filter(s => {
            if (!s.from || !s.to || !s.amount || s.amount <= 0) return false;
            const fromId = s.from._id ? s.from._id.toString() : s.from.toString();
            const toId = s.to._id ? s.to._id.toString() : s.to.toString();
            if (fromId === toId) return false;

            if (s.status === "Pending") {
                const pairKey = `${fromId}_${toId}`;
                if (seenPending.has(pairKey)) return false;
                seenPending.add(pairKey);
            }
            return true;
        });

        res.status(200).json({
            success: true,
            count: filteredSettlements.length,
            settlements: filteredSettlements
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
