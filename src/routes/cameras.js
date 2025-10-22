// filepath: /Users/quangmanh/quan-ly-phuong-tien-api/src/routes/cameras.js
import express from 'express';
import {
  // Core CRUD operations
  getCameras,
  getCameraById,
  createCamera,
  updateCamera,
  deleteCamera,
  
  // Status and maintenance
  updateCameraStatus,
  addMaintenanceNote,
  getCamerasNeedingMaintenance,
  
  // Analytics
  getCameraStatistics,
  incrementDetection,
  
  // Video streaming operations
  getStreamableCameras,
  startCameraStream,
  stopCameraStream,
  getStreamStatus,
  getActiveStreams,
  updateStreamSettings
} from '../controllers/cameraController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';
import { 
  validateCamera, 
  validateUpdateCamera,
  validateVideoStreamRequest,
  validateStreamSettings
} from '../middleware/validation.js';
import activityMiddleware from '../middleware/activityMiddleware.js';

const router = express.Router();

// Apply authentication to all camera routes
router.use(authenticateToken);

// ============================================================================
// CAMERA MANAGEMENT ROUTES (General)
// ============================================================================

// GET /api/cameras - Get cameras list with filters
router.get('/', activityMiddleware('VIEW_CAMERA', 'cameras'), getCameras);

// POST /api/cameras - Create new camera (Admin only)
router.post('/', validateCamera, authorize('admin', 'super_admin'), activityMiddleware('CREATE_CAMERA', 'cameras'), createCamera);

// GET /api/cameras/statistics - Get camera statistics
router.get('/statistics', activityMiddleware('VIEW_ANALYTICS', 'cameras'), getCameraStatistics);

// GET /api/cameras/maintenance - Get cameras needing maintenance
router.get('/maintenance', activityMiddleware('VIEW_CAMERA', 'cameras'), getCamerasNeedingMaintenance);

// ============================================================================
// VIDEO STREAMING ROUTES
// ============================================================================

// GET /api/cameras/streamable - Get streamable cameras
router.get('/streamable', activityMiddleware('VIEW_CAMERA', 'cameras'), getStreamableCameras);

// GET /api/cameras/streams/active - Get active streams
router.get('/streams/active', activityMiddleware('VIEW_CAMERA', 'cameras'), getActiveStreams);

// ============================================================================
// CAMERA SPECIFIC OPERATIONS
// ============================================================================

// GET /api/cameras/:id - Get camera by ID
router.get('/:id', activityMiddleware('VIEW_CAMERA', 'cameras'), getCameraById);

// PUT /api/cameras/:id - Update camera
router.put('/:id', validateUpdateCamera, activityMiddleware('UPDATE_CAMERA', 'cameras'), updateCamera);

// DELETE /api/cameras/:id - Delete camera (Admin only)
router.delete('/:id', authorize('admin', 'super_admin'), activityMiddleware('DELETE_CAMERA', 'cameras'), deleteCamera);

// ============================================================================
// CAMERA STATUS & MAINTENANCE
// ============================================================================

// PATCH /api/cameras/:id/status - Update camera status
router.patch('/:id/status', activityMiddleware('UPDATE_CAMERA', 'cameras'), updateCameraStatus);

// POST /api/cameras/:id/maintenance/note - Add maintenance note
router.post('/:id/maintenance/note', activityMiddleware('UPDATE_CAMERA', 'cameras'), addMaintenanceNote);

// PATCH /api/cameras/:id/detection - Increment detection count (for AI system)
router.patch('/:id/detection', incrementDetection);

// ============================================================================
// VIDEO STREAMING OPERATIONS (Camera Specific)
// ============================================================================

// GET /api/cameras/:id/stream/status - Get camera stream status
router.get('/:id/stream/status', activityMiddleware('VIEW_CAMERA', 'cameras'), getStreamStatus);

// POST /api/cameras/:id/stream/start - Start camera video stream
router.post('/:id/stream/start', validateVideoStreamRequest, activityMiddleware('UPDATE_CAMERA', 'cameras'), startCameraStream);

// POST /api/cameras/:id/stream/stop - Stop camera video stream
router.post('/:id/stream/stop', activityMiddleware('UPDATE_CAMERA', 'cameras'), stopCameraStream);

// PUT /api/cameras/:id/stream/settings - Update camera stream settings
router.put('/:id/stream/settings', validateStreamSettings, activityMiddleware('UPDATE_CAMERA', 'cameras'), updateStreamSettings);

/**
 * @module CameraRoutes
 * @description Clean camera routes without Swagger documentation
 * 
 * Available endpoints:
 * - Camera CRUD: GET, POST, PUT, DELETE /api/cameras
 * - Video Streaming: /api/cameras/:id/stream/*
 * - Maintenance: /api/cameras/:id/maintenance/*
 * - Analytics: /api/cameras/statistics
 */
export default router;
