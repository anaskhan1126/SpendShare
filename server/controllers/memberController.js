const Expense = require("../models/Expense");
const Settlement = require("../models/Settlement");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const MemberRequest = require("../models/MemberRequest");
const User = require("../models/User");
const Flat = require("../models/Flat");
const {
    normalizeFlatCode,
    isValidFlatCodeFormat,
    mergeFlatFilter,
    approvedMembersQuery,
    assertFlatAccess
} = require("../utils/flatHelpers");
const {
    fetchMonthlySummaryData,
    fetchAvailableMonthsData
} = require("../utils/summaryHelpers");

// ================= Member Login =================

exports.memberLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        const member = await User.findOne({
            username: username.toLowerCase()
        });

        if (!member) {
            const pendingRequest = await MemberRequest.findOne({
                username: username.toLowerCase(),
                status: "Pending"
            });

            if (pendingRequest) {
                const isMatch = await bcrypt.compare(password, pendingRequest.password);
                if (isMatch) {
                    return res.status(403).json({
                        success: false,
                        code: "PENDING_APPROVAL",
                        message: "Your request is waiting for admin approval."
                    });
                } else {
                    return res.status(401).json({
                        success: false,
                        message: "Invalid Password"
                    });
                }
            }

            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        // Check Password
        const isMatch = await bcrypt.compare(password, member.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid Password"
            });
        }

        if (member.status === "pending") {
            return res.status(403).json({
                success: false,
                code: "PENDING_APPROVAL",
                message: "Your request is waiting for admin approval."
            });
        }

        if (member.status === "rejected") {
            return res.status(403).json({
                success: false,
                message: "Your membership request was rejected. Please contact your flat admin."
            });
        }

        let flat = null;
        if (member.flatId) {
            flat = await Flat.findById(member.flatId).select("name flatCode status");
            if (flat && flat.status !== "active") {
                return res.status(403).json({
                    success: false,
                    message: "This flat is currently inactive. Please contact support."
                });
            }
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: member._id,
                email: member.email,
                role: member.role,
                flatId: member.flatId || null,
                status: member.status
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
            member: {
                id: member._id,
                name: member.name,
                username: member.username,
                email: member.email,
                phone: member.phone,
                role: member.role,
                flatId: member.flatId || null,
                status: member.status,
                group: member.group,
                flat: flat ? {
                    name: flat.name,
                    flatCode: flat.flatCode
                } : null
            }
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Member Profile =================

exports.getMemberProfile = async (req, res) => {
    try {
        const member = await User.findById(req.params.memberId)
            .select("-password");

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        const userId = req.user?.id || req.member?.id;
        if (req.params.memberId !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You can only view your own profile"
            });
        }

        const flatId = req.user?.flatId || req.member?.flatId;
        if (!assertFlatAccess(res, member.flatId, flatId)) return;

        const expenses = await Expense.find(
            mergeFlatFilter(flatId, { paidBy: member._id })
        );

        let totalPaid = 0;
        expenses.forEach(expense => {
            totalPaid += expense.amount;
        });

        res.json({
            success: true,
            member,
            totalExpenses: expenses.length,
            totalPaid
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Change Password =================

exports.changePassword = async (req, res) => {
    try {
        const { memberId } = req.params;
        const {
            currentPassword,
            newPassword
        } = req.body;

        const member = await User.findById(memberId);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        const isMatch = await bcrypt.compare(
            currentPassword,
            member.password
        );

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        member.password = hashedPassword;
        await member.save();

        res.json({
            success: true,
            message: "Password changed successfully"
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Expense Chart =================

exports.getExpenseChart = async (req, res) => {
    try {
        const flatId = req.user?.flatId || req.member?.flatId || null;
        const userId = req.user?.id || req.member?.id;

        const expenses = await Expense.find(
            mergeFlatFilter(flatId, { paidBy: userId })
        );

        const categories = {};
        expenses.forEach(expense => {
            const category = expense.category || "Others";
            categories[category] = (categories[category] || 0) + expense.amount;
        });

        res.status(200).json({
            success: true,
            labels: Object.keys(categories),
            values: Object.values(categories)
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Member Registration Request =================

exports.registerRequest = async (req, res) => {
    try {
        const {
            name,
            username,
            email,
            phone,
            password,
            flatCode
        } = req.body;

        if (!flatCode) {
            return res.status(400).json({
                success: false,
                message: "Flat code is required"
            });
        }

        const code = normalizeFlatCode(flatCode);

        if (!isValidFlatCodeFormat(code)) {
            return res.status(400).json({
                success: false,
                message: "Invalid flat code format"
            });
        }

        const flat = await Flat.findOne({ flatCode: code, status: "active" });

        if (!flat) {
            return res.status(404).json({
                success: false,
                message: "Flat not found. Please check your flat code."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedUsername = username.trim().toLowerCase();

        // Check if user exists globally with this email/username/phone in single User model
        const existingUser = await User.findOne({
            $or: [
                { email: normalizedEmail },
                { username: normalizedUsername },
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
                message: "An account with this email, username, or phone number already exists."
            });
        }

        // Check if a pending request exists globally with this email/username/phone
        const existingRequest = await MemberRequest.findOne({
            status: "Pending",
            $or: [
                { email: normalizedEmail },
                { username: normalizedUsername },
                { phone: phone.trim() }
            ]
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "A pending registration request already exists with this email, username, or phone number."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await MemberRequest.create({
            name: name.trim(),
            username: normalizedUsername,
            email: normalizedEmail,
            phone: phone.trim(),
            password: hashedPassword,
            flatId: flat._id,
            flatCode: code,
            status: "Pending"
        });

        res.status(201).json({
            success: true,
            message: "Registration request sent successfully. Please wait for admin approval.",
            flat: {
                name: flat.name,
                flatCode: flat.flatCode
            }
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= Monthly Expense Summary & Months (uses helper functions) =================

exports.getMonthlySummary = async (req, res) => {
    try {
        const flatId = req.user?.flatId || req.member?.flatId || null;
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
        const flatId = req.user?.flatId || req.member?.flatId || null;
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

// ================= Get Flat Members =================

exports.getMembers = async (req, res) => {
    try {
        const flatId = req.user?.flatId || req.member?.flatId || null;

        const members = await User.find(approvedMembersQuery(flatId))
            .select("name email phone role status createdAt");

        const data = await Promise.all(
            members.map(async (member) => {
                const expenses = await Expense.find(
                    mergeFlatFilter(flatId, { paidBy: member._id })
                );

                const totalPaid = expenses.reduce(
                    (sum, expense) => sum + expense.amount,
                    0
                );

                return {
                    _id: member._id,
                    name: member.name,
                    email: member.email,
                    phone: member.phone || "",
                    role: member.role || "member",
                    status: member.status || "approved",
                    createdAt: member.createdAt,
                    expenseCount: expenses.length,
                    totalPaid
                };
            })
        );

        res.status(200).json({
            success: true,
            members: data
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};