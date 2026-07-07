const express = require("express");

const router = express.Router();

const upload = require("../config/upload");
const verifyMember = require("../middleware/memberAuthMiddleware");
const attachFlatUser = require("../middleware/attachFlatUser");

const {

    addExpense,

    getExpenses,

    getMyExpenses,

    getExpenseById,

    updateExpense

} = require("../controllers/expenseController");

// Add Expense (supports optional receipt file)
router.post("/add", verifyMember, (req, res, next) => {
    upload.single("receipt")(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
        next();
    });
}, addExpense);

// Get All Expenses (admin or member — flat-scoped)
router.get("/", attachFlatUser, getExpenses);

// Get Logged-in Member Expenses
router.get("/member/:memberId", verifyMember, getMyExpenses);

// Get Single Expense
router.get("/:id", attachFlatUser, getExpenseById);

// Update Expense
router.put("/:id", attachFlatUser, updateExpense);

module.exports = router;
