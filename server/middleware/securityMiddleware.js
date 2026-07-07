/**
 * SpendShare Custom Security Middleware
 * Custom Helmet-like headers and custom in-memory rate limiting.
 */

const rateLimitStore = {};

// Clean up memory leaks in rateLimitStore every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const ip in rateLimitStore) {
        if (now > rateLimitStore[ip].resetTime) {
            delete rateLimitStore[ip];
        }
    }
}, 10 * 60 * 1000);

/**
 * Custom Rate Limiting Middleware
 * @param {Object} options Configuration options
 * @param {number} options.windowMs Time window in milliseconds (default: 1 minute)
 * @param {number} options.max Maximum requests in windowMs (default: 60)
 * @param {string} options.message Error message returned on block (default: Too many requests)
 */
const customRateLimiter = (options = {}) => {
    const windowMs = options.windowMs || 60 * 1000;
    const max = options.max || 60;
    const message = options.message || "Too many requests, please try again later.";

    return (req, res, next) => {
        const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const now = Date.now();

        if (!rateLimitStore[ip]) {
            rateLimitStore[ip] = {
                count: 1,
                resetTime: now + windowMs
            };
            return next();
        }

        const clientLimit = rateLimitStore[ip];

        if (now > clientLimit.resetTime) {
            clientLimit.count = 1;
            clientLimit.resetTime = now + windowMs;
            return next();
        }

        clientLimit.count++;

        if (clientLimit.count > max) {
            return res.status(429).json({
                success: false,
                message
            });
        }

        next();
    };
};

/**
 * Custom Security Headers (Helmet replica)
 */
const customSecurityHeaders = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Download-Options", "noopen");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    
    // Disable server header information
    res.removeHeader("X-Powered-By");
    next();
};

/**
 * Basic Input Sanitization Middleware to prevent simple XSS and NoSQL injections
 */
const sanitizeBodyInputs = (req, res, next) => {
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === "string") {
                // Remove potential MongoDB operator injection prefix '$' or containing '.'
                if (req.body[key].startsWith("$") || req.body[key].includes(".$")) {
                    req.body[key] = req.body[key].replace(/^\$/, "");
                }
                // Basic HTML tag stripping to prevent raw script tags
                req.body[key] = req.body[key]
                    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
                    .trim();
            }
        }
    }
    next();
};

module.exports = {
    customRateLimiter,
    customSecurityHeaders,
    sanitizeBodyInputs
};
