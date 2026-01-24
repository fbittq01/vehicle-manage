import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  resetUserPassword,
  getUserStats
} from '../controllers/userController.js';
import {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  requireSupervisor
} from '../middleware/auth.js';
import {
  validateRegister,
  validateUpdateUser
} from '../middleware/validation.js';
import activityMiddleware from '../middleware/activityMiddleware.js';

const router = express.Router();

// Tất cả routes cần authentication
router.use(authenticateToken);

// Admin routes (supervisor có quyền read-only)
router.get('/', requireSupervisor, activityMiddleware('VIEW_USER', 'users'), getUsers);
router.get('/stats', requireAdmin, activityMiddleware('VIEW_ANALYTICS', 'users'), getUserStats);
router.get('/:id', activityMiddleware('VIEW_USER', 'users'), getUserById);
router.post('/', requireAdmin, validateRegister, activityMiddleware('CREATE_USER', 'users'), createUser);
router.put('/:id', validateUpdateUser, activityMiddleware('UPDATE_USER', 'users'), updateUser);
router.delete('/:id', requireAdmin, activityMiddleware('DELETE_USER', 'users'), deleteUser);
router.put('/:id/activate', requireAdmin, activityMiddleware('ACTIVATE_USER', 'users'), activateUser);
router.put('/:id/reset-password', requireSuperAdmin, activityMiddleware('RESET_PASSWORD', 'users'), resetUserPassword);

export default router;
