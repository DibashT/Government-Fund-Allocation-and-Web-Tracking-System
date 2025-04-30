const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/officials-project', authMiddleware, projectController.getOfficialsProject);
router.post('/submit-project', authMiddleware, projectController.submitProject);
router.get('/officials-project-progress', authMiddleware, projectController.getProjectProgress);
router.get('/get-project/:projectId', authMiddleware, projectController.getProject);
router.post('/update-progress/:projectId', authMiddleware, projectController.updateProgress);
router.post('/approve-project/:id', authMiddleware, projectController.approveProject);
router.post('/reject-project/:id', authMiddleware, projectController.rejectProject);
router.get('/project-details/:id', authMiddleware, projectController.getProjectDetails);

module.exports = router;