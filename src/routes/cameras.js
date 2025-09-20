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
import { authenticate, authorize } from '../middleware/auth.js';
import { validateCamera, validateUpdateCamera } from '../middleware/validation.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả routes
router.use(authenticate);

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
