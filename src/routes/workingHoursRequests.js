import express from 'express';
import {
  getWorkingHoursRequests,
  getMyRequests,
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

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// User routes - người dùng có thể tạo và quản lý yêu cầu của mình
router.get('/my-requests', validateWorkingHoursRequestQuery, activityMiddleware('VIEW_WORKING_HOURS_REQUEST', 'working_hours_requests'), getMyRequests);
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
