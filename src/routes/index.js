import express from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import vehicleRoutes from './vehicles.js';
import accessLogRoutes from './accessLogs.js';
import cameraRoutes from './cameras.js';
import workingHoursRoutes from './workingHours.js';
import workingHoursRequestRoutes from './workingHoursRequests.js';
import departmentRoutes from './departments.js';
// import simulationRoutes from './simulation.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    pythonServerStatus: 'disabled'
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/access-logs', accessLogRoutes);
router.use('/cameras', cameraRoutes);
router.use('/working-hours', workingHoursRoutes);
router.use('/working-hours-requests', workingHoursRequestRoutes);
router.use('/departments', departmentRoutes);
// router.use('/simulation', simulationRoutes);

export default router;
