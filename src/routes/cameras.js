import express from 'express';
import {
  getCameras,
  getCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
  updateCameraStatus,
  addMaintenanceNote,
  scheduleNextMaintenance,
  getCamerasByGate,
  getCamerasNeedingMaintenance,
  getCameraStatistics,
  incrementDetection
} from '../controllers/cameraController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';
import { validateCamera, validateUpdateCamera } from '../middleware/validation.js';

/**
 * @swagger
 * tags:
 *   name: Cameras
 *   description: API quản lý camera
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

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả routes
router.use(authenticateToken);

// Routes chung
router.get('/', getCameras);
router.get('/statistics', getCameraStatistics);
router.get('/maintenance', getCamerasNeedingMaintenance);

// Routes theo ID
router.get('/:id', getCameraById);
router.post('/', validateCamera, authorize(['admin', 'super_admin']), createCamera);
router.put('/:id', validateUpdateCamera, updateCamera);
router.delete('/:id', authorize(['admin', 'super_admin']), deleteCamera);

// Routes chức năng đặc biệt
router.patch('/:id/status', updateCameraStatus);
router.post('/:id/maintenance/note', addMaintenanceNote);
router.patch('/:id/maintenance/schedule', authorize(['admin', 'super_admin']), scheduleNextMaintenance);
router.patch('/:id/detection', incrementDetection);

// Routes theo cổng
router.get('/gate/:gateId', getCamerasByGate);

export default router;
