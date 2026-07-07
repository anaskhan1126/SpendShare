const { fetchMonthlySummaryData } = require("../utils/summaryHelpers");

exports.getMonthlySummary = async (req, res) => {
    try {
        const flatId = req.user?.flatId || req.admin?.flatId || null;
        const month = req.query.month;

        const data = await fetchMonthlySummaryData(flatId, month);
        res.status(200).json({
            success: true,
            ...data
        });
    } catch (error) {
        console.error("Summary Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};