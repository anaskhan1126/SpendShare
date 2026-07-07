const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        amount: {
            type: Number,
            required: true
        },

        category: {
            type: String,
            required: true
        },

        paidBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        /** Flat this expense belongs to */
        flatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Flat",
            default: null
        },

        /** @deprecated Use flatId — kept for backward compatibility during migration */
        group: {
            type: String,
            default: "Flat Members"
        },

        paymentMethod: {
            type: String,
            default: "Cash"
        },

        notes: {
            type: String
        },

        receipt: {
            type: String
        },

        expenseDate: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true
    }
);

expenseSchema.index({ flatId: 1, expenseDate: -1 });
expenseSchema.index({ flatId: 1, paidBy: 1 });

module.exports = mongoose.model("Expense", expenseSchema);
