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

/**
 * @swagger
 * tags:
 *   name: Working Hours
 *   description: API quản lý giờ làm việc
 */

/**
 * @swagger
 * /api/working-hours/active:
 *   get:
 *     summary: Lấy cấu hình giờ làm việc hiện tại
 *     tags: [Working Hours]
 *     responses:
 *       200:
 *         description: Lấy cấu hình thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/WorkingHours'
 *       404:
 *         description: Không tìm thấy cấu hình giờ làm việc
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/working-hours/check:
 *   get:
 *     summary: Kiểm tra xem hiện tại có phải giờ làm việc không
 *     tags: [Working Hours]
 *     parameters:
 *       - in: query
 *         name: time
 *         schema:
 *           type: string
 *           format: time
 *         description: Thời gian cần kiểm tra (HH:mm), mặc định là thời gian hiện tại
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày cần kiểm tra (YYYY-MM-DD), mặc định là ngày hiện tại
 *     responses:
 *       200:
 *         description: Kiểm tra thành công
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
 *                     isWorkingTime:
 *                       type: boolean
 *                       example: true
 *                     isWeekend:
 *                       type: boolean
 *                       example: false
 *                     currentTime:
 *                       type: string
 *                       example: "14:30"
 *                     workingHours:
 *                       $ref: '#/components/schemas/WorkingHours'
 */

/**
 * @swagger
 * /api/working-hours/requests-stats:
 *   get:
 *     summary: Lấy thống kê yêu cầu giờ làm việc
 *     tags: [Working Hours]
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
 *                       example: 50
 *                     pending:
 *                       type: integer
 *                       example: 10
 *                     approved:
 *                       type: integer
 *                       example: 35
 *                     rejected:
 *                       type: integer
 *                       example: 5
 */

/**
 * @swagger
 * /api/working-hours:
 *   get:
 *     summary: Lấy danh sách cấu hình giờ làm việc (chỉ Super Admin)
 *     tags: [Working Hours]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Lọc theo trạng thái
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
 *                     $ref: '#/components/schemas/WorkingHours'
 *       403:
 *         description: Chỉ Super Admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Tạo cấu hình giờ làm việc mới (chỉ Super Admin)
 *     tags: [Working Hours]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - startTime
 *               - endTime
 *               - workingDays
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Giờ hành chính"
 *               startTime:
 *                 type: string
 *                 format: time
 *                 example: "08:00"
 *               endTime:
 *                 type: string
 *                 format: time
 *                 example: "17:30"
 *               workingDays:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 7
 *                 example: [1, 2, 3, 4, 5]
 *               breakStartTime:
 *                 type: string
 *                 format: time
 *                 example: "12:00"
 *               breakEndTime:
 *                 type: string
 *                 format: time
 *                 example: "13:00"
 *               description:
 *                 type: string
 *                 example: "Giờ làm việc hành chính từ 8h đến 17h30"
 *     responses:
 *       201:
 *         description: Tạo cấu hình thành công
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
 *                   example: "Tạo cấu hình giờ làm việc thành công"
 *                 data:
 *                   $ref: '#/components/schemas/WorkingHours'
 *       403:
 *         description: Chỉ Super Admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/working-hours/{id}:
 *   get:
 *     summary: Lấy cấu hình giờ làm việc theo ID (chỉ Super Admin)
 *     tags: [Working Hours]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID cấu hình giờ làm việc
 *     responses:
 *       200:
 *         description: Lấy cấu hình thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/WorkingHours'
 *       404:
 *         description: Không tìm thấy cấu hình
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Chỉ Super Admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Cập nhật cấu hình giờ làm việc (chỉ Super Admin)
 *     tags: [Working Hours]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID cấu hình giờ làm việc
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Giờ hành chính mới"
 *               startTime:
 *                 type: string
 *                 format: time
 *                 example: "08:30"
 *               endTime:
 *                 type: string
 *                 format: time
 *                 example: "17:00"
 *               workingDays:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 7
 *                 example: [1, 2, 3, 4, 5, 6]
 *               breakStartTime:
 *                 type: string
 *                 format: time
 *                 example: "12:00"
 *               breakEndTime:
 *                 type: string
 *                 format: time
 *                 example: "13:30"
 *               description:
 *                 type: string
 *                 example: "Cấu hình giờ làm việc đã cập nhật"
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
 *                   example: "Cập nhật cấu hình thành công"
 *                 data:
 *                   $ref: '#/components/schemas/WorkingHours'
 *   delete:
 *     summary: Xóa cấu hình giờ làm việc (chỉ Super Admin)
 *     tags: [Working Hours]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID cấu hình giờ làm việc
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
 *                   example: "Xóa cấu hình thành công"
 *       400:
 *         description: Không thể xóa cấu hình đang hoạt động
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/working-hours/{id}/activate:
 *   put:
 *     summary: Kích hoạt cấu hình giờ làm việc (chỉ Super Admin)
 *     tags: [Working Hours]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID cấu hình giờ làm việc
 *     responses:
 *       200:
 *         description: Kích hoạt thành công
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
 *                   example: "Kích hoạt cấu hình thành công"
 *                 data:
 *                   $ref: '#/components/schemas/WorkingHours'
 *       403:
 *         description: Chỉ Super Admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

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
