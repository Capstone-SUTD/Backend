const express = require("express");
const { getUserProfile } = require("../controllers/userController.js");
const { verifyToken } = require("../middleware/authMiddleware.js");

const router = express.Router();

router.get("/profile", verifyToken, getUserProfile);

module.exports = router;
