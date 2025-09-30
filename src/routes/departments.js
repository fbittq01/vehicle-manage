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

/**
 * @swagger
 * tags:
 *   name: Departments
 *   description: API quản lý phòng ban
 */

/**
 * @swagger
 * /api/departments:
 *   get:
 *     summary: Lấy danh sách phòng ban
 *     tags: [Departments]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên hoặc mã phòng ban
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *         description: Lọc theo phòng ban cha
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Department'
 *   post:
 *     summary: Tạo phòng ban mới (chỉ Admin)
 *     tags: [Departments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Phòng Kỹ thuật"
 *               code:
 *                 type: string
 *                 example: "KT001"
 *               description:
 *                 type: string
 *                 example: "Phòng ban kỹ thuật"
 *               parentId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               managerId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       201:
 *         description: Tạo phòng ban thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Phòng ban đã được tạo thành công"
 *                 data:
 *                   $ref: '#/components/schemas/Department'
 *       403:
 *         description: Không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/departments/stats:
 *   get:
 *     summary: Lấy thống kê phòng ban
 *     tags: [Departments]
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     active:
 *                       type: integer
 *                       example: 22
 *                     inactive:
 *                       type: integer
 *                       example: 3
 *                     totalEmployees:
 *                       type: integer
 *                       example: 250
 *                     totalVehicles:
 *                       type: integer
 *                       example: 150
 */

/**
 * @swagger
 * /api/departments/hierarchy:
 *   get:
 *     summary: Lấy cây phân cấp phòng ban
 *     tags: [Departments]
 *     responses:
 *       200:
 *         description: Lấy cây phân cấp thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     allOf:
 *                       - $ref: '#/components/schemas/Department'
 *                       - type: object
 *                         properties:
 *                           children:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/Department'
 */

/**
 * @swagger
 * /api/departments/root:
 *   get:
 *     summary: Lấy danh sách phòng ban gốc (không có parent)
 *     tags: [Departments]
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Department'
 */

/**
 * @swagger
 * /api/departments/manager/{managerId}:
 *   get:
 *     summary: Lấy danh sách phòng ban theo quản lý
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: managerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của người quản lý
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Department'
 */

/**
 * @swagger
 * /api/departments/{id}:
 *   get:
 *     summary: Lấy thông tin phòng ban theo ID
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phòng ban
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Department'
 *       404:
 *         description: Không tìm thấy phòng ban
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Cập nhật thông tin phòng ban (chỉ Admin)
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phòng ban
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Phòng Kỹ thuật Mới"
 *               description:
 *                 type: string
 *                 example: "Mô tả phòng ban mới"
 *               parentId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               managerId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439012"
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: "active"
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Phòng ban đã được cập nhật"
 *                 data:
 *                   $ref: '#/components/schemas/Department'
 *       403:
 *         description: Không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Xóa phòng ban (chỉ Admin)
 *     tags: [Departments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phòng ban
 *     responses:
 *       200:
 *         description: Xóa thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Phòng ban đã được xóa"
 *       403:
 *         description: Không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Không thể xóa phòng ban có phòng ban con hoặc nhân viên
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

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
