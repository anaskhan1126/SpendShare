const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },

        phone: {
            type: String,
            unique: true,
            sparse: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["member", "admin"],
            default: "member"
        },

        flatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Flat",
            default: null
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "suspended"],
            default: "approved"
        },

        group: {
            type: String,
            default: "Flat Members"
        }
    },
    {
        timestamps: true
    }
);

userSchema.index({ flatId: 1, email: 1 }, { unique: true, partialFilterExpression: { flatId: { $type: "objectId" } } });
userSchema.index({ flatId: 1, username: 1 }, { unique: true, partialFilterExpression: { flatId: { $type: "objectId" } } });
userSchema.index({ flatId: 1, status: 1 });

module.exports = mongoose.model("User", userSchema, "members");
