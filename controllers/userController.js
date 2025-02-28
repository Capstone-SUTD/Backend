const supabase = require("../config/db");

// **Get User Profile (Protected)**
async function getUserProfile(req, res) {
    const userId = req.user.id;

    const { data, error } = await supabase.from("users").select("*").eq("userid", userId).single();

    if (error) return res.status(404).json({ error: "User not found" });

    res.json(data);
}

module.exports = { getUserProfile };