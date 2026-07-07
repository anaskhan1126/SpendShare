/**
 * Generates a unique flat join code (e.g. SPD8X4Q).
 * Excludes ambiguous characters: 0, O, I, 1
 */
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_LENGTH = 7;

function generateFlatCode(length = DEFAULT_LENGTH) {
    let code = "";
    for (let i = 0; i < length; i++) {
        code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
    }
    return code;
}

/**
 * Generate a code that does not already exist in the Flats collection.
 */
async function generateUniqueFlatCode(Flat, length = DEFAULT_LENGTH, maxAttempts = 20) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const code = generateFlatCode(length);
        const exists = await Flat.exists({ flatCode: code });
        if (!exists) return code;
    }
    throw new Error("Unable to generate a unique flat code. Please try again.");
}

module.exports = {
    generateFlatCode,
    generateUniqueFlatCode,
    CHARSET,
    DEFAULT_LENGTH
};
