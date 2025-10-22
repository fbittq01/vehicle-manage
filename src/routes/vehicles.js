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
import activityMiddleware from '../middleware/activityMiddleware.js';

const router = express.Router();

// Tất cả routes cần authentication
router.use(authenticateToken);

// Public routes (authenticated users)
router.get('/my-vehicles', activityMiddleware('VIEW_VEHICLE', 'vehicles'), getMyVehicles);
router.get('/stats', activityMiddleware('VIEW_ANALYTICS', 'vehicles'), getVehicleStats);

// CRUD routes
router.get('/', activityMiddleware('VIEW_VEHICLE', 'vehicles'), getVehicles);
router.get('/:id', activityMiddleware('VIEW_VEHICLE', 'vehicles'), getVehicleById);
router.get('/license-plate/:licensePlate', activityMiddleware('VIEW_VEHICLE', 'vehicles'), getVehicleByLicensePlate);
router.post('/', validateVehicle, activityMiddleware('CREATE_VEHICLE', 'vehicles'), createVehicle);
router.put('/:id', validateUpdateVehicle, activityMiddleware('UPDATE_VEHICLE', 'vehicles'), updateVehicle);
router.delete('/:id', activityMiddleware('DELETE_VEHICLE', 'vehicles'), deleteVehicle);
router.put('/:id/activate', activityMiddleware('CHANGE_VEHICLE_STATUS', 'vehicles'), activateVehicle);

export default router;
