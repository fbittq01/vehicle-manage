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

const router = express.Router();


// Route để tải file Excel mẫu
router.get('/template', 
  getVehicleTemplate
);

router.use(authenticateToken);
router.use(requireAdmin)

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
  bulkUploadVehicles
);

export default router;
