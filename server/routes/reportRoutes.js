const express = require("express");

const router = express.Router();
const attachFlatUser = require("../middleware/attachFlatUser");

const {

    exportPDF,
    exportExcel

} = require("../controllers/reportController");

// Export PDF
router.get("/pdf", attachFlatUser, exportPDF);

// Export Excel
router.get("/excel", attachFlatUser, exportExcel);

module.exports = router;