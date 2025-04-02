const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware.js");
const { submitFeedback, stakeholderComments, equipment, getProjects, getStakeholders, newProject, changeProjectStage, saveProject, processRequest, getScope, generateChecklist, insertChecklistEntries, updateChecklistCompletion, getProjectChecklist, getBlobUrl, updateBlobUrl, uploadBlobAzure, updateTaskComments, getTaskComments, addTaskComments, deleteTaskComments, closeProject } = require("../controllers/projectsController.js");

const router = express.Router();

router.get("/list", verifyToken, getProjects);
router.post("/equipment", verifyToken, equipment);
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
router.get("/get-task-comments", verifyToken, getTaskComments)
router.post("/add-task-comments", verifyToken, addTaskComments)
router.post("/update-task-comments", verifyToken, updateTaskComments)
router.get("/get-blob-url", verifyToken, getBlobUrl)
router.post("/update-blob-url", verifyToken, updateBlobUrl)
router.post("/upload-blob-azure", verifyToken, uploadBlobAzure)
router.delete("/delete-task-comment",verifyToken,deleteTaskComments)
router.post("/stakeholder-comments", verifyToken, stakeholderComments)
router.post("/feedback", verifyToken, submitFeedback)
router.post("/close", verifyToken, closeProject)

module.exports = router;