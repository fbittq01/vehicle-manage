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

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// Public routes (chỉ cần đăng nhập)
router.get('/active', getActiveWorkingHours);
router.get('/check', checkWorkingTime);

// Super admin only routes
router.use(requireSuperAdmin);

router.get('/', getWorkingHours);
router.get('/:id', getWorkingHoursById);
router.post('/', createWorkingHours);
router.put('/:id', updateWorkingHours);
router.put('/:id/activate', activateWorkingHours);
router.delete('/:id', deleteWorkingHours);

export default router;
