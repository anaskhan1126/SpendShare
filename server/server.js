const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

const connectDB = require("./config/db");

dotenv.config();

// connectDB();

const app = express();

const {
    customRateLimiter,
    customSecurityHeaders,
    sanitizeBodyInputs
} = require("./middleware/securityMiddleware");

// Custom security headers
app.use(customSecurityHeaders);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended:true }));
app.use(sanitizeBodyInputs);

// Static uploads and client assets
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "../client")));

// Strict rate limiters for auth endpoints to prevent brute-force attacks
const isProduction = process.env.NODE_ENV === "production";
const authRateLimiter = customRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 50 : 1000, // relaxed limit for testing/development
    message: "Too many login/register attempts from this IP, please try again after 15 minutes."
});
app.use("/api/admin/login", authRateLimiter);
app.use("/api/admin/register", authRateLimiter);
app.use("/api/member/login", authRateLimiter);
app.use("/api/member/register-request", authRateLimiter);

// General API Rate Limiting (max 120 requests per minute)
app.use("/api", customRateLimiter({
    windowMs: 60 * 1000,
    max: 300,
    message: "Too many requests. Please slow down."
}));

// Routes

app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/flat", require("./routes/flatRoutes"));
app.use("/api/member", require("./routes/memberRoutes"));
// app.use("/api/group", require("./routes/groupRoutes"));
app.use("/api/expense", require("./routes/expenseRoutes"));
app.use("/api/summary", require("./routes/summaryRoutes"));
app.use("/api/report", require("./routes/reportRoutes"));
app.use("/api/settlement", require("./routes/settlementRoutes"));
app.get("/api/health",(req,res)=>{

    res.json({

        success:true,

        message:"SpendShare Backend Running"

    });

});

// const PORT = process.env.PORT || 5000;

// app.listen(PORT,()=>{

//     console.log(`Server Running on Port ${PORT}`);

// });
const startServer = async () => {
    try {
        await connectDB();

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, () => {
            console.log(`Server Running on Port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
};

startServer();
