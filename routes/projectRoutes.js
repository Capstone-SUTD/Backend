const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware.js");
const { getProjects, getStakeholders, newProject, changeProjectStage, saveProject, processRequest } = require("../controllers/projectsController.js");

const router = express.Router();

router.get("/list", verifyToken, getProjects);
router.get("/stakeholders", verifyToken, getStakeholders);
router.post("/new", verifyToken, newProject);
router.post("/update-stage", verifyToken, changeProjectStage);
router.post("/save", verifyToken, saveProject);
router.post("/generate-docs", verifyToken, processRequest);

module.exports = router;