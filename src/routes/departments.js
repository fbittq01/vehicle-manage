import express from 'express';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentHierarchy,
  getRootDepartments,
  getDepartmentsByManager,
  getDepartmentStats
} from '../controllers/departmentController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateDepartment, validateUpdateDepartment } from '../middleware/validation.js';
import activityMiddleware from '../middleware/activityMiddleware.js';

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// Routes công khai (tất cả user đã đăng nhập)
router.get('/', activityMiddleware('VIEW_DEPARTMENT', 'departments'), getDepartments);
router.get('/stats', activityMiddleware('VIEW_ANALYTICS', 'departments'), getDepartmentStats);
router.get('/hierarchy', activityMiddleware('VIEW_DEPARTMENT', 'departments'), getDepartmentHierarchy);
router.get('/root', activityMiddleware('VIEW_DEPARTMENT', 'departments'), getRootDepartments);
router.get('/manager/:managerId', activityMiddleware('VIEW_DEPARTMENT', 'departments'), getDepartmentsByManager);
router.get('/:id', activityMiddleware('VIEW_DEPARTMENT', 'departments'), getDepartmentById);

// Routes cần quyền admin
router.post('/', requireRole(['admin', 'super_admin']), validateDepartment, activityMiddleware('CREATE_DEPARTMENT', 'departments'), createDepartment);
router.put('/:id', requireRole(['admin', 'super_admin']), validateUpdateDepartment, activityMiddleware('UPDATE_DEPARTMENT', 'departments'), updateDepartment);
router.delete('/:id', requireRole(['admin', 'super_admin']), activityMiddleware('DELETE_DEPARTMENT', 'departments'), deleteDepartment);

export default router;
