import express from 'express';
import {
  getVehicles,
  getVehicleById,
  getVehicleByLicensePlate,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  activateVehicle,
  getMyVehicles,
  getVehicleStats
} from '../controllers/vehicleController.js';
import {
  authenticateToken,
  requireAdmin,
  requireOwnershipOrAdmin
} from '../middleware/auth.js';
import {
  validateVehicle,
  validateUpdateVehicle
} from '../middleware/validation.js';

/**
 * @swagger
 * tags:
 *   name: Vehicles
 *   description: API quản lý phương tiện
 */

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: Lấy danh sách phương tiện
 *     tags: [Vehicles]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo biển số hoặc tên chủ xe
 *       - in: query
 *         name: vehicleType
 *         schema:
 *           type: string
 *         description: Lọc theo loại xe
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Lọc theo phòng ban
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, blocked]
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
 *                   type: object
 *                   properties:
 *                     vehicles:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vehicle'
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
 *     summary: Tạo phương tiện mới
 *     tags: [Vehicles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licensePlate
 *               - ownerName
 *               - vehicleType
 *             properties:
 *               licensePlate:
 *                 type: string
 *                 example: "29A-12345"
 *               ownerName:
 *                 type: string
 *                 example: "Nguyễn Văn A"
 *               ownerPhone:
 *                 type: string
 *                 example: "0123456789"
 *               vehicleType:
 *                 type: string
 *                 example: "car"
 *               departmentId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               notes:
 *                 type: string
 *                 example: "Ghi chú về xe"
 *     responses:
 *       201:
 *         description: Tạo phương tiện thành công
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
 *                   example: "Tạo phương tiện thành công"
 *                 data:
 *                   $ref: '#/components/schemas/Vehicle'
 */

/**
 * @swagger
 * /api/vehicles/my-vehicles:
 *   get:
 *     summary: Lấy danh sách phương tiện của tôi
 *     tags: [Vehicles]
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
 *                     $ref: '#/components/schemas/Vehicle'
 */

/**
 * @swagger
 * /api/vehicles/stats:
 *   get:
 *     summary: Lấy thống kê phương tiện
 *     tags: [Vehicles]
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
 *                       example: 500
 *                     active:
 *                       type: integer
 *                       example: 450
 *                     inactive:
 *                       type: integer
 *                       example: 30
 *                     blocked:
 *                       type: integer
 *                       example: 20
 *                     byType:
 *                       type: object
 *                       example: {"car": 300, "motorcycle": 150, "truck": 50}
 */

/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: Lấy thông tin phương tiện theo ID
 *     tags: [Vehicles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phương tiện
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
 *                   $ref: '#/components/schemas/Vehicle'
 *       404:
 *         description: Không tìm thấy phương tiện
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Cập nhật thông tin phương tiện
 *     tags: [Vehicles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phương tiện
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ownerName:
 *                 type: string
 *                 example: "Nguyễn Văn B"
 *               ownerPhone:
 *                 type: string
 *                 example: "0987654321"
 *               vehicleType:
 *                 type: string
 *                 example: "motorcycle"
 *               departmentId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
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
 *                   example: "Cập nhật phương tiện thành công"
 *                 data:
 *                   $ref: '#/components/schemas/Vehicle'
 *   delete:
 *     summary: Xóa phương tiện
 *     tags: [Vehicles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phương tiện
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
 *                   example: "Xóa phương tiện thành công"
 */

/**
 * @swagger
 * /api/vehicles/license-plate/{licensePlate}:
 *   get:
 *     summary: Tìm phương tiện theo biển số
 *     tags: [Vehicles]
 *     parameters:
 *       - in: path
 *         name: licensePlate
 *         required: true
 *         schema:
 *           type: string
 *         description: Biển số xe (ví dụ 29A-12345)
 *         example: "29A-12345"
 *     responses:
 *       200:
 *         description: Tìm thấy phương tiện
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Vehicle'
 *       404:
 *         description: Không tìm thấy phương tiện
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/vehicles/{id}/activate:
 *   put:
 *     summary: Kích hoạt/vô hiệu hóa phương tiện
 *     tags: [Vehicles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phương tiện
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
 *                 enum: [active, inactive, blocked]
 *                 example: "active"
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
 *                   example: "Cập nhật trạng thái phương tiện thành công"
 *                 data:
 *                   $ref: '#/components/schemas/Vehicle'
 */

const router = express.Router();

// Tất cả routes cần authentication
router.use(authenticateToken);

// Public routes (authenticated users)
router.get('/my-vehicles', getMyVehicles);
router.get('/stats', getVehicleStats);

// CRUD routes
router.get('/', getVehicles);
router.get('/:id', getVehicleById);
router.get('/license-plate/:licensePlate', getVehicleByLicensePlate);
router.post('/', validateVehicle, createVehicle);
router.put('/:id', validateUpdateVehicle, updateVehicle);
router.delete('/:id', deleteVehicle);
router.put('/:id/activate', activateVehicle);

export default router;
