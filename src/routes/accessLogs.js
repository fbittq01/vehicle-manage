import express from 'express';
import {
  getAccessLogs,
  getAccessLogById,
  createAccessLog,
  verifyAccessLog,
  getLogsByLicensePlate,
  getLogsByDateRange,
  getDailyStats,
  getPendingLogs,
  getVehiclesInside,
  deleteAccessLog,
  getReports
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
import {
  parseAccessLogFormData
} from '../middleware/formDataParser.js';

const router = express.Router();

// Public route for AI system to create logs
router.post('/', recognitionLimiter, parseAccessLogFormData, validateAccessLog, createAccessLog);

// Protected routes
router.use(authenticateToken);

// General routes
router.get('/', getAccessLogs);
router.get('/stats/daily', getDailyStats);
router.get('/reports', requireAdmin, getReports);
router.get('/pending', requireAdmin, getPendingLogs);
router.get('/vehicles-inside', getVehiclesInside);
router.get('/date-range', getLogsByDateRange);
router.get('/license-plate/:licensePlate', getLogsByLicensePlate);
router.get('/:id', getAccessLogById);

// Admin only routes
router.put('/:id/verify', requireAdmin, verifyAccessLog);
router.delete('/:id', requireAdmin, deleteAccessLog);

export default router;
