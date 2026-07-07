const express = require("express");
const router = express.Router();

const verifyMember = require("../middleware/memberAuthMiddleware");

const {
    memberLogin,
    getMemberProfile,
    changePassword,
    getExpenseChart,
     registerRequest,
     getMonthlySummary,
     getAvailableMonths,
        getMembers 
} = require("../controllers/memberController");

router.post("/register-request", registerRequest);
// Authentication
router.post("/login", memberLogin);

// Profile
router.get("/profile/:memberId", verifyMember, getMemberProfile);
router.put("/change-password/:memberId", verifyMember, changePassword);

// Dashboard
router.get("/expense-chart", verifyMember, getExpenseChart);
router.get(
    "/monthly-summary",
    verifyMember,
    getMonthlySummary
);
// ================= Available Months =================
router.get(
    "/monthly-summary/months",
    verifyMember,
    getAvailableMonths
);

router.get(
    "/members",
    verifyMember,
    getMembers
);
module.exports = router;