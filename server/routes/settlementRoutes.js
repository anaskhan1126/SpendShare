const express = require("express");

const router = express.Router();
const verifyAdmin = require("../middleware/authMiddleware");
const verifyMember = require("../middleware/memberAuthMiddleware");

const {
    getSettlement,
    getMemberSettlement,
    getSettlementHistory,
    markSettlementPaid,
    getAllSettlements
} = require("../controllers/settlementController");



router.get("/all", verifyAdmin, getAllSettlements);

// Admin settlement calculation
router.get("/", verifyMember, getSettlement);

// Logged-in member settlement
router.get("/member", verifyMember, getMemberSettlement);

// Settlement history
router.get("/history", verifyMember, getSettlementHistory);

// Mark settlement as paid
router.put("/:id/pay", verifyMember, markSettlementPaid);

module.exports = router;