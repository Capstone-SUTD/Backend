const supabase = require("../config/db");
const jwt = require("jsonwebtoken");
const { hashPassword, comparePassword } = require("../utils/passwordUtils");

const JWT_SECRET = process.env.JWT_SECRET;

// Generate JWT Token
function generateToken(user) {
    return jwt.sign({ id: user.userid, email: user.email }, JWT_SECRET, { expiresIn: "1d" });
}

// **User Signup**
async function registerUser(req, res) {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const hashedPassword = await hashPassword(password);

    const { data, error } = await supabase
        .from("users")
        .insert([{ username, email, password: hashedPassword }])
        .select();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({ message: "User registered", user: data[0] });
}

// **User Login**
async function loginUser(req, res) {
    const { email, password } = req.body;

    const { data, error } = await supabase.from("users").select("*").eq("email", email).single();

    if (error || !data) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await comparePassword(password, data.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = generateToken(data);
    res.json({ message: "Login successful", token });
}

module.exports = {registerUser, loginUser};