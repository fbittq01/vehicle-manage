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

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// Routes công khai (tất cả user đã đăng nhập)
router.get('/', getDepartments);
router.get('/stats', getDepartmentStats);
router.get('/hierarchy', getDepartmentHierarchy);
router.get('/root', getRootDepartments);
router.get('/manager/:managerId', getDepartmentsByManager);
router.get('/:id', getDepartmentById);

// Routes cần quyền admin
router.post('/', requireRole(['admin', 'super_admin']), validateDepartment, createDepartment);
router.put('/:id', requireRole(['admin', 'super_admin']), validateUpdateDepartment, updateDepartment);
router.delete('/:id', requireRole(['admin', 'super_admin']), deleteDepartment);

export default router;
