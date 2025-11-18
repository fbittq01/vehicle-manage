import { Notification } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination } from '../utils/response.js';
import { asyncHandler } from '../middleware/logger.js';

// Import socketService instance (sẽ được inject từ server.js)
let socketServiceInstance = null;

export const setSocketService = (socketService) => {
  socketServiceInstance = socketService;
};

// Lấy danh sách thông báo của user hiện tại
export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { type, priority, isRead } = req.query;

  // Build filter
  const filter = {
    userId: req.user._id,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  };

  if (type) filter.type = type;
  if (priority) filter.priority = priority;
  if (isRead !== undefined) filter.isRead = isRead === 'true';

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .populate('metadata.sender.id', 'name username')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter)
  ]);

  const pagination = createPagination(page, limit, total);

  sendPaginatedResponse(res, notifications, pagination, 'Lấy danh sách thông báo thành công');
});

// Lấy danh sách thông báo chưa đọc
export const getUnreadNotifications = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  const notificationService = socketServiceInstance?.getNotificationService();
  if (!notificationService) {
    return sendErrorResponse(res, 'Notification service not available', 500);
  }

  const notifications = await notificationService.getUnreadNotifications(req.user._id, parseInt(limit));

  sendSuccessResponse(res, { 
    notifications,
    count: notifications.length 
  }, 'Lấy danh sách thông báo chưa đọc thành công');
});

// Đếm số thông báo chưa đọc
export const getUnreadCount = asyncHandler(async (req, res) => {
  const notificationService = socketServiceInstance?.getNotificationService();
  if (!notificationService) {
    return sendErrorResponse(res, 'Notification service not available', 500);
  }

  const count = await notificationService.getUnreadCount(req.user._id);

  sendSuccessResponse(res, { count }, 'Lấy số lượng thông báo chưa đọc thành công');
});

// Lấy chi tiết một thông báo
export const getNotificationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findOne({
    _id: id,
    userId: req.user._id
  }).populate('metadata.sender.id', 'name username');

  if (!notification) {
    return sendErrorResponse(res, 'Không tìm thấy thông báo', 404);
  }

  // Tự động đánh dấu đã đọc khi xem chi tiết
  if (!notification.isRead) {
    await notification.markAsRead();
  }

  sendSuccessResponse(res, { notification }, 'Lấy chi tiết thông báo thành công');
});

// Đánh dấu thông báo đã đọc
export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notificationService = socketServiceInstance?.getNotificationService();
  if (!notificationService) {
    return sendErrorResponse(res, 'Notification service not available', 500);
  }

  try {
    const notification = await notificationService.markAsRead(id, req.user._id);
    
    // Gửi cập nhật realtime tới client
    socketServiceInstance.io?.to(`user_${req.user._id}`).emit('notification_read', {
      notificationId: id,
      readAt: notification.readAt
    });

    sendSuccessResponse(res, { notification }, 'Đánh dấu thông báo đã đọc thành công');
  } catch (error) {
    if (error.message === 'Notification not found or access denied') {
      return sendErrorResponse(res, 'Không tìm thấy thông báo hoặc không có quyền truy cập', 404);
    }
    throw error;
  }
});

// Đánh dấu tất cả thông báo đã đọc
export const markAllAsRead = asyncHandler(async (req, res) => {
  const notificationService = socketServiceInstance?.getNotificationService();
  if (!notificationService) {
    return sendErrorResponse(res, 'Notification service not available', 500);
  }

  const modifiedCount = await notificationService.markAllAsRead(req.user._id);
  
  // Gửi cập nhật realtime tới client
  socketServiceInstance.io?.to(`user_${req.user._id}`).emit('all_notifications_read', {
    userId: req.user._id,
    updatedCount: modifiedCount,
    timestamp: new Date()
  });

  sendSuccessResponse(res, { 
    modifiedCount 
  }, `Đã đánh dấu ${modifiedCount} thông báo là đã đọc`);
});

// Lấy thống kê thông báo của user
export const getNotificationStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await Notification.aggregate([
    {
      $match: {
        userId: userId,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
        },
        byType: {
          $push: {
            type: '$type',
            isRead: '$isRead',
            priority: '$priority'
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        unread: 1,
        read: { $subtract: ['$total', '$unread'] },
        typeStats: {
          $reduce: {
            input: '$byType',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $let: {
                    vars: {
                      key: '$$this.type'
                    },
                    in: {
                      $arrayToObject: [
                        [
                          {
                            k: '$$key',
                            v: {
                              $add: [
                                { $ifNull: [{ $getField: { field: '$$key', input: '$$value' } }, 0] },
                                1
                              ]
                            }
                          }
                        ]
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  ]);

  const result = stats[0] || {
    total: 0,
    unread: 0,
    read: 0,
    typeStats: {}
  };

  sendSuccessResponse(res, result, 'Lấy thống kê thông báo thành công');
});
