import express from 'express';
import {
  getAccessLogs,
  getAccessLogById,
  createAccessLog,
  verifyAccessLog,
  updateGuestInfo,
  updateAccessLogInfo,
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
  getUserWorkingHoursReport,
  approveAccessLog,
  rejectAccessLog,
  getVerificationStats
} from '../controllers/accessLogController.js';
import {
  authenticateToken,
  requireAdmin,
  requireSupervisor,
  optionalAuth
} from '../middleware/auth.js';
import {
  validateAccessLog,
  validateVerifyAccessLog,
  validateUpdateAccessLogInfo
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
router.get('/pending', requireSupervisor, activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getPendingLogs);
router.get('/verification-stats', requireSupervisor, activityMiddleware('VIEW_ANALYTICS', 'access_logs'), getVerificationStats);
router.get('/vehicles-inside', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getVehiclesInside);
router.get('/date-range', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getLogsByDateRange);
router.get('/license-plate/:licensePlate', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getLogsByLicensePlate);
router.get('/guest-search', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getLogsByGuestInfo);
router.get('/user/:userId/working-hours-report', activityMiddleware('VIEW_REPORT', 'access_logs'), getUserWorkingHoursReport);
router.get('/:id', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getAccessLogById);

// Admin only routes
router.delete('/:id', requireAdmin, activityMiddleware('DELETE_ACCESS_LOG', 'access_logs'), deleteAccessLog);

// Supervisor có thể verify access log và cập nhật thông tin khách vãng lai
router.put('/:id/verify', requireSupervisor, validateVerifyAccessLog, activityMiddleware('UPDATE_ACCESS_LOG', 'access_logs'), verifyAccessLog);
router.put('/:id/approve', requireSupervisor, activityMiddleware('UPDATE_ACCESS_LOG', 'access_logs'), approveAccessLog);
router.put('/:id/reject', requireSupervisor, activityMiddleware('UPDATE_ACCESS_LOG', 'access_logs'), rejectAccessLog);
router.put('/:id/guest-info', requireSupervisor, activityMiddleware('UPDATE_ACCESS_LOG', 'access_logs'), updateGuestInfo);
router.put('/:id/correct-info', requireSupervisor, validateUpdateAccessLogInfo, activityMiddleware('UPDATE_ACCESS_LOG', 'access_logs'), updateAccessLogInfo);

export default router;
