const Expense = require("../models/Expense");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const MemberRequest = require("../models/MemberRequest");
const User = require("../models/User");
const Flat = require("../models/Flat");
const {
    mergeFlatFilter,
    approvedMembersQuery,
    assertFlatAccess
} = require("../utils/flatHelpers");
const {
    fetchMonthlySummaryData,
    fetchAvailableMonthsData
} = require("../utils/summaryHelpers");

// ==========================================
// Admin Register
// ==========================================

exports.adminRegister = async (req, res) => {
    try {
        const {
            name,
            username,
            email,
            phone,
            password
        } = req.body;

        const checkFields = [
            { email: email.trim().toLowerCase() }
        ];
        if (username) checkFields.push({ username: username.trim().toLowerCase() });
        if (phone) checkFields.push({ phone: phone.trim() });

        const existingUser = await User.findOne({ $or: checkFields });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User account already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = await User.create({
            name,
            username: username || undefined,
            email,
            phone: phone || undefined,
            password: hashedPassword,
            role: "admin",
            status: "approved"
        });

        res.status(201).json({
            success: true,
            message: "Admin Registered Successfully",
            admin
        });

    }
    catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0] || "field";
            return res.status(400).json({
                success: false,
                message: `An account with this ${field} already exists`
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Admin Login
// ==========================================

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        let admin = await User.findOne({ email });

        if (!admin) {
            const mongoose = require("mongoose");
            const LegacyAdmin = mongoose.models.LegacyAdmin || mongoose.model("LegacyAdmin", new mongoose.Schema({}, { strict: false }), "admins");
            const legacyAdmin = await LegacyAdmin.findOne({ email });
            
            if (legacyAdmin) {
                admin = await User.create({
                    name: legacyAdmin.name || "Admin",
                    username: legacyAdmin.username || email.split("@")[0],
                    email: legacyAdmin.email,
                    phone: legacyAdmin.phone,
                    password: legacyAdmin.password,
                    role: "admin",
                    status: "approved",
                    flatId: legacyAdmin.flatId || null
                });
            }
        }

        if (!admin || admin.role !== "admin") {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid Password"
            });
        }

        if (admin.status === "suspended") {
            return res.status(403).json({
                success: false,
                message: "Your admin account has been suspended."
            });
        }

        if (admin.status === "pending") {
            return res.status(403).json({
                success: false,
                message: "Your admin account is not yet approved."
            });
        }

        let flat = null;
        if (admin.flatId) {
            flat = await Flat.findById(admin.flatId).select("name flatCode status address");
            if (flat && flat.status !== "active") {
                return res.status(403).json({
                    success: false,
                    message: "Your flat is currently inactive."
                });
            }
        }

        const token = jwt.sign(
            {
                id: admin._id,
                email: admin.email,
                role: "admin",
                flatId: admin.flatId || null,
                status: admin.status
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.status(200).json({
            success: true,
            message: "Login Successful",
            token,
            admin: {
                id: admin._id,
                memberId: admin._id,
                name: admin.name,
                username: admin.username,
                email: admin.email,
                phone: admin.phone,
                flatId: admin.flatId || null,
                status: admin.status,
                flat: flat ? {
                    id: flat._id,
                    name: flat.name,
                    flatCode: flat.flatCode,
                    address: flat.address
                } : null
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Add Member
// ==========================================

exports.addMember = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const flatId = req.user?.flatId || req.admin?.flatId || null;

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPhone = phone ? phone.trim() : "";

        // Resolve flat and flat code to make username unique
        const flat = flatId ? await Flat.findById(flatId) : null;
        const flatCode = flat ? flat.flatCode : "";
        let generatedUsername = name.toLowerCase().replace(/\s+/g, "_");
        if (flatCode) {
            generatedUsername = `${generatedUsername}_${flatCode.toLowerCase()}`;
        }

        // Global uniqueness check
        const checkFields = [
            { email: normalizedEmail },
            { username: generatedUsername }
        ];
        if (normalizedPhone) {
            checkFields.push({ phone: normalizedPhone });
        }

        const existingUser = await User.findOne({ $or: checkFields });

        if (existingUser) {
            if (existingUser.flatId) {
                return res.status(400).json({
                    success: false,
                    message: "A user with this email, username, or phone number already belongs to a flat."
                });
            }
            return res.status(400).json({
                success: false,
                message: "An account with this email, username, or phone number already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const member = await User.create({
            name: name.trim(),
            username: generatedUsername,
            email: normalizedEmail,
            phone: normalizedPhone || undefined,
            password: hashedPassword,
            role: "member",
            status: "approved",
            flatId,
            group: flat ? flat.name : "Flat Members"
        });

        res.status(201).json({
            success: true,
            message: "Member Added Successfully",
            member
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Get All Members
// ==========================================

exports.getAllMembers = async (req, res) => {
    try {
        const flatId = req.user?.flatId || req.admin?.flatId || null;

        const members = await User.find(approvedMembersQuery(flatId))
            .select("-password")
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: members.length,
            members
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Update Member
// ==========================================

exports.updateMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone } = req.body;

        const existing = await User.findById(id);

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        const adminFlatId = req.user?.flatId || req.admin?.flatId;
        if (!assertFlatAccess(res, existing.flatId, adminFlatId)) return;

        const member = await User.findByIdAndUpdate(
            id,
            {
                name,
                email,
                phone
            },
            { new: true }
        ).select("-password");

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Member updated successfully",
            member
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Delete Member
// ==========================================

exports.deleteMember = async (req, res) => {
    try {
        const { id } = req.params;
        const member = await User.findById(id);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        const adminFlatId = req.user?.flatId || req.admin?.flatId;
        if (!assertFlatAccess(res, member.flatId, adminFlatId)) return;

        await User.findByIdAndDelete(id);

        try {
            const calculateSettlements = require("../utils/settlementCalculator");
            await calculateSettlements(member.flatId);
        } catch (calcError) {
            console.error("Failed to recalculate settlements after deleting member:", calcError);
        }

        res.status(200).json({
            success: true,
            message: "Member deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Admin Dashboard
// ==========================================

exports.getDashboard = async (req, res) => {
    try {
        const flatId = req.user?.flatId || req.admin?.flatId || null;
        
        let flatCode = null;
        let flatName = null;
        
        if (flatId) {
            const Flat = require("../models/Flat");
            const flat = await Flat.findById(flatId).select("name flatCode");
            if (flat) {
                flatCode = flat.flatCode;
                flatName = flat.name;
            }
        }

        const totalMembers = await User.countDocuments(approvedMembersQuery(flatId));

        const expenses = await Expense.find(mergeFlatFilter(flatId, {}))
            .populate("paidBy", "name")
            .sort({ expenseDate: -1 });

        const totalExpenses = expenses.length;

        const totalAmount = expenses.reduce(
            (sum, expense) => sum + expense.amount,
            0
        );

        const recentExpenses = expenses.slice(0, 5);

        res.json({
            success: true,
            totalMembers,
            totalExpenses,
            totalAmount,
            recentExpenses,
            flatCode,
            flatName
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Get Pending Member Requests
// ==========================================

exports.getMemberRequests = async (req, res) => {
    try {
        const query = { status: "Pending" };
        const adminFlatId = req.user?.flatId || req.admin?.flatId;

        if (adminFlatId) {
            query.flatId = adminFlatId;
        }

        const requests = await MemberRequest.find(query)
            .sort({ requestedAt: -1 })
            .populate("flatId", "name flatCode");

        res.status(200).json({
            success: true,
            requests
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Approve Member Request
// ==========================================

exports.approveMemberRequest = async (req, res) => {
    try {
        const request = await MemberRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found"
            });
        }

        const adminFlatId = req.user?.flatId || req.admin?.flatId;
        if (adminFlatId && request.flatId &&
            request.flatId.toString() !== adminFlatId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only approve requests for your flat"
            });
        }

        const flat = request.flatId
            ? await Flat.findById(request.flatId)
            : null;

        const existingUser = await User.findOne({
            $or: [
                { email: request.email },
                { username: request.username },
                { phone: request.phone }
            ]
        });

        if (existingUser) {
            // Delete request to avoid state bloat
            await MemberRequest.findByIdAndDelete(req.params.id);

            if (existingUser.flatId) {
                return res.status(400).json({
                    success: false,
                    message: "You are already a member of another flat."
                });
            }
            return res.status(400).json({
                success: false,
                message: "An account with this email, username, or phone number already exists."
            });
        }

        await User.create({
            name: request.name,
            username: request.username,
            email: request.email,
            phone: request.phone,
            password: request.password,
            role: "member",
            status: "approved",
            flatId: request.flatId || null,
            group: flat ? flat.name : "Flat Members"
        });

        await MemberRequest.findByIdAndDelete(req.params.id);

        try {
            const calculateSettlements = require("../utils/settlementCalculator");
            await calculateSettlements(request.flatId || adminFlatId || null);
        } catch (calcError) {
            console.error("Failed to recalculate settlements after approving request:", calcError);
        }

        res.status(200).json({
            success: true,
            message: "Member approved successfully."
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Reject Member Request
// ==========================================

exports.rejectMemberRequest = async (req, res) => {
    try {
        const request = await MemberRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found"
            });
        }

        const adminFlatId = req.user?.flatId || req.admin?.flatId;
        if (adminFlatId && request.flatId &&
            request.flatId.toString() !== adminFlatId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only reject requests for your flat"
            });
        }

        await MemberRequest.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: "Request rejected."
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Monthly Summary & Months (uses helper functions)
// ==========================================

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
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getAvailableMonths = async (req, res) => {
    try {
        const flatId = req.user?.flatId || req.admin?.flatId || null;
        const months = await fetchAvailableMonthsData(flatId);

        res.status(200).json({
            success: true,
            months
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==========================================
// Profile
// ==========================================

exports.getAdminProfile = async (req, res) => {
    try {
        const admin = await User.findById(req.params.adminId).select("-password");

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        const expenses = await Expense.find({
            paidBy: admin._id
        });

        const totalExpenses = expenses.length;
        const totalPaid = expenses.reduce(
            (sum, item) => sum + item.amount,
            0
        );

        res.status(200).json({
            success: true,
            admin: {
                ...admin.toObject(),
                memberId: admin._id
            },
            totalExpenses,
            totalPaid
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { adminId } = req.params;
        const { currentPassword, newPassword } = req.body;

        const userId = req.user?.id || req.admin?.id;
        if (adminId !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only update your own password"
            });
        }

        const admin = await User.findById(adminId);

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin account not found"
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, admin.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        admin.password = hashedPassword;
        await admin.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
