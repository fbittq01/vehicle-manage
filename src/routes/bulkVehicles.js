import express from 'express';
import {
  getVehicleTemplate,
  bulkUploadVehicles
} from '../controllers/bulkVehicleController.js';
import {
  authenticateToken,
  requireAdmin
} from '../middleware/auth.js';
import { uploadExcelFile } from '../middleware/formDataParser.js';
import activityMiddleware from '../middleware/activityMiddleware.js';

/**
 * @swagger
 * tags:
 *   name: Bulk Vehicles
 *   description: API quản lý bulk upload phương tiện từ file Excel
 */

const router = express.Router();

/**
 * @swagger
 * /api/bulk-vehicles/template:
 *   get:
 *     summary: Tải file Excel mẫu cho bulk upload vehicles
 *     tags: [Bulk Vehicles]
 *     responses:
 *       200:
 *         description: Tải file mẫu thành công
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             description: attachment; filename=vehicle_template.xlsx
 *             schema:
 *               type: string
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// Route để tải file Excel mẫu
router.get('/template', 
  activityMiddleware('EXPORT_DATA', 'vehicles'),
  getVehicleTemplate
);

router.use(authenticateToken);
router.use(requireAdmin)

/**
 * @swagger
 * /api/bulk-vehicles/upload:
 *   post:
 *     summary: Bulk upload vehicles từ file Excel (Admin only)
 *     tags: [Bulk Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               excelFile:
 *                 type: string
 *                 format: binary
 *                 description: File Excel chứa dữ liệu vehicles (.xlsx)
 *           example:
 *             excelFile: "vehicle_data.xlsx"
 *     responses:
 *       200:
 *         description: Bulk upload thành công hoàn toàn
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
 *                   example: "Bulk upload vehicles thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 10
 *                         success:
 *                           type: integer
 *                           example: 10
 *                         failed:
 *                           type: integer
 *                           example: 0
 *                     createdUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                             example: "nguyen_van_an_NV001"
 *                           name:
 *                             type: string
 *                             example: "Nguyễn Văn An"
 *                           employeeId:
 *                             type: string
 *                             example: "NV001"
 *                           defaultPassword:
 *                             type: string
 *                             example: "Admin@123"
 *                     createdVehicles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           licensePlate:
 *                             type: string
 *                             example: "29A-123.45"
 *                           owner:
 *                             type: string
 *                             example: "Nguyễn Văn An"
 *                           vehicleType:
 *                             type: string
 *                             example: "car"
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *       207:
 *         description: Bulk upload hoàn thành với một số lỗi
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
 *                   example: "Hoàn thành bulk upload với 8 thành công, 2 thất bại"
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 10
 *                         success:
 *                           type: integer
 *                           example: 8
 *                         failed:
 *                           type: integer
 *                           example: 2
 *                     createdUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                             example: "nguyen_van_an_NV001"
 *                           name:
 *                             type: string
 *                             example: "Nguyễn Văn An"
 *                           employeeId:
 *                             type: string
 *                             example: "NV001"
 *                           defaultPassword:
 *                             type: string
 *                             example: "Admin@123"
 *                     createdVehicles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           licensePlate:
 *                             type: string
 *                             example: "29A-123.45"
 *                           owner:
 *                             type: string
 *                             example: "Nguyễn Văn An"
 *                           vehicleType:
 *                             type: string
 *                             example: "car"
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           row:
 *                             type: integer
 *                             example: 5
 *                           error:
 *                             type: string
 *                             example: "Dòng 5: Biển số xe không hợp lệ"
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               no_file:
 *                 summary: Không có file
 *                 value:
 *                   success: false
 *                   message: "Vui lòng tải lên file Excel"
 *               empty_file:
 *                 summary: File rỗng
 *                 value:
 *                   success: false
 *                   message: "File Excel không có dữ liệu"
 *               invalid_file_format:
 *                 summary: Sai định dạng file
 *                 value:
 *                   success: false
 *                   message: "File không đúng định dạng Excel"
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Chỉ admin mới có thể thực hiện bulk upload"
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// Route để bulk upload vehicles từ file Excel
router.post('/upload', 
  (req, res, next) => {
    uploadExcelFile(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      next();
    });
  },
  activityMiddleware('BULK_CREATE_VEHICLES', 'vehicles'),
  bulkUploadVehicles
);

export default router;
