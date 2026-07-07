const mongoose = require("mongoose");

const settlementSchema = new mongoose.Schema({

    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    amount: {
        type: Number,
        required: true
    },

    /** Flat this settlement belongs to */
    flatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Flat",
        default: null
    },

    status: {
        type: String,
        enum: ["Pending", "Paid"],
        default: "Pending"
    },

    paidAt: {
        type: Date,
        default: null
    },

    payerMarkedPaid: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

settlementSchema.index({ flatId: 1, status: 1 });
settlementSchema.index({ flatId: 1, from: 1, to: 1 });

module.exports = mongoose.model("Settlement", settlementSchema);
