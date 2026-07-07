const express = require("express");

const router = express.Router();

const {

    getMonthlySummary

} = require("../controllers/summaryController");

// Monthly Summary
router.get("/", getMonthlySummary);

module.exports = router;