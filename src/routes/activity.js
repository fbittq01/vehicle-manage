import express from 'express';
import activityController from '../controllers/activityController.js';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication và super admin check cho tất cả routes
router.use(authenticateToken);
router.use(requireSuperAdmin);
router.get('/logs', activityController.getLogs);
router.get('/statistics', activityController.getStatistics);
router.get('/export', activityController.exportLogs);
router.get('/resource/:resource', activityController.getActivitiesByResource);
router.get('/user/:userId', activityController.getUserActivities);

export default router;
