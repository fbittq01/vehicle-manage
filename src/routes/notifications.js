import express from 'express';
import {
  getNotifications,
  getUnreadNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotificationById
} from '../controllers/notificationController.js';
import {
  authenticateToken
} from '../middleware/auth.js';
import activityMiddleware from '../middleware/activityMiddleware.js';

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// Lấy danh sách thông báo của user hiện tại
router.get('/', activityMiddleware('VIEW_NOTIFICATION', 'notifications'), getNotifications);

// Lấy danh sách thông báo chưa đọc
router.get('/unread', activityMiddleware('VIEW_NOTIFICATION', 'notifications'), getUnreadNotifications);

// Đếm số thông báo chưa đọc
router.get('/unread/count', activityMiddleware('VIEW_NOTIFICATION', 'notifications'), getUnreadCount);

// Lấy chi tiết một thông báo
router.get('/:id', activityMiddleware('VIEW_NOTIFICATION', 'notifications'), getNotificationById);

// Đánh dấu thông báo đã đọc
router.put('/:id/read', activityMiddleware('UPDATE_NOTIFICATION', 'notifications'), markAsRead);

// Đánh dấu tất cả thông báo đã đọc
router.put('/mark-all-read', activityMiddleware('UPDATE_NOTIFICATION', 'notifications'), markAllAsRead);

export default router;
