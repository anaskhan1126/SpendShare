/**
 * Shared helpers for flat-scoped operations.
 */

function normalizeFlatCode(code) {
    if (!code || typeof code !== "string") return "";
    return code.trim().toUpperCase();
}

function isValidFlatCodeFormat(code) {
    return /^[A-Z0-9]{6,10}$/.test(code);
}

function handleDuplicateKeyError(error, res) {
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0] || "field";
        return res.status(400).json({
            success: false,
            message: `A record with this ${field} already exists`
        });
    }
    return null;
}

/** Build a Mongo filter for flat-scoped queries. Legacy users without flatId get no filter. */
function buildFlatFilter(flatId) {
    if (!flatId) return {};
    return { flatId };
}

/** Merge flat filter into an existing query object. */
function mergeFlatFilter(flatId, query = {}) {
    if (!flatId) return { ...query };
    return { ...query, flatId };
}

/** Approved members in a flat (or all approved when legacy). */
function approvedMembersQuery(flatId) {
    const query = { status: "approved" };
    if (flatId) query.flatId = flatId;
    return query;
}

function isSameFlat(a, b) {
    if (!a || !b) return true;
    return String(a) === String(b);
}

/** Block access when a document belongs to a different flat. */
function assertFlatAccess(res, docFlatId, userFlatId, message = "Access denied for this flat") {
    if (!userFlatId || !docFlatId) return true;
    if (!isSameFlat(docFlatId, userFlatId)) {
        res.status(403).json({ success: false, message });
        return false;
    }
    return true;
}

module.exports = {
    normalizeFlatCode,
    isValidFlatCodeFormat,
    handleDuplicateKeyError,
    buildFlatFilter,
    mergeFlatFilter,
    approvedMembersQuery,
    isSameFlat,
    assertFlatAccess
};
