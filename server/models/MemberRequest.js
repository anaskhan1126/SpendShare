const mongoose = require("mongoose");

const memberRequestSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    username: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },

    phone: {
        type: String,
        required: true,
        trim: true
    },

    password: {
        type: String,
        required: true
    },

    /** Flat the member wants to join */
    flatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Flat",
        default: null
    },

    /** Join code entered at signup (e.g. SPD8X4Q) */
    flatCode: {
        type: String,
        uppercase: true,
        trim: true,
        default: ""
    },

    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    },

    requestedAt: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

memberRequestSchema.index({ flatId: 1, status: 1 });
memberRequestSchema.index({ flatId: 1, email: 1 });

module.exports = mongoose.model("MemberRequest", memberRequestSchema);
