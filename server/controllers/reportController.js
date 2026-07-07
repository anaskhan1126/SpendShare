const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const Expense = require("../models/Expense");
const User = require("../models/User");
const { mergeFlatFilter, approvedMembersQuery } = require("../utils/flatHelpers");

// ================= PDF =================

exports.exportPDF = async (req, res) => {
    try {
        const flatId = req.flatId || req.user?.flatId || null;
        const expenses = await Expense.find(mergeFlatFilter(flatId, {}))
            .populate("paidBy", "name");

        const members = await User.find(approvedMembersQuery(flatId));

        const doc = new PDFDocument();

        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=SpendShare_Report.pdf"
        );

        doc.pipe(res);

        doc.fontSize(22)
            .text("SpendShare", {
                align: "center"
            });

        doc.moveDown();

        doc.fontSize(16)
            .text("Monthly Expense Report");

        doc.moveDown();

        let totalExpense = 0;

        expenses.forEach(expense => {
            totalExpense += expense.amount;
            const payerName = expense.paidBy ? expense.paidBy.name : "Unknown";

            doc.fontSize(12).text(
                `${expense.title} - ₹${expense.amount} (${payerName})`
            );
        });

        doc.moveDown();

        doc.fontSize(14)
            .text(`Total Members : ${members.length}`);

        doc.text(`Total Expense : ₹${totalExpense}`);

        doc.end();

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Excel =================

exports.exportExcel = async (req, res) => {
    try {
        const flatId = req.flatId || req.user?.flatId || null;
        const expenses = await Expense.find(mergeFlatFilter(flatId, {}))
            .populate("paidBy", "name");

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Expenses");

        sheet.columns = [
            { header: "Title", key: "title", width: 25 },
            { header: "Category", key: "category", width: 20 },
            { header: "Amount", key: "amount", width: 15 },
            { header: "Paid By", key: "paidBy", width: 20 },
            { header: "Payment", key: "payment", width: 20 }
        ];

        expenses.forEach(expense => {
            const payerName = expense.paidBy ? expense.paidBy.name : "Unknown";

            sheet.addRow({
                title: expense.title,
                category: expense.category,
                amount: expense.amount,
                paidBy: payerName,
                payment: expense.paymentMethod
            });
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=SpendShare_Report.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};