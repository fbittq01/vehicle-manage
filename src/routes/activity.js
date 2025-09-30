import express from 'express';
import activityController from '../controllers/activityController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware để require authentication và super admin role
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Truy cập bị từ chối. Cần quyền Super Admin.'
    });
  }
  next();
};

// Apply authentication và super admin check cho tất cả routes
router.use(authenticateToken);
router.use(requireSuperAdmin);

/**
 * @swagger
 * /api/activity/logs:
 *   get:
 *     summary: Get activity logs
 *     description: Retrieve activity logs with filtering and pagination (Super Admin only)
 *     tags: [Activity Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of items per page
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: Filter by resource type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SUCCESS, FAILED]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Activity logs retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
router.get('/logs', activityController.getLogs);

/**
 * @swagger
 * /api/activity/statistics:
 *   get:
 *     summary: Get activity statistics
 *     description: Retrieve activity statistics (Super Admin only)
 *     tags: [Activity Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
router.get('/statistics', activityController.getStatistics);

/**
 * @swagger
 * /api/activity/export:
 *   get:
 *     summary: Export activity logs
 *     description: Export activity logs in JSON or CSV format (Super Admin only)
 *     tags: [Activity Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: Filter by resource type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SUCCESS, FAILED]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Activity logs exported successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
router.get('/export', activityController.exportLogs);

/**
 * @swagger
 * /api/activity/resource/{resource}:
 *   get:
 *     summary: Get activities by resource
 *     description: Retrieve activities for a specific resource type (Super Admin only)
 *     tags: [Activity Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resource
 *         required: true
 *         schema:
 *           type: string
 *         description: Resource type (e.g., users, vehicles, departments)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Resource activities retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
router.get('/resource/:resource', activityController.getActivitiesByResource);

/**
 * @swagger
 * /api/activity/user/{userId}:
 *   get:
 *     summary: Get user activities
 *     description: Retrieve activities for a specific user (Super Admin only)
 *     tags: [Activity Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: User activities retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
router.get('/user/:userId', activityController.getUserActivities);

export default router;
