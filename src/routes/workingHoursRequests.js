import express from 'express';
import {
  getWorkingHoursRequests,
  getWorkingHoursRequestById,
  createWorkingHoursRequest,
  updateWorkingHoursRequest,
  cancelWorkingHoursRequest,
  approveWorkingHoursRequest,
  rejectWorkingHoursRequest,
  getPendingRequests,
  getRequestsStats
} from '../controllers/workingHoursRequestController.js';
import {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin
} from '../middleware/auth.js';
import {
  validateWorkingHoursRequest,
  validateUpdateWorkingHoursRequest,
  validateWorkingHoursRequestParams,
  validateWorkingHoursRequestQuery,
  validateApprovalRequest
} from '../middleware/validation.js';

/**
 * @swagger
 * tags:
 *   name: Working Hours Requests
 *   description: API quản lý yêu cầu giờ làm việc
 */

/**
 * @swagger
 * /api/working-hours-requests/my-requests:
 *   get:
 *     summary: Lấy danh sách yêu cầu của tôi
 *     tags: [Working Hours Requests]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: requestType
 *         schema:
 *           type: string
 *           enum: [leave, overtime, adjustment]
 *         description: Lọc theo loại yêu cầu
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày bắt đầu lọc
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày kết thúc lọc
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
 *                     $ref: '#/components/schemas/WorkingHoursRequest'
 */

/**
 * @swagger
 * /api/working-hours-requests:
 *   get:
 *     summary: Lấy danh sách tất cả yêu cầu (chỉ Admin)
 *     tags: [Working Hours Requests]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Lọc theo người dùng
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: requestType
 *         schema:
 *           type: string
 *           enum: [leave, overtime, adjustment]
 *         description: Lọc theo loại yêu cầu
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày bắt đầu lọc
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày kết thúc lọc
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
 *                     requests:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WorkingHoursRequest'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *                         total:
 *                           type: integer
 *       403:
 *         description: Chỉ Admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Tạo yêu cầu giờ làm việc mới
 *     tags: [Working Hours Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestType
 *               - startDate
 *               - endDate
 *               - reason
 *             properties:
 *               requestType:
 *                 type: string
 *                 enum: [leave, overtime, adjustment]
 *                 example: "leave"
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-01-20"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-01-21"
 *               reason:
 *                 type: string
 *                 example: "Nghỉ phép cá nhân"
 *               startTime:
 *                 type: string
 *                 format: time
 *                 example: "14:00"
 *               endTime:
 *                 type: string
 *                 format: time
 *                 example: "18:00"
 *               notes:
 *                 type: string
 *                 example: "Ghi chú thêm"
 *     responses:
 *       201:
 *         description: Tạo yêu cầu thành công
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
 *                   example: "Tạo yêu cầu thành công"
 *                 data:
 *                   $ref: '#/components/schemas/WorkingHoursRequest'
 */

/**
 * @swagger
 * /api/working-hours-requests/pending/list:
 *   get:
 *     summary: Lấy danh sách yêu cầu chờ duyệt (chỉ Admin)
 *     tags: [Working Hours Requests]
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
 *                     $ref: '#/components/schemas/WorkingHoursRequest'
 *       403:
 *         description: Chỉ Admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/working-hours-requests/stats/overview:
 *   get:
 *     summary: Lấy thống kê tổng quan yêu cầu (chỉ Admin)
 *     tags: [Working Hours Requests]
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
 *                     pending:
 *                       type: integer
 *                       example: 20
 *                     approved:
 *                       type: integer
 *                       example: 100
 *                     rejected:
 *                       type: integer
 *                       example: 30
 *                     byType:
 *                       type: object
 *                       example: {"leave": 80, "overtime": 50, "adjustment": 20}
 */

/**
 * @swagger
 * /api/working-hours-requests/{id}:
 *   get:
 *     summary: Lấy thông tin yêu cầu theo ID
 *     tags: [Working Hours Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID yêu cầu
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
 *                   $ref: '#/components/schemas/WorkingHoursRequest'
 *       404:
 *         description: Không tìm thấy yêu cầu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Cập nhật yêu cầu (chỉ khi đang chờ duyệt)
 *     tags: [Working Hours Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID yêu cầu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requestType:
 *                 type: string
 *                 enum: [leave, overtime, adjustment]
 *                 example: "overtime"
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-01-22"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-01-22"
 *               reason:
 *                 type: string
 *                 example: "Làm thêm giờ để hoàn thành dự án"
 *               startTime:
 *                 type: string
 *                 format: time
 *                 example: "18:00"
 *               endTime:
 *                 type: string
 *                 format: time
 *                 example: "22:00"
 *               notes:
 *                 type: string
 *                 example: "Cập nhật ghi chú"
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
 *                   example: "Cập nhật yêu cầu thành công"
 *                 data:
 *                   $ref: '#/components/schemas/WorkingHoursRequest'
 *   delete:
 *     summary: Hủy yêu cầu (chỉ khi đang chờ duyệt)
 *     tags: [Working Hours Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID yêu cầu
 *     responses:
 *       200:
 *         description: Hủy yêu cầu thành công
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
 *                   example: "Hủy yêu cầu thành công"
 */

/**
 * @swagger
 * /api/working-hours-requests/{id}/approve:
 *   put:
 *     summary: Phê duyệt yêu cầu (chỉ Admin)
 *     tags: [Working Hours Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID yêu cầu
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               approvalNotes:
 *                 type: string
 *                 example: "Đã phê duyệt yêu cầu"
 *     responses:
 *       200:
 *         description: Phê duyệt thành công
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
 *                   example: "Phê duyệt yêu cầu thành công"
 *                 data:
 *                   $ref: '#/components/schemas/WorkingHoursRequest'
 *       403:
 *         description: Chỉ Admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/working-hours-requests/{id}/reject:
 *   put:
 *     summary: Từ chối yêu cầu (chỉ Admin)
 *     tags: [Working Hours Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID yêu cầu
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 example: "Không đủ điều kiện phê duyệt"
 *     responses:
 *       200:
 *         description: Từ chối thành công
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
 *                   example: "Từ chối yêu cầu thành công"
 *                 data:
 *                   $ref: '#/components/schemas/WorkingHoursRequest'
 *       403:
 *         description: Chỉ Admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// User routes - người dùng có thể tạo và quản lý yêu cầu của mình
router.get('/my-requests', validateWorkingHoursRequestQuery, getWorkingHoursRequests);
router.post('/', validateWorkingHoursRequest, createWorkingHoursRequest);
router.get('/:id', validateWorkingHoursRequestParams, getWorkingHoursRequestById);
router.put('/:id', validateWorkingHoursRequestParams, validateUpdateWorkingHoursRequest, updateWorkingHoursRequest);
router.delete('/:id', validateWorkingHoursRequestParams, cancelWorkingHoursRequest);

// Admin routes - quản lý và phê duyệt yêu cầu
router.use(requireAdmin);

router.get('/', validateWorkingHoursRequestQuery, getWorkingHoursRequests);
router.get('/pending/list', getPendingRequests);
router.get('/stats/overview', getRequestsStats);
router.put('/:id/approve', validateWorkingHoursRequestParams, validateApprovalRequest, approveWorkingHoursRequest);
router.put('/:id/reject', validateWorkingHoursRequestParams, validateApprovalRequest, rejectWorkingHoursRequest);

export default router;
