const Expense = require("../models/Expense");
const User = require("../models/User");
const Flat = require("../models/Flat");
const calculateSettlements = require("../utils/settlementCalculator");
const {
    mergeFlatFilter,
    assertFlatAccess
} = require("../utils/flatHelpers");

// ================= Add Expense =================

exports.addExpense = async (req, res) => {
    try {
        const {
            title,
            amount,
            category,
            paidBy,
            paymentMethod,
            notes,
            expenseDate
        } = req.body;

        const payer = await User.findById(paidBy).select("flatId status");

        if (!payer) {
            return res.status(404).json({
                success: false,
                message: "Payer not found"
            });
        }

        const userFlatId = req.user?.flatId;
        if (!assertFlatAccess(res, payer.flatId, userFlatId)) return;

        const flatId = payer.flatId || userFlatId || null;
        let groupName = "Flat Members";

        if (flatId) {
            const flat = await Flat.findById(flatId).select("name");
            if (flat) groupName = flat.name;
        }

        const receipt = req.file ? req.file.filename : undefined;

        const expense = await Expense.create({
            title,
            amount: Number(amount),
            category,
            paidBy,
            flatId,
            group: groupName,
            paymentMethod,
            notes,
            expenseDate,
            receipt
        });

        await calculateSettlements(flatId);

        res.status(201).json({
            success: true,
            message: "Expense Added Successfully",
            expense
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Get All Expenses =================

exports.getExpenses = async (req, res) => {
    try {
        const flatId = req.flatId || req.user?.flatId || null;

        const expenses = await Expense.find(mergeFlatFilter(flatId, {}))
            .populate("paidBy", "name email")
            .sort({ expenseDate: -1 });

        res.json({
            success: true,
            expenses
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Get Logged-in Member Expenses =================

exports.getMyExpenses = async (req, res) => {
    try {
        const { memberId } = req.params;
        const flatId = req.user?.flatId || null;
        const loggedInUserId = req.user?.id || req.user?._id;

        if (memberId !== loggedInUserId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only view your own expenses"
            });
        }

        const { month } = req.query;

        const query = mergeFlatFilter(flatId, {
            paidBy: memberId
        });

        if (month) {
            const [year, mon] = month.split("-");
            const startDate = new Date(year, mon - 1, 1);
            const endDate = new Date(year, mon, 1);

            query.expenseDate = {
                $gte: startDate,
                $lt: endDate
            };
        }

        const expenses = await Expense.find(query)
            .populate("paidBy", "name")
            .sort({ expenseDate: -1 });

        res.status(200).json({
            success: true,
            expenses
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Get Single Expense =================

exports.getExpenseById = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id)
            .populate("paidBy", "name email");

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense Not Found"
            });
        }

        const userFlatId = req.user?.flatId;
        if (!assertFlatAccess(res, expense.flatId, userFlatId)) return;

        res.json({
            success: true,
            expense
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Update Expense =================

exports.updateExpense = async (req, res) => {
    try {
        const existing = await Expense.findById(req.params.id);

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Expense Not Found"
            });
        }

        const userFlatId = req.user?.flatId;
        if (!assertFlatAccess(res, existing.flatId, userFlatId)) return;

        const expense = await Expense.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        await calculateSettlements(existing.flatId || userFlatId || null);

        res.json({
            success: true,
            message: "Expense Updated",
            expense
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
