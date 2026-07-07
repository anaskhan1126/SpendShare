const express = require("express");
const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");
const {
    validateFlatCode,
    createFlatWithAdmin,
    getMyFlat,
    updateMyFlat
} = require("../controllers/flatController");

// Public
router.get("/validate/:code", validateFlatCode);

// Create flat + admin (public signup)
router.post("/create", createFlatWithAdmin);

// Admin — flat info
router.get("/my", verifyAdmin, getMyFlat);
router.put("/my", verifyAdmin, updateMyFlat);

module.exports = router;
