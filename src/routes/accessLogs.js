import express from 'express';
import {
  getAccessLogs,
  getAccessLogById,
  createAccessLog,
  verifyAccessLog,
  updateGuestInfo,
  getLogsByLicensePlate,
  getLogsByGuestInfo,
  getLogsByDateRange,
  getDailyStats,
  getPendingLogs,
  getVehiclesInside,
  deleteAccessLog,
  getReports,
  getWorkingHoursStats,
  getWorkingHoursViolations,
  getUserWorkingHoursReport
} from '../controllers/accessLogController.js';
import {
  authenticateToken,
  requireAdmin,
  optionalAuth
} from '../middleware/auth.js';
import {
  validateAccessLog
} from '../middleware/validation.js';
import {
  recognitionLimiter
} from '../middleware/rateLimiter.js';
import activityMiddleware from '../middleware/activityMiddleware.js';
import {
  parseAccessLogFormData
} from '../middleware/formDataParser.js';

const router = express.Router();

// Public route for AI system to create logs
router.post('/', recognitionLimiter, parseAccessLogFormData, validateAccessLog, createAccessLog);

// Protected routes
router.use(authenticateToken);

// General routes
router.get('/', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getAccessLogs);
router.get('/stats/daily', activityMiddleware('VIEW_ANALYTICS', 'access_logs'), getDailyStats);
router.get('/stats/working-hours', activityMiddleware('VIEW_ANALYTICS', 'access_logs'), getWorkingHoursStats);
router.get('/stats/violations', activityMiddleware('VIEW_ANALYTICS', 'access_logs'), getWorkingHoursViolations);
router.get('/reports', requireAdmin, activityMiddleware('VIEW_REPORT', 'access_logs'), getReports);
router.get('/pending', requireAdmin, activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getPendingLogs);
router.get('/vehicles-inside', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getVehiclesInside);
router.get('/date-range', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getLogsByDateRange);
router.get('/license-plate/:licensePlate', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getLogsByLicensePlate);
router.get('/guest-search', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getLogsByGuestInfo);
router.get('/user/:userId/working-hours-report', activityMiddleware('VIEW_REPORT', 'access_logs'), getUserWorkingHoursReport);
router.get('/:id', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getAccessLogById);

// Admin only routes
router.put('/:id/verify', requireAdmin, activityMiddleware('UPDATE_ACCESS_LOG', 'access_logs'), verifyAccessLog);
router.put('/:id/guest-info', requireAdmin, activityMiddleware('UPDATE_ACCESS_LOG', 'access_logs'), updateGuestInfo);
router.delete('/:id', requireAdmin, activityMiddleware('DELETE_ACCESS_LOG', 'access_logs'), deleteAccessLog);

export default router;
