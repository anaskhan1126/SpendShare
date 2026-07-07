const mongoose = require("mongoose");

/**
 * Flat — top-level tenant in SpendShare.
 * Each flat has exactly one admin and its own members, expenses, and settlements.
 */
const flatSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Flat name is required"],
            trim: true,
            maxlength: 100
        },

        flatCode: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
            minlength: 6,
            maxlength: 10
        },

        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        address: {
            type: String,
            trim: true,
            default: ""
        },

        status: {
            type: String,
            enum: ["active", "inactive", "suspended"],
            default: "active"
        }
    },
    {
        timestamps: true
    }
);

flatSchema.index({ adminId: 1 }, { unique: true });
flatSchema.index({ status: 1 });

module.exports = mongoose.model("Flat", flatSchema);
