import express from 'express';
import {
  getAccessLogs,
  getAccessLogById,
  createAccessLog,
  verifyAccessLog,
  updateGuestInfo,
  getLogsByLicensePlate,
  getLogsByGuestInfo,
  getLogsByDateRange,
  getDailyStats,
  getPendingLogs,
  getVehiclesInside,
  deleteAccessLog,
  getReports,
  getWorkingHoursStats,
  getWorkingHoursViolations,
  getUserWorkingHoursReport
} from '../controllers/accessLogController.js';
import {
  authenticateToken,
  requireAdmin,
  optionalAuth
} from '../middleware/auth.js';
import {
  validateAccessLog
} from '../middleware/validation.js';
import {
  recognitionLimiter
} from '../middleware/rateLimiter.js';
import activityMiddleware from '../middleware/activityMiddleware.js';
import {
  parseAccessLogFormData
} from '../middleware/formDataParser.js';

/**
 * @swagger
 * tags:
 *   name: Access Logs
 *   description: API quản lý nhật ký ra vào
 */

/**
 * @swagger
 * /api/access-logs:
 *   get:
 *     summary: Lấy danh sách nhật ký ra vào
 *     tags: [Access Logs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng bản ghi mỗi trang
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [entry, exit]
 *         description: Lọc theo loại (vào/ra)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [authorized, unauthorized, pending]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày bắt đầu (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày kết thúc (YYYY-MM-DD)
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
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AccessLog'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *                         total:
 *                           type: integer
 *   post:
 *     summary: Tạo nhật ký ra vào mới (cho hệ thống AI)
 *     tags: [Access Logs]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - licensePlate
 *               - type
 *               - cameraId
 *             properties:
 *               licensePlate:
 *                 type: string
 *                 example: "29A-12345"
 *               type:
 *                 type: string
 *                 enum: [entry, exit]
 *                 example: "entry"
 *               cameraId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Hình ảnh từ camera
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-01-15T08:30:00.000Z"
 *     responses:
 *       201:
 *         description: Tạo nhật ký thành công
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
 *                   example: "Nhật ký ra vào đã được tạo"
 *                 data:
 *                   $ref: '#/components/schemas/AccessLog'
 */

/**
 * @swagger
 * /api/access-logs/stats/daily:
 *   get:
 *     summary: Lấy thống kê theo ngày
 *     tags: [Access Logs]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày cần thống kê (YYYY-MM-DD), mặc định là hôm nay
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
 *                       example: 150
 *                     entry:
 *                       type: integer
 *                       example: 80
 *                     exit:
 *                       type: integer
 *                       example: 70
 *                     authorized:
 *                       type: integer
 *                       example: 120
 *                     unauthorized:
 *                       type: integer
 *                       example: 20
 *                     pending:
 *                       type: integer
 *                       example: 10
 */

/**
 * @swagger
 * /api/access-logs/stats/working-hours:
 *   get:
 *     summary: Lấy thống kê giờ làm việc
 *     tags: [Access Logs]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: ID người dùng
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày bắt đầu
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày kết thúc
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
 */

/**
 * @swagger
 * /api/access-logs/pending:
 *   get:
 *     summary: Lấy danh sách nhật ký chờ xác minh
 *     tags: [Access Logs]
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
 *                     $ref: '#/components/schemas/AccessLog'
 */

/**
 * @swagger
 * /api/access-logs/vehicles-inside:
 *   get:
 *     summary: Lấy danh sách xe đang trong khu vực
 *     tags: [Access Logs]
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
 *                     $ref: '#/components/schemas/AccessLog'
 */

/**
 * @swagger
 * /api/access-logs/license-plate/{licensePlate}:
 *   get:
 *     summary: Lấy nhật ký theo biển số xe
 *     tags: [Access Logs]
 *     parameters:
 *       - in: path
 *         name: licensePlate
 *         required: true
 *         schema:
 *           type: string
 *         description: Biển số xe
 *         example: "29A-12345"
 *     responses:
 *       200:
 *         description: Lấy nhật ký thành công
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
 *                     $ref: '#/components/schemas/AccessLog'
 */

/**
 * @swagger
 * /api/access-logs/{id}:
 *   get:
 *     summary: Lấy thông tin nhật ký theo ID
 *     tags: [Access Logs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID nhật ký
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
 *                   $ref: '#/components/schemas/AccessLog'
 *   delete:
 *     summary: Xóa nhật ký (chỉ Admin)
 *     tags: [Access Logs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID nhật ký
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
 *                   example: "Xóa nhật ký thành công"
 */

/**
 * @swagger
 * /api/access-logs/{id}/verify:
 *   put:
 *     summary: Xác minh nhật ký (chỉ Admin)
 *     tags: [Access Logs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID nhật ký
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [authorized, unauthorized]
 *                 example: "authorized"
 *               notes:
 *                 type: string
 *                 example: "Đã xác minh"
 *     responses:
 *       200:
 *         description: Xác minh thành công
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
 *                   example: "Xác minh nhật ký thành công"
 *                 data:
 *                   $ref: '#/components/schemas/AccessLog'
 */

const router = express.Router();

// Public route for AI system to create logs
router.post('/', recognitionLimiter, parseAccessLogFormData, validateAccessLog, createAccessLog);

// Protected routes
router.use(authenticateToken);

// General routes
router.get('/', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getAccessLogs);
router.get('/stats/daily', activityMiddleware('VIEW_ANALYTICS', 'access_logs'), getDailyStats);
router.get('/stats/working-hours', activityMiddleware('VIEW_ANALYTICS', 'access_logs'), getWorkingHoursStats);
router.get('/stats/violations', activityMiddleware('VIEW_ANALYTICS', 'access_logs'), getWorkingHoursViolations);
router.get('/reports', requireAdmin, activityMiddleware('VIEW_REPORT', 'access_logs'), getReports);
router.get('/pending', requireAdmin, activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getPendingLogs);
router.get('/vehicles-inside', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getVehiclesInside);
router.get('/date-range', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getLogsByDateRange);
router.get('/license-plate/:licensePlate', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getLogsByLicensePlate);
router.get('/guest-search', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getLogsByGuestInfo);
router.get('/user/:userId/working-hours-report', activityMiddleware('VIEW_REPORT', 'access_logs'), getUserWorkingHoursReport);
router.get('/:id', activityMiddleware('VIEW_ACCESS_LOG', 'access_logs'), getAccessLogById);

// Admin only routes
router.put('/:id/verify', requireAdmin, activityMiddleware('UPDATE_ACCESS_LOG', 'access_logs'), verifyAccessLog);
router.put('/:id/guest-info', requireAdmin, activityMiddleware('UPDATE_ACCESS_LOG', 'access_logs'), updateGuestInfo);
router.delete('/:id', requireAdmin, activityMiddleware('DELETE_ACCESS_LOG', 'access_logs'), deleteAccessLog);

export default router;
