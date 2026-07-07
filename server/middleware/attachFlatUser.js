const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Authenticate user (admin or member) and attach flatId to req.flatId.
 * Used for endpoints shared by both roles (e.g. expense list).
 */
const attachFlatUser = async (req, res, next) => {
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
        const user = await User.findById(decoded.id).select("-password");

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

        if (user.status === "pending") {
            return res.status(403).json({
                success: false,
                code: "PENDING_APPROVAL",
                message: "Your request is waiting for admin approval."
            });
        }

        if (user.status === "rejected" || user.status !== "approved") {
            return res.status(403).json({
                success: false,
                message: "Your account is not approved."
            });
        }

        // Attach properties
        req.user = user;
        req.admin = user; // Backward compatibility
        req.member = user; // Backward compatibility
        req.flatId = user.flatId || null;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid Token"
        });
    }
};

module.exports = attachFlatUser;
