const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Access Denied"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        let user = await User.findById(decoded.id).select("-password");

        if (!user) {
            const mongoose = require("mongoose");
            const LegacyAdmin = mongoose.models.LegacyAdmin || mongoose.model("LegacyAdmin", new mongoose.Schema({}, { strict: false }), "admins");
            const legacyAdmin = await LegacyAdmin.findById(decoded.id);
            if (legacyAdmin) {
                user = await User.create({
                    _id: legacyAdmin._id,
                    name: legacyAdmin.name || "Admin",
                    username: legacyAdmin.username || legacyAdmin.email.split("@")[0],
                    email: legacyAdmin.email,
                    phone: legacyAdmin.phone,
                    password: legacyAdmin.password,
                    role: "admin",
                    status: "approved",
                    flatId: legacyAdmin.flatId || null
                });
                user.password = undefined;
            }
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Account not found"
            });
        }

        if (user.status === "suspended") {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended."
            });
        }

        if (user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required. Please login as administrator."
            });
        }

        // Attach properties
        req.user = user;
        req.admin = user; // Backward compatibility
        req.flatId = user.flatId || null;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid Token"
        });
    }
};

module.exports = verifyAdmin;
