import express from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  getProfile,
  updateProfile,
  changePassword,
  verifyToken
} from '../controllers/authController.js';
import {
  authenticateToken,
  requireAdmin,
  optionalAuth
} from '../middleware/auth.js';
import {
  validateRegister,
  validateLogin,
  validateChangePassword
} from '../middleware/validation.js';
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter
} from '../middleware/rateLimiter.js';
import activityMiddleware from '../middleware/activityMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerLimiter, validateRegister, activityMiddleware('CREATE_USER', 'users'), register);
router.post('/login', loginLimiter, validateLogin, login);
router.post('/refresh-token', refreshToken);

// Protected routes
router.use(authenticateToken); // Tất cả routes dưới đây cần authentication

router.post('/logout', logout);
router.post('/logout-all', logoutAll);
router.get('/profile', activityMiddleware('VIEW_USER', 'users'), getProfile);
router.put('/profile', activityMiddleware('UPDATE_PROFILE', 'users'), updateProfile);
router.put('/change-password', passwordResetLimiter, validateChangePassword, activityMiddleware('CHANGE_PASSWORD', 'users'), changePassword);
router.get('/verify', verifyToken);

export default router;
