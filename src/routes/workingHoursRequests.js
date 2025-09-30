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
import activityMiddleware from '../middleware/activityMiddleware.js';

/**
 * @swagger
 * tags:
 *   name: Working Hours Requests
 *   description: API quản lý yêu cầu ra/vào ngoài giờ hành chính
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
 *           enum: [pending, approved, rejected, expired, used]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: requestType
 *         schema:
 *           type: string
 *           enum: [entry, exit, both]
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
 *         name: requestedBy
 *         schema:
 *           type: string
 *         description: Lọc theo người dùng
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, expired, used]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: requestType
 *         schema:
 *           type: string
 *           enum: [entry, exit, both]
 *         description: Lọc theo loại yêu cầu
 *       - in: query
 *         name: licensePlate
 *         schema:
 *           type: string
 *         description: Lọc theo biển số xe
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
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WorkingHoursRequest'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       403:
 *         description: Chỉ Admin mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Tạo yêu cầu ra/vào ngoài giờ hành chính
 *     tags: [Working Hours Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestType
 *               - plannedDateTime
 *               - licensePlate
 *               - reason
 *             properties:
 *               requestType:
 *                 type: string
 *                 enum: [entry, exit, both]
 *                 example: "entry"
 *                 description: Loại yêu cầu - entry (vào), exit (ra), both (cả vào và ra)
 *               plannedDateTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-01-20T07:30:00.000Z"
 *                 description: Thời gian dự kiến ra/vào
 *               plannedEndDateTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-01-20T18:30:00.000Z"
 *                 description: Thời gian dự kiến kết thúc (bắt buộc khi requestType = both)
 *               licensePlate:
 *                 type: string
 *                 example: "30A-123.45"
 *                 description: Biển số xe (định dạng 30A-123.45 hoặc 30A12345)
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 example: "Có việc khẩn cấp cần đến sớm để chuẩn bị họp với khách hàng"
 *                 description: Lý do yêu cầu (ít nhất 10 ký tự)
 *               requestedBy:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *                 description: ID người được yêu cầu (chỉ admin có thể sử dụng để tạo thay mặt)
 *               metadata:
 *                 type: object
 *                 properties:
 *                   emergencyContact:
 *                     type: string
 *                     example: "0912345678"
 *                   vehicleInfo:
 *                     type: string
 *                     example: "Honda City màu trắng"
 *                 description: Thông tin bổ sung
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
 *                   example: "Tạo yêu cầu đăng ký thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     request:
 *                       $ref: '#/components/schemas/WorkingHoursRequest'
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
 *                     totalRequests:
 *                       type: integer
 *                       example: 150
 *                     statusStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "pending"
 *                           count:
 *                             type: integer
 *                             example: 20
 *                     typeStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "entry"
 *                           count:
 *                             type: integer
 *                             example: 60
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
 *                   type: object
 *                   properties:
 *                     request:
 *                       $ref: '#/components/schemas/WorkingHoursRequest'
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
 *               plannedDateTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-01-22T08:00:00.000Z"
 *                 description: Thời gian dự kiến ra/vào mới
 *               plannedEndDateTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-01-22T18:00:00.000Z"
 *                 description: Thời gian dự kiến kết thúc mới (cho requestType = both)
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 example: "Cập nhật lý do: Cần đến sớm để chuẩn bị presentation"
 *                 description: Lý do yêu cầu mới
 *               metadata:
 *                 type: object
 *                 properties:
 *                   emergencyContact:
 *                     type: string
 *                   vehicleInfo:
 *                     type: string
 *                 description: Cập nhật thông tin bổ sung
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
 *                   example: "Cập nhật yêu cầu đăng ký thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     request:
 *                       $ref: '#/components/schemas/WorkingHoursRequest'
 *   delete:
 *     summary: Hủy yêu cầu (chỉ khi đang chờ duyệt hoặc đã phê duyệt)
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
 *                   example: "Hủy yêu cầu đăng ký thành công"
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
 *               approvalNote:
 *                 type: string
 *                 maxLength: 300
 *                 example: "Phê duyệt do có việc khẩn cấp"
 *                 description: Ghi chú phê duyệt
 *               validHours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 168
 *                 default: 24
 *                 example: 24
 *                 description: Thời gian hiệu lực (giờ), mặc định 24 giờ
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
 *                   type: object
 *                   properties:
 *                     request:
 *                       $ref: '#/components/schemas/WorkingHoursRequest'
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
 *               approvalNote:
 *                 type: string
 *                 maxLength: 300
 *                 example: "Từ chối do không đủ điều kiện phê duyệt"
 *                 description: Ghi chú từ chối (sử dụng approvalNote, không phải rejectionReason)
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
 *                   type: object
 *                   properties:
 *                     request:
 *                       $ref: '#/components/schemas/WorkingHoursRequest'
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
router.get('/my-requests', validateWorkingHoursRequestQuery, activityMiddleware('VIEW_WORKING_HOURS_REQUEST', 'working_hours_requests'), getWorkingHoursRequests);
router.post('/', validateWorkingHoursRequest, activityMiddleware('CREATE_WORKING_HOURS_REQUEST', 'working_hours_requests'), createWorkingHoursRequest);
router.get('/:id', validateWorkingHoursRequestParams, activityMiddleware('VIEW_WORKING_HOURS_REQUEST', 'working_hours_requests'), getWorkingHoursRequestById);
router.put('/:id', validateWorkingHoursRequestParams, validateUpdateWorkingHoursRequest, activityMiddleware('UPDATE_WORKING_HOURS_REQUEST', 'working_hours_requests'), updateWorkingHoursRequest);
router.delete('/:id', validateWorkingHoursRequestParams, activityMiddleware('DELETE_WORKING_HOURS_REQUEST', 'working_hours_requests'), cancelWorkingHoursRequest);

// Admin routes - quản lý và phê duyệt yêu cầu
router.use(requireAdmin);

router.get('/', validateWorkingHoursRequestQuery, activityMiddleware('VIEW_WORKING_HOURS_REQUEST', 'working_hours_requests'), getWorkingHoursRequests);
router.get('/pending/list', activityMiddleware('VIEW_WORKING_HOURS_REQUEST', 'working_hours_requests'), getPendingRequests);
router.get('/stats/overview', activityMiddleware('VIEW_ANALYTICS', 'working_hours_requests'), getRequestsStats);
router.put('/:id/approve', validateWorkingHoursRequestParams, validateApprovalRequest, activityMiddleware('APPROVE_WORKING_HOURS_REQUEST', 'working_hours_requests'), approveWorkingHoursRequest);
router.put('/:id/reject', validateWorkingHoursRequestParams, validateApprovalRequest, activityMiddleware('REJECT_WORKING_HOURS_REQUEST', 'working_hours_requests'), rejectWorkingHoursRequest);

export default router;
