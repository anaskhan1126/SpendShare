// console.log("Admin Routes Loaded");
const express = require("express");

const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    adminLogin,
    adminRegister,
    addMember,
    getAllMembers,
    updateMember,
    deleteMember,
    getDashboard,
     getMemberRequests,
    approveMemberRequest,
    rejectMemberRequest,
     getMonthlySummary,
    getAvailableMonths,
     getAdminProfile,
    changePassword
} = require("../controllers/adminController");

// ===============================
// Admin Authentication
// ===============================
router.post("/register", adminRegister);
// Admin Login
 router.post("/login", adminLogin);

// ===============================
// Dashboard
// ===============================

// Remove verifyAdmin temporarily for testing
router.get("/dashboard", verifyAdmin, getDashboard);

// ===============================
// Member Management
// ===============================

// Keep verification for write operations
router.post("/add-member", verifyAdmin, addMember);

// Remove verifyAdmin temporarily for testing
router.get("/members", verifyAdmin, getAllMembers);

// Keep verification for write operations
router.put("/member/:id", verifyAdmin, updateMember);

router.delete("/member/:id", verifyAdmin, deleteMember);
router.get(
    "/monthly-summary",
    verifyAdmin,
    getMonthlySummary
);

router.get(
    "/monthly-summary/months",
    verifyAdmin,
    getAvailableMonths
);

router.get(
    "/member-requests",
    verifyAdmin,
    getMemberRequests
);

router.put(
    "/member-request/:id/approve",
    verifyAdmin,
    approveMemberRequest
);

router.delete(
    "/member-request/:id/reject",
    verifyAdmin,
    rejectMemberRequest
);
router.get(
    "/profile/:adminId",
    verifyAdmin,
    getAdminProfile
);
router.put(
    "/profile/:adminId/password",
    verifyAdmin,
    changePassword
);
module.exports = router;