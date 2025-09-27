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

/**
 * @swagger
 * tags:
 *   name: Health Check
 *   description: API kiểm tra trạng thái hệ thống
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Kiểm tra trạng thái API
 *     tags: [Health Check]
 *     security: []
 *     responses:
 *       200:
 *         description: API đang hoạt động bình thường
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
 *                   example: "API is running"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-15T10:30:00.000Z"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 pythonServerStatus:
 *                   type: string
 *                   example: "disabled"
 */

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
