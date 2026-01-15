import mongoose from 'mongoose';
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

  const notificationManager = socketServiceInstance?.getNotificationManager();
  if (!notificationManager) {
    return sendErrorResponse(res, 'Notification service not available', 500);
  }

  const notifications = await notificationManager.getUnreadNotifications(req.user._id, parseInt(limit));

  sendSuccessResponse(res, { 
    notifications,
    count: notifications.length 
  }, 'Lấy danh sách thông báo chưa đọc thành công');
});

// Đếm số thông báo chưa đọc
export const getUnreadCount = asyncHandler(async (req, res) => {
  const notificationManager = socketServiceInstance?.getNotificationManager();
  if (!notificationManager) {
    return sendErrorResponse(res, 'Notification service not available', 500);
  }

  const count = await notificationManager.getUnreadCount(req.user._id);

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

  const notificationManager = socketServiceInstance?.getNotificationManager();
  if (!notificationManager) {
    return sendErrorResponse(res, 'Notification service not available', 500);
  }

  try {
    const notification = await notificationManager.markAsRead(id, req.user._id);
    
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
  const notificationManager = socketServiceInstance?.getNotificationManager();
  if (!notificationManager) {
    return sendErrorResponse(res, 'Notification service not available', 500);
  }

  const modifiedCount = await notificationManager.markAllAsRead(req.user._id);
  
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

/**
 * Mock Data Factory - Tạo mock data cho từng loại notification
 */
const createMockData = (type, userId) => {
  const baseObjectId = new mongoose.Types.ObjectId();
  
  const mockDataFactories = {
    WORKING_HOURS_REQUEST: () => ({
      _id: baseObjectId,
      requestedBy: {
        _id: userId,
        name: 'Nguyễn Văn Test',
        employeeId: 'EMP001',
        department: {
          _id: new mongoose.Types.ObjectId(),
          name: 'Phòng Kỹ thuật'
        }
      },
      requestType: 'entry',
      licensePlate: '29A-12345',
      plannedDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 giờ nữa
      reason: 'Có việc cần xử lý khẩn cấp tại công ty',
      status: 'pending',
      createdAt: new Date()
    }),

    WORKING_HOURS_REQUEST_UPDATE: () => ({
      _id: "6960b2bdb8b243a6cf74da81",
      requestedBy: {
        _id: userId,
        name: 'Nguyễn Văn Test',
        employeeId: 'EMP001'
      },
      requestType: 'exit',
      licensePlate: '30B-67890',
      plannedDateTime: new Date(),
      reason: 'Đi công tác ngoài giờ',
      status: 'approved',
      approvedBy: {
        _id: new mongoose.Types.ObjectId(),
        name: 'Trần Thị Quản lý'
      },
      approvedAt: new Date(),
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 giờ trước
    }),

    VEHICLE_VERIFICATION: () => ({
      _id: baseObjectId,
      licensePlate: '51F-99999',
      action: 'entry',
      gateId: 'GATE_01',
      gateName: 'Cổng chính',
      recognitionData: {
        confidence: 0.65,
        processedImage: '/uploads/test-image.jpg'
      },
      verificationStatus: 'pending',
      isVehicleRegistered: false,
      owner: null,
      vehicle: null,
      createdAt: new Date(),
      // Data bổ sung cho message template
      reason: 'unknown_vehicle'
    }),

    // Test riêng cho trường hợp XE LẠ
    VEHICLE_VERIFICATION_UNKNOWN: () => ({
      _id: baseObjectId,
      licensePlate: '99Z-88888',
      action: 'entry',
      gateId: 'GATE_01',
      gateName: 'Cổng chính',
      recognitionData: {
        confidence: 0.92, // Confidence cao nhưng xe lạ
        processedImage: '/uploads/unknown-vehicle.jpg'
      },
      verificationStatus: 'pending',
      isVehicleRegistered: false, // Xe chưa đăng ký - XE LẠ
      owner: null,
      vehicle: null,
      createdAt: new Date()
    }),

    // Test riêng cho trường hợp ĐỘ TIN CẬY THẤP
    VEHICLE_VERIFICATION_LOW_CONFIDENCE: () => ({
      _id: baseObjectId,
      licensePlate: '29A-12345',
      action: 'entry',
      gateId: 'GATE_02',
      gateName: 'Cổng phụ',
      recognitionData: {
        confidence: 0.65, // Confidence thấp < 0.9
        processedImage: '/uploads/low-confidence.jpg'
      },
      verificationStatus: 'pending',
      isVehicleRegistered: true, // Xe đã đăng ký nhưng độ tin cậy thấp
      owner: {
        _id: userId,
        name: 'Nguyễn Văn Test',
        department: {
          _id: new mongoose.Types.ObjectId(),
          name: 'Phòng Kỹ thuật'
        }
      },
      vehicle: {
        _id: new mongoose.Types.ObjectId(),
        licensePlate: '29A-12345'
      },
      createdAt: new Date()
    }),

    VEHICLE_VERIFIED: () => ({
      _id: baseObjectId,
      licensePlate: '29A-12345',
      action: 'entry',
      gateId: 'GATE_01',
      gateName: 'Cổng chính',
      recognitionData: {
        confidence: 0.85,
        processedImage: '/uploads/test-image.jpg'
      },
      verificationStatus: 'approved',
      isVehicleRegistered: true,
      owner: {
        _id: userId,
        name: 'Nguyễn Văn Test',
        department: {
          _id: new mongoose.Types.ObjectId(),
          name: 'Phòng Kỹ thuật'
        }
      },
      vehicle: {
        _id: new mongoose.Types.ObjectId(),
        licensePlate: '29A-12345'
      },
      verifiedBy: {
        _id: new mongoose.Types.ObjectId(),
        name: 'Trần Thị Bảo vệ'
      },
      verificationTime: new Date(),
      createdAt: new Date()
    }),

    VEHICLE_ACCESS: () => ({
      _id: baseObjectId,
      licensePlate: '30B-67890',
      action: 'exit',
      gateId: 'GATE_02',
      gateName: 'Cổng phụ',
      recognitionData: {
        confidence: 0.95,
        processedImage: '/uploads/test-image.jpg'
      },
      verificationStatus: 'auto_approved',
      isVehicleRegistered: true,
      owner: {
        _id: userId,
        name: 'Lê Văn Demo',
        department: {
          _id: new mongoose.Types.ObjectId(),
          name: 'Phòng Kinh doanh'
        }
      },
      vehicle: {
        _id: new mongoose.Types.ObjectId(),
        licensePlate: '30B-67890'
      },
      createdAt: new Date()
    })
  };

  return mockDataFactories[type]?.() || null;
};

/**
 * Test gửi notification
 * POST /api/notifications/test
 * Body: {
 *   type: "WORKING_HOURS_REQUEST" | "WORKING_HOURS_REQUEST_UPDATE" | etc.,
 *   targetUserId: "optional_user_id",
 *   mockData: {} // optional custom mock data
 * }
 */
export const testNotification = asyncHandler(async (req, res) => {
  const notificationManager = socketServiceInstance?.getNotificationManager();
  if (!notificationManager) {
    return sendErrorResponse(res, 'Notification service not available', 500);
  }

  const { type, targetUserId, mockData: customMockData } = req.body;

  // Validate type
  const availableTypes = notificationManager.getAvailableTypes();
  if (!type || !availableTypes.includes(type)) {
    return sendErrorResponse(res, `Invalid notification type. Available types: ${availableTypes.join(', ')}`, 400);
  }

  // Tạo mock data
  const userId = targetUserId || req.user._id;
  const mockData = customMockData || createMockData(type, userId);

  if (!mockData) {
    return sendErrorResponse(res, `Failed to create mock data for type: ${type}`, 500);
  }

  try {
    // Xác định reason cho VEHICLE_VERIFICATION types
    let options = {
      force: true, // Force gửi ngay cả khi có điều kiện đặc biệt
      test: true   // Đánh dấu đây là test notification
    };

    // Auto-detect reason cho VEHICLE_VERIFICATION
    if (type.startsWith('VEHICLE_VERIFICATION')) {
      if (type === 'VEHICLE_VERIFICATION_UNKNOWN') {
        options.reason = 'unknown_vehicle';
      } else if (type === 'VEHICLE_VERIFICATION_LOW_CONFIDENCE') {
        options.reason = 'low_confidence';
      } else if (!mockData.isVehicleRegistered) {
        options.reason = 'unknown_vehicle';
      } else if (mockData.recognitionData?.confidence < 0.9) {
        options.reason = 'low_confidence';
      }
    }

    // Gửi notification
    const result = await notificationManager.send('VEHICLE_VERIFICATION', mockData, options);
    console.log("🚀 ~ result:", result)

    // Lấy thông tin chi tiết về notification đã gửi
    const sentNotifications = await Notification.find({
      type: notificationManager.getConfig(type)?.type,
      createdAt: { $gte: new Date(Date.now() - 10000) } // Lấy notifications trong 10 giây vừa qua
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'name username email');
    console.log("🚀 ~ sentNotifications:", sentNotifications)

    sendSuccessResponse(res, {
      success: true,
      type,
      mockData,
      result: {
        notificationsSent: sentNotifications.length,
        notifications: sentNotifications,
        timestamp: new Date()
      },
      availableTypes
    }, `Test notification ${type} đã được gửi thành công`);

  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    return sendErrorResponse(res, `Failed to send test notification: ${error.message}`, 500);
  }
});
