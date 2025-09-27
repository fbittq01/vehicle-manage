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
