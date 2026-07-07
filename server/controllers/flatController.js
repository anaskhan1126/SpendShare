const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Flat = require("../models/Flat");
const User = require("../models/User");
const { generateUniqueFlatCode } = require("../utils/flatCodeGenerator");
const {
    normalizeFlatCode,
    isValidFlatCodeFormat,
    handleDuplicateKeyError
} = require("../utils/flatHelpers");

/**
 * GET /api/flat/validate/:code
 * Public — check if a flat join code is valid (no sensitive data).
 */
exports.validateFlatCode = async (req, res) => {
    try {
        const code = normalizeFlatCode(req.params.code);

        if (!isValidFlatCodeFormat(code)) {
            return res.status(400).json({
                success: false,
                message: "Invalid flat code format"
            });
        }

        const flat = await Flat.findOne({ flatCode: code, status: "active" })
            .select("name flatCode status");

        if (!flat) {
            return res.status(404).json({
                success: false,
                exists: false,
                message: "Flat not found. Please check the code and try again."
            });
        }

        res.status(200).json({
            success: true,
            exists: true,
            flat: {
                name: flat.name,
                flatCode: flat.flatCode
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * POST /api/flat/create
 * Create admin account + flat in one atomic transaction.
 * Body: name, email, phone, password, confirmPassword, flatName, flatAddress?
 */
exports.createFlatWithAdmin = async (req, res) => {
    let admin = null;
    let flat = null;

    try {
        const {
            name,
            email,
            phone,
            password,
            confirmPassword,
            flatName,
            flatAddress
        } = req.body;

        if (!name || !email || !phone || !password || !flatName) {
            return res.status(400).json({
                success: false,
                message: "Please provide name, email, phone, password, and flat name"
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const flatCode = await generateUniqueFlatCode(Flat);
        const generatedUsername = `${normalizedEmail.split("@")[0]}_${flatCode.toLowerCase()}`;

        const existingUser = await User.findOne({
            $or: [
                { email: normalizedEmail },
                { username: generatedUsername },
                { phone: phone.trim() }
            ]
        });

        if (existingUser) {
            if (existingUser.flatId) {
                return res.status(400).json({
                    success: false,
                    message: "You are already a member of another flat."
                });
            }
            return res.status(400).json({
                success: false,
                message: "An account with this email, username, or phone number already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const username = normalizedEmail.split("@")[0];

        const adminId = new mongoose.Types.ObjectId();
        const flatId = new mongoose.Types.ObjectId();

        flat = await Flat.create({
            _id: flatId,
            name: flatName.trim(),
            flatCode,
            adminId: adminId,
            address: flatAddress ? flatAddress.trim() : "",
            status: "active"
        });

        admin = await User.create({
            _id: adminId,
            name: name.trim(),
            username: `${username}_${flatCode.toLowerCase()}`,
            email: normalizedEmail,
            phone: phone.trim(),
            password: hashedPassword,
            role: "admin",
            status: "approved",
            flatId: flatId,
            group: flatName.trim()
        });

        const token = jwt.sign(
            {
                id: admin._id,
                email: admin.email,
                role: "admin",
                flatId: flat._id
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            success: true,
            message: "Flat created successfully",
            token,
            flat: {
                id: flat._id,
                name: flat.name,
                flatCode: flat.flatCode,
                address: flat.address
            },
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                phone: admin.phone,
                flatId: flat._id,
                status: admin.status
            },
            memberId: admin._id // Since Admin participates directly as User, memberId is admin's id.
        });

    } catch (error) {
        if (flat?._id) await Flat.findByIdAndDelete(flat._id).catch(() => {});
        if (admin?._id) await User.findByIdAndDelete(admin._id).catch(() => {});

        const dup = handleDuplicateKeyError(error, res);
        if (dup) return dup;

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * GET /api/flat/my
 * Admin — get the flat owned by the logged-in admin.
 */
exports.getMyFlat = async (req, res) => {
    try {
        const flatId = req.user?.flatId || req.admin?.flatId;

        if (!flatId) {
            return res.status(400).json({
                success: false,
                message: "No flat associated with this admin account"
            });
        }

        const flat = await Flat.findById(flatId)
            .populate("adminId", "name email phone");

        if (!flat) {
            return res.status(404).json({
                success: false,
                message: "Flat not found"
            });
        }

        const memberCount = await User.countDocuments({
            flatId: flat._id,
            status: "approved"
        });

        res.status(200).json({
            success: true,
            flat,
            memberCount
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * PUT /api/flat/my
 * Admin — update the flat details (name, address).
 */
exports.updateMyFlat = async (req, res) => {
    try {
        const flatId = req.user?.flatId || req.admin?.flatId;
        const { name, address } = req.body;

        if (!flatId) {
            return res.status(400).json({
                success: false,
                message: "No flat associated with this admin account"
            });
        }

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Flat name is required"
            });
        }

        const flat = await Flat.findById(flatId);

        if (!flat) {
            return res.status(404).json({
                success: false,
                message: "Flat not found"
            });
        }

        flat.name = name.trim();
        flat.address = address ? address.trim() : "";

        await flat.save();

        res.status(200).json({
            success: true,
            message: "Flat settings updated successfully",
            flat
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
