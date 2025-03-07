const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware.js");
const { approveFile, rejectFile, showApprovalandRejections, uploadNew, download } = require("../controllers/approvalsController.js");

const router = express.Router();

router.post("/approve", verifyToken, approveFile);
router.post("/reject", verifyToken, rejectFile);
router.post("/approval-rejection-status", verifyToken, showApprovalandRejections);
router.post("/reupload", verifyToken, uploadNew);
router.post("/download", verifyToken, download);

module.exports = router;