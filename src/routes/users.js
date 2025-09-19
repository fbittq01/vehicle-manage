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
  requireSuperAdmin
} from '../middleware/auth.js';
import {
  validateRegister,
  validateUpdateUser
} from '../middleware/validation.js';

const router = express.Router();

// Tất cả routes cần authentication
router.use(authenticateToken);

// Admin routes
router.get('/', requireAdmin, getUsers);
router.get('/stats', requireAdmin, getUserStats);
router.get('/:id', requireAdmin, getUserById);
router.post('/', requireAdmin, validateRegister, createUser);
router.put('/:id', requireAdmin, validateUpdateUser, updateUser);
router.delete('/:id', requireAdmin, deleteUser);
router.put('/:id/activate', requireAdmin, activateUser);
router.put('/:id/reset-password', requireSuperAdmin, resetUserPassword);

export default router;
