async function getUserName(userid) {
    const { data, error } = await supabase.from("users").select("username").eq("userid", userid);
    return data[0]["username"];
}

module.exports = getUserName;