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
  addMaintenanceRecord,
  getInsuranceExpiring,
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

const router = express.Router();

// Tất cả routes cần authentication
router.use(authenticateToken);

// Public routes (authenticated users)
router.get('/my-vehicles', getMyVehicles);
router.get('/stats', getVehicleStats);
router.get('/insurance-expiring', requireAdmin, getInsuranceExpiring);

// CRUD routes
router.get('/', getVehicles);
router.get('/:id', getVehicleById);
router.get('/license-plate/:licensePlate', getVehicleByLicensePlate);
router.post('/', validateVehicle, createVehicle);
router.put('/:id', validateUpdateVehicle, updateVehicle);
router.delete('/:id', deleteVehicle);
router.put('/:id/activate', activateVehicle);

// Maintenance routes
router.post('/:id/maintenance', addMaintenanceRecord);

export default router;
