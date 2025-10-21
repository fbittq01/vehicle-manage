import express from 'express';
import {
  // Camera CRUD operations
  getCameras,
  getCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
  
  // Camera status and maintenance
  updateCameraStatus,
  addMaintenanceNote,
  scheduleNextMaintenance,
  getCamerasNeedingMaintenance,
  
  // Camera queries and analytics
  getCamerasByGate,
  getCameraStatistics,
  incrementDetection,
  
  // Video streaming operations (integrated from videoStreamController)
  getStreamableCameras,
  startCameraStream,
  stopCameraStream,
  controlCamera,
  getStreamStatus,
  getActiveStreams,
  updateStreamSettings
} from '../controllers/cameraController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';
import { 
  validateCamera, 
  validateUpdateCamera,
  validateVideoStreamRequest,
  validateCameraControl,
  validateStreamSettings
} from '../middleware/validation.js';
import activityMiddleware from '../middleware/activityMiddleware.js';

/**
 * ============================================================================
 * CAMERA ROUTES - TÍCH HợP VIDEO STREAMING
 * ============================================================================
 * 
 * File này chứa tất cả routes liên quan đến camera management và video streaming.
 * 
 * LỊCH SỬ TÍCH HỢP:
 * - Ban đầu: Có 2 controller riêng biệt (cameraController.js và videoStreamController.js)
 * - Bây giờ: Đã gộp tất cả video streaming functions vào cameraController.js
 * - Routes videoStream.js đã được xóa và tích hợp vào file này
 * 
 * PHÂN LOẠI ROUTES:
 * 1. Camera Management: CRUD operations, status, maintenance
 * 2. Video Streaming: stream control, PTZ control, settings
 * 3. Analytics: statistics, monitoring
 * 
 * AUTHENTICATION & AUTHORIZATION:
 * - Tất cả routes yêu cầu authentication
 * - Một số routes yêu cầu admin privileges (create, delete, control)
 * - Activity logging cho audit trail
 * 
 * MIDDLEWARE LAYERS:
 * - authenticateToken: Xác thực JWT token
 * - authorize: Kiểm tra quyền admin/super_admin  
 * - activityMiddleware: Ghi log hoạt động
 * - validation: Validate request data
 * 
 * @author System Integration Team
 * @since 2024-01-15
 * @version 2.0.0 (After video streaming integration)
 */

/**
 * @swagger
 * tags:
 *   name: Cameras
 *   description: API quản lý camera và video streaming (tích hợp từ videoStream)
 */

/**
 * @swagger
 * /api/cameras:
 *   get:
 *     summary: Lấy danh sách camera
 *     tags: [Cameras]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, maintenance]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [entry, exit]
 *         description: Lọc theo loại camera
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo vị trí
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
 *                     $ref: '#/components/schemas/Camera'
 *   post:
 *     summary: Tạo camera mới (chỉ Admin)
 *     tags: [Cameras]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - location
 *               - ipAddress
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Camera Cổng chính"
 *               location:
 *                 type: string
 *                 example: "Cổng chính - Lối vào"
 *               ipAddress:
 *                 type: string
 *                 example: "192.168.1.100"
 *               port:
 *                 type: integer
 *                 example: 8080
 *               type:
 *                 type: string
 *                 enum: [entry, exit]
 *                 example: "entry"
 *               username:
 *                 type: string
 *                 example: "admin"
 *               password:
 *                 type: string
 *                 example: "password123"
 *               description:
 *                 type: string
 *                 example: "Camera giám sát cổng chính"
 *     responses:
 *       201:
 *         description: Tạo camera thành công
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
 *                   example: "Camera đã được tạo thành công"
 *                 data:
 *                   $ref: '#/components/schemas/Camera'
 *       403:
 *         description: Không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/cameras/statistics:
 *   get:
 *     summary: Lấy thống kê camera
 *     tags: [Cameras]
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
 *                       example: 10
 *                     active:
 *                       type: integer
 *                       example: 8
 *                     inactive:
 *                       type: integer
 *                       example: 1
 *                     maintenance:
 *                       type: integer
 *                       example: 1
 *                     byType:
 *                       type: object
 *                       example: {"entry": 6, "exit": 4}
 */

/**
 * @swagger
 * /api/cameras/maintenance:
 *   get:
 *     summary: Lấy danh sách camera cần bảo trì
 *     tags: [Cameras]
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
 *                     $ref: '#/components/schemas/Camera'
 */

/**
 * @swagger
 * /api/cameras/{id}:
 *   get:
 *     summary: Lấy thông tin camera theo ID
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID camera
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
 *                   $ref: '#/components/schemas/Camera'
 *       404:
 *         description: Không tìm thấy camera
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Cập nhật thông tin camera
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID camera
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Camera Cổng phụ"
 *               location:
 *                 type: string
 *                 example: "Cổng phụ - Lối ra"
 *               ipAddress:
 *                 type: string
 *                 example: "192.168.1.101"
 *               port:
 *                 type: integer
 *                 example: 8081
 *               description:
 *                 type: string
 *                 example: "Mô tả camera"
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
 *                   example: "Camera đã được cập nhật"
 *                 data:
 *                   $ref: '#/components/schemas/Camera'
 *   delete:
 *     summary: Xóa camera (chỉ Admin)
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID camera
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
 *                   example: "Camera đã được xóa"
 *       403:
 *         description: Không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/cameras/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái camera
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID camera
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
 *                 enum: [active, inactive, maintenance]
 *                 example: "maintenance"
 *               notes:
 *                 type: string
 *                 example: "Camera bảo trì định kỳ"
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
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
 *                   example: "Trạng thái camera đã được cập nhật"
 *                 data:
 *                   $ref: '#/components/schemas/Camera'
 */

/**
 * @swagger
 * /api/cameras/{id}/maintenance/note:
 *   post:
 *     summary: Thêm ghi chú bảo trì
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID camera
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - note
 *             properties:
 *               note:
 *                 type: string
 *                 example: "Thay thế ống kính camera"
 *               type:
 *                 type: string
 *                 enum: [routine, repair, upgrade]
 *                 example: "repair"
 *     responses:
 *       200:
 *         description: Thêm ghi chú thành công
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
 *                   example: "Ghi chú bảo trì đã được thêm"
 *                 data:
 *                   $ref: '#/components/schemas/Camera'
 */

/**
 * @swagger
 * /api/cameras/{id}/detection:
 *   patch:
 *     summary: Tăng số lần phát hiện (dùng cho AI system)
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID camera
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
 *                   example: "Đã cập nhật số lần phát hiện"
 */

/**
 * @swagger
 * /api/cameras/streamable:
 *   get:
 *     summary: Lấy danh sách cameras có thể stream video
 *     description: |
 *       Trả về danh sách các camera đang hoạt động và có khả năng streaming video.
 *       API này được tích hợp từ video-stream controller vào camera controller.
 *     tags: [Cameras, Video Stream]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: quality
 *         schema:
 *           type: string
 *           enum: [low, medium, high, ultra]
 *         description: Lọc cameras theo chất lượng stream hỗ trợ
 *         example: medium
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Lọc theo vị trí camera
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [entry, exit]
 *         description: Lọc theo loại camera (vào/ra)
 *     responses:
 *       200:
 *         description: Lấy danh sách cameras streaming thành công
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
 *                   example: "Danh sách cameras streaming"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                       name:
 *                         type: string
 *                         example: "Camera Cổng chính"
 *                       description:
 *                         type: string
 *                         example: "Camera giám sát lối vào chính"
 *                       location:
 *                         type: object
 *                         properties:
 *                           gateName:
 *                             type: string
 *                             example: "Cổng chính"
 *                           position:
 *                             type: string
 *                             example: "entry"
 *                       technical:
 *                         type: object
 *                         properties:
 *                           resolution:
 *                             type: object
 *                             properties:
 *                               width:
 *                                 type: number
 *                                 example: 1920
 *                               height:
 *                                 type: number
 *                                 example: 1080
 *                       streaming:
 *                         type: object
 *                         properties:
 *                           enabled:
 *                             type: boolean
 *                             example: true
 *                           quality:
 *                             type: string
 *                             example: "high"
 *                           isStreaming:
 *                             type: boolean
 *                             example: false
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/cameras/streams/active:
 *   get:
 *     summary: Lấy danh sách streams đang hoạt động
 *     description: |
 *       Trả về danh sách tất cả các camera đang streaming video.
 *       Hữu ích để quản lý tài nguyên server và monitoring.
 *     tags: [Cameras, Video Stream]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách streams thành công
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
 *                   example: "Danh sách streams đang hoạt động"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalActiveStreams:
 *                       type: number
 *                       example: 3
 *                     streams:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           cameraId:
 *                             type: string
 *                           cameraName:
 *                             type: string
 *                           quality:
 *                             type: string
 *                           startedAt:
 *                             type: string
 *                             format: date-time
 *                           clients:
 *                             type: number
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/cameras/{id}/stream/status:
 *   get:
 *     summary: Lấy trạng thái stream của camera cụ thể
 *     description: |
 *       Kiểm tra trạng thái streaming hiện tại của một camera cụ thể.
 *       Bao gồm thông tin về chất lượng, số clients đang kết nối, thời gian bắt đầu.
 *     tags: [Cameras, Video Stream]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của camera
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     responses:
 *       200:
 *         description: Lấy trạng thái stream thành công
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
 *                   example: "Trạng thái stream camera"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cameraId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                     cameraName:
 *                       type: string
 *                       example: "Camera Cổng chính"
 *                     isStreaming:
 *                       type: boolean
 *                       example: true
 *                     quality:
 *                       type: string
 *                       example: "high"
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00.000Z"
 *                     clients:
 *                       type: number
 *                       example: 2
 *                     frameRate:
 *                       type: number
 *                       example: 30
 *                     resolution:
 *                       type: object
 *                       properties:
 *                         width:
 *                           type: number
 *                           example: 1920
 *                         height:
 *                           type: number
 *                           example: 1080
 *       404:
 *         description: Camera không tồn tại
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/cameras/{id}/stream/start:
 *   post:
 *     summary: Bắt đầu video stream từ camera
 *     description: |
 *       Khởi động video streaming từ camera được chỉ định.
 *       Gửi command tới Python server để bắt đầu stream với chất lượng tùy chọn.
 *       Camera phải ở trạng thái active và có streaming enabled.
 *     tags: [Cameras, Video Stream]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của camera cần bắt đầu stream
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quality:
 *                 type: string
 *                 enum: [low, medium, high, ultra]
 *                 default: medium
 *                 description: |
 *                   Chất lượng stream:
 *                   - low: 480p, 15fps, thích hợp cho kết nối chậm
 *                   - medium: 720p, 25fps, cân bằng chất lượng và băng thông
 *                   - high: 1080p, 30fps, chất lượng cao
 *                   - ultra: 4K, 60fps, chất lượng tối đa
 *                 example: "high"
 *               autoReconnect:
 *                 type: boolean
 *                 default: true
 *                 description: Tự động kết nối lại khi bị ngắt
 *     responses:
 *       200:
 *         description: Stream đã được bắt đầu thành công
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
 *                   example: "Stream đã được bắt đầu"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cameraId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                     streamStarted:
 *                       type: boolean
 *                       example: true
 *                     quality:
 *                       type: string
 *                       example: "high"
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                     streamUrl:
 *                       type: string
 *                       example: "ws://localhost:3001/stream/camera/60f7b3b3b3b3b3b3b3b3b3b3"
 *       400:
 *         description: Camera không thể stream (inactive hoặc streaming disabled)
 *       404:
 *         description: Camera không tồn tại
 *       503:
 *         description: Python server không khả dụng
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/cameras/{id}/stream/stop:
 *   post:
 *     summary: Dừng video stream từ camera
 *     description: |
 *       Dừng video streaming từ camera được chỉ định.
 *       Gửi command tới Python server để dừng stream và giải phóng tài nguyên.
 *       Cập nhật trạng thái streaming của camera trong database.
 *     tags: [Cameras, Video Stream]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của camera cần dừng stream
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     responses:
 *       200:
 *         description: Stream đã được dừng thành công
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
 *                   example: "Stream đã được dừng"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cameraId:
 *                       type: string
 *                       example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                     streamStopped:
 *                       type: boolean
 *                       example: true
 *                     stoppedAt:
 *                       type: string
 *                       format: date-time
 *                     duration:
 *                       type: string
 *                       description: Thời gian stream (HH:MM:SS)
 *                       example: "02:30:15"
 *       404:
 *         description: Camera không tồn tại
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/cameras/{id}/control:
 *   post:
 *     summary: Điều khiển camera (PTZ - Pan/Tilt/Zoom)
 *     description: |
 *       Gửi lệnh điều khiển tới camera hỗ trợ PTZ (Pan-Tilt-Zoom).
 *       Chỉ Admin và Super Admin mới có quyền điều khiển camera.
 *       Lệnh sẽ được chuyển tiếp tới Python server để thực hiện.
 *     tags: [Cameras, Video Stream]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của camera hỗ trợ PTZ
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - command
 *             properties:
 *               command:
 *                 type: string
 *                 enum: [pan_left, pan_right, tilt_up, tilt_down, zoom_in, zoom_out, preset, home, stop]
 *                 description: |
 *                   Lệnh điều khiển:
 *                   - pan_left: Xoay trái
 *                   - pan_right: Xoay phải  
 *                   - tilt_up: Nghiêng lên
 *                   - tilt_down: Nghiêng xuống
 *                   - zoom_in: Phóng to
 *                   - zoom_out: Thu nhỏ
 *                   - preset: Chuyển tới vị trí preset
 *                   - home: Về vị trí ban đầu
 *                   - stop: Dừng chuyển động
 *                 example: "pan_right"
 *               value:
 *                 type: number
 *                 description: |
 *                   Giá trị điều khiển (tùy thuộc vào command):
 *                   - Với pan/tilt: tốc độ (1-100)
 *                   - Với zoom: mức zoom (1-10)
 *                   - Với preset: số preset (1-255)
 *                 minimum: 1
 *                 maximum: 255
 *                 example: 50
 *               duration:
 *                 type: number
 *                 description: Thời gian thực hiện lệnh (giây)
 *                 minimum: 0.1
 *                 maximum: 30
 *                 default: 1
 *                 example: 2.5
 *     responses:
 *       200:
 *         description: Lệnh điều khiển đã được gửi thành công
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
 *                   example: "Lệnh điều khiển đã được gửi"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cameraId:
 *                       type: string
 *                     command:
 *                       type: string
 *                     value:
 *                       type: number
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Camera không hỗ trợ PTZ hoặc tham số không hợp lệ
 *       403:
 *         description: Không có quyền điều khiển camera
 *       404:
 *         description: Camera không tồn tại
 *       503:
 *         description: Python server không khả dụng
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/cameras/{id}/stream/settings:
 *   put:
 *     summary: Cập nhật cài đặt stream cho camera
 *     description: |
 *       Cập nhật các thông số streaming cho camera.
 *       Nếu camera đang stream, thay đổi sẽ được áp dụng ngay lập tức.
 *       Gửi update settings tới Python server nếu camera đang hoạt động.
 *     tags: [Cameras, Video Stream]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của camera cần cập nhật settings
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quality:
 *                 type: string
 *                 enum: [low, medium, high, ultra]
 *                 description: Preset chất lượng stream
 *                 example: "high"
 *               streamEnabled:
 *                 type: boolean
 *                 description: Bật/tắt khả năng streaming
 *                 example: true
 *               frameRate:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 60
 *                 description: Tốc độ khung hình (fps)
 *                 example: 30
 *               resolution:
 *                 type: object
 *                 description: Độ phân giải video
 *                 properties:
 *                   width:
 *                     type: number
 *                     minimum: 320
 *                     maximum: 3840
 *                     example: 1920
 *                   height:
 *                     type: number
 *                     minimum: 240
 *                     maximum: 2160
 *                     example: 1080
 *               bitrate:
 *                 type: number
 *                 minimum: 100
 *                 maximum: 50000
 *                 description: Tốc độ bit (kbps)
 *                 example: 2000
 *               maxClients:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Số client tối đa có thể kết nối đồng thời
 *                 example: 10
 *     responses:
 *       200:
 *         description: Cài đặt stream đã được cập nhật thành công
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
 *                   example: "Cài đặt stream đã được cập nhật"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cameraId:
 *                       type: string
 *                     settings:
 *                       type: object
 *                       properties:
 *                         quality:
 *                           type: string
 *                         streamEnabled:
 *                           type: boolean
 *                         frameRate:
 *                           type: number
 *                         resolution:
 *                           type: object
 *                           properties:
 *                             width:
 *                               type: number
 *                             height:
 *                               type: number
 *                         bitrate:
 *                           type: number
 *                         maxClients:
 *                           type: number
 *       400:
 *         description: Tham số không hợp lệ
 *       404:
 *         description: Camera không tồn tại
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

const router = express.Router();

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================
// Áp dụng middleware xác thực cho tất cả routes cameras
router.use(authenticateToken);

// ============================================================================
// CAMERA MANAGEMENT ROUTES (General)  
// ============================================================================

// GET /api/cameras - Lấy danh sách tất cả cameras với filter
router.get('/', activityMiddleware('VIEW_CAMERA', 'cameras'), getCameras);

// GET /api/cameras/statistics - Lấy thống kê tổng quan cameras  
router.get('/statistics', activityMiddleware('VIEW_ANALYTICS', 'cameras'), getCameraStatistics);

// GET /api/cameras/maintenance - Lấy danh sách cameras cần bảo trì
router.get('/maintenance', activityMiddleware('VIEW_CAMERA', 'cameras'), getCamerasNeedingMaintenance);

// ============================================================================
// VIDEO STREAMING ROUTES (General - Integrated from videoStream.js)
// ============================================================================

// GET /api/cameras/streamable - Lấy danh sách cameras có khả năng streaming
router.get('/streamable', activityMiddleware('VIEW_CAMERA', 'cameras'), getStreamableCameras);

// GET /api/cameras/streams/active - Lấy danh sách streams đang hoạt động
router.get('/streams/active', activityMiddleware('VIEW_CAMERA', 'cameras'), getActiveStreams);

// ============================================================================
// CAMERA CRUD OPERATIONS (Specific Camera by ID)
// ============================================================================

// GET /api/cameras/:id - Lấy thông tin chi tiết một camera
router.get('/:id', activityMiddleware('VIEW_CAMERA', 'cameras'), getCameraById);

// POST /api/cameras - Tạo camera mới (Admin only)
router.post('/', validateCamera, authorize('admin', 'super_admin'), activityMiddleware('CREATE_CAMERA', 'cameras'), createCamera);

// PUT /api/cameras/:id - Cập nhật thông tin camera
router.put('/:id', validateUpdateCamera, activityMiddleware('UPDATE_CAMERA', 'cameras'), updateCamera);

// DELETE /api/cameras/:id - Xóa camera (Admin only)
router.delete('/:id', authorize('admin', 'super_admin'), activityMiddleware('DELETE_CAMERA', 'cameras'), deleteCamera);

// ============================================================================
// CAMERA STATUS & MAINTENANCE OPERATIONS  
// ============================================================================

// PATCH /api/cameras/:id/status - Cập nhật trạng thái camera (active/inactive/maintenance)
router.patch('/:id/status', activityMiddleware('UPDATE_CAMERA', 'cameras'), updateCameraStatus);

// POST /api/cameras/:id/maintenance/note - Thêm ghi chú bảo trì
router.post('/:id/maintenance/note', activityMiddleware('UPDATE_CAMERA', 'cameras'), addMaintenanceNote);

// PATCH /api/cameras/:id/maintenance/schedule - Lên lịch bảo trì định kỳ (Admin only)
router.patch('/:id/maintenance/schedule', authorize(['admin', 'super_admin']), activityMiddleware('UPDATE_CAMERA', 'cameras'), scheduleNextMaintenance);

// PATCH /api/cameras/:id/detection - Tăng counter phát hiện (dùng cho AI system)
router.patch('/:id/detection', incrementDetection);

// ============================================================================
// VIDEO STREAMING OPERATIONS (Specific Camera - Integrated from videoStream.js)
// ============================================================================

// GET /api/cameras/:id/stream/status - Lấy trạng thái streaming của camera cụ thể
router.get('/:id/stream/status', activityMiddleware('VIEW_CAMERA', 'cameras'), getStreamStatus);

// POST /api/cameras/:id/stream/start - Bắt đầu video stream từ camera
router.post('/:id/stream/start', validateVideoStreamRequest, activityMiddleware('UPDATE_CAMERA', 'cameras'), startCameraStream);

// POST /api/cameras/:id/stream/stop - Dừng video stream từ camera  
router.post('/:id/stream/stop', activityMiddleware('UPDATE_CAMERA', 'cameras'), stopCameraStream);

// POST /api/cameras/:id/control - Điều khiển camera PTZ (Admin only)
router.post('/:id/control', validateCameraControl, authorize(['admin', 'super_admin']), activityMiddleware('CONTROL_CAMERA', 'cameras'), controlCamera);

// PUT /api/cameras/:id/stream/settings - Cập nhật cài đặt streaming cho camera
router.put('/:id/stream/settings', validateStreamSettings, activityMiddleware('UPDATE_CAMERA', 'cameras'), updateStreamSettings);

// ============================================================================
// CAMERA QUERY BY LOCATION
// ============================================================================

// GET /api/cameras/gate/:gateId - Lấy danh sách cameras theo cổng/gate cụ thể
router.get('/gate/:gateId', activityMiddleware('VIEW_CAMERA', 'cameras'), getCamerasByGate);

// ============================================================================
// EXPORT ROUTER
// ============================================================================
/**
 * Export camera routes với video streaming đã được tích hợp
 * 
 * USAGE EXAMPLE:
 * ```javascript
 * import cameraRoutes from './routes/cameras.js';
 * app.use('/api/cameras', cameraRoutes);
 * ```
 * 
 * API ENDPOINTS AVAILABLE:
 * - Camera CRUD: GET, POST, PUT, DELETE /api/cameras
 * - Video Streaming: /api/cameras/:id/stream/*
 * - Camera Control: /api/cameras/:id/control  
 * - Maintenance: /api/cameras/:id/maintenance/*
 * - Analytics: /api/cameras/statistics
 * 
 * @module CameraRoutes
 * @requires express
 * @requires cameraController (integrated with video streaming functions)
 */
export default router;
