const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware.js");
const { getProjects, getStakeholders, newProject, changeProjectStage, saveProject, processRequest, getScope, generateChecklist, insertChecklistEntries, updateChecklistCompletion, getProjectChecklist } = require("../controllers/projectsController.js");

const router = express.Router();

router.get("/list", verifyToken, getProjects);
router.get("/stakeholders", verifyToken, getStakeholders);
router.post("/new", verifyToken, newProject);
router.post("/update-stage", verifyToken, changeProjectStage);
router.post("/save", verifyToken, saveProject);
router.post("/generate-docs", verifyToken, processRequest);
router.get("/get-project-scope", verifyToken, getScope)
router.post("/generate-checklist", verifyToken, generateChecklist)
router.post("/insert-checklist-entries", verifyToken, insertChecklistEntries)
router.post("/update-checklist-completion", verifyToken, updateChecklistCompletion)
router.get("/get-project-checklist", verifyToken, getProjectChecklist)
module.exports = router;