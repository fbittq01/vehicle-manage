import express from 'express';
import {
  getWorkingHours,
  getWorkingHoursById,
  getActiveWorkingHours,
  createWorkingHours,
  updateWorkingHours,
  deleteWorkingHours,
  activateWorkingHours,
  checkWorkingTime
} from '../controllers/workingHoursController.js';
import {
  getRequestsStats
} from '../controllers/workingHoursRequestController.js';
import {
  authenticateToken,
  requireSuperAdmin
} from '../middleware/auth.js';
import {
  validateWorkingHours,
  validateUpdateWorkingHours,
  validateCheckWorkingTime,
  validateWorkingHoursParams,
  validateWorkingHoursQuery
} from '../middleware/validation.js';
import activityMiddleware from '../middleware/activityMiddleware.js';

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// Public routes (chỉ cần đăng nhập)
router.get('/active', activityMiddleware('VIEW_WORKING_HOUR', 'working_hours'), getActiveWorkingHours);
router.get('/check', validateCheckWorkingTime, activityMiddleware('VIEW_WORKING_HOUR', 'working_hours'), checkWorkingTime);
router.get('/requests-stats', activityMiddleware('VIEW_ANALYTICS', 'working_hours_requests'), getRequestsStats);

// Super admin only routes
router.use(requireSuperAdmin);

router.get('/', validateWorkingHoursQuery, activityMiddleware('VIEW_WORKING_HOUR', 'working_hours'), getWorkingHours);
router.get('/:id', validateWorkingHoursParams, activityMiddleware('VIEW_WORKING_HOUR', 'working_hours'), getWorkingHoursById);
router.post('/', validateWorkingHours, activityMiddleware('CREATE_WORKING_HOUR', 'working_hours'), createWorkingHours);
router.put('/:id', validateWorkingHoursParams, validateUpdateWorkingHours, activityMiddleware('UPDATE_WORKING_HOUR', 'working_hours'), updateWorkingHours);
router.put('/:id/activate', validateWorkingHoursParams, activityMiddleware('ACTIVATE_WORKING_HOUR', 'working_hours'), activateWorkingHours);
router.delete('/:id', validateWorkingHoursParams, activityMiddleware('DELETE_WORKING_HOUR', 'working_hours'), deleteWorkingHours);

export default router;
