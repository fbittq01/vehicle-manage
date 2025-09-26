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

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// Public routes (chỉ cần đăng nhập)
router.get('/active', getActiveWorkingHours);
router.get('/check', validateCheckWorkingTime, checkWorkingTime);

// Super admin only routes
router.use(requireSuperAdmin);

router.get('/', validateWorkingHoursQuery, getWorkingHours);
router.get('/:id', validateWorkingHoursParams, getWorkingHoursById);
router.post('/', validateWorkingHours, createWorkingHours);
router.put('/:id', validateWorkingHoursParams, validateUpdateWorkingHours, updateWorkingHours);
router.put('/:id/activate', validateWorkingHoursParams, activateWorkingHours);
router.delete('/:id', validateWorkingHoursParams, deleteWorkingHours);

export default router;
