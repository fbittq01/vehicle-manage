import express from 'express';
import {
  getUserTemplate,
  bulkUploadUsers
} from '../controllers/bulkUserController.js';
import {
  authenticateToken,
  requireAdmin
} from '../middleware/auth.js';
import { uploadExcelFile } from '../middleware/formDataParser.js';
import activityMiddleware from '../middleware/activityMiddleware.js';

const router = express.Router();

// Route để tải file Excel mẫu
router.get('/template', 
  authenticateToken,
  requireAdmin,
  getUserTemplate
);

router.use(authenticateToken);
router.use(requireAdmin);

// Route để bulk upload users từ file Excel
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
  activityMiddleware('BULK_CREATE_USERS', 'users'),
  bulkUploadUsers
);

export default router;
