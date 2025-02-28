const bcrypt = require("bcryptjs");

// Hash password
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

// Compare password
async function comparePassword(enteredPassword, storedHash) {
    return await bcrypt.compare(enteredPassword, storedHash);
}

module.exports = {hashPassword, comparePassword};