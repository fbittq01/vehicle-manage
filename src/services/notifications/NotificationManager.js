import { NOTIFICATION_TYPES } from './configs/notificationTypes.js';
import { AudienceResolver } from './handlers/AudienceResolver.js';
import { MessageBuilder } from './handlers/MessageBuilder.js';
import { SocketChannel } from './channels/SocketChannel.js';
import { DatabaseChannel } from './channels/DatabaseChannel.js';
import { WorkingHoursRequest, AccessLog } from '../../models/index.js';

/**
 * NotificationManager - Core của hệ thống notification mới
 * Thay thế NotificationService cũ với approach đơn giản và config-based
 */
export class NotificationManager {
  constructor(socketService) {
    this.socketChannel = new SocketChannel(socketService);
    this.databaseChannel = new DatabaseChannel();
    this.initialized = false;
  }

  /**
   * Initialize manager (có thể dùng để setup cache, connections, etc.)
   */
  async initialize() {
    this.initialized = true;
    console.log('🚀 NotificationManager initialized');
  }

  /**
   * MAIN METHOD - Gửi notification theo config
   * @param {string} notificationType - Key từ NOTIFICATION_TYPES
   * @param {Object} data - Raw data (WorkingHoursRequest, AccessLog, etc.)
   * @param {Object} options - Additional options
   */
  async send(notificationType, data, options = {}) {
    try {
      // Lấy config
      const config = NOTIFICATION_TYPES[notificationType];
      if (!config) {
        throw new Error(`Unknown notification type: ${notificationType}`);
      }

      // Populate data nếu cần
      const populatedData = await this.populateData(data, config);

      // Tạo context cho audience resolution
      const context = await this.buildContext(populatedData, config, options);

      // Validate context
      if (!AudienceResolver.validateContext(config.audience, context)) {
        console.warn(`Invalid context for audience ${config.audience}:`, context);
        return null;
      }

      // Tìm recipients
      const recipients = await AudienceResolver.resolve(config.audience, context);
      if (!recipients || recipients.length === 0) {
        return null;
      }

      // Build notification object
      const notification = MessageBuilder.build(config, populatedData, options);

      // Get socket rooms
      const rooms = AudienceResolver.getSocketRooms(config.audience, context);

      // Send qua các channels và trả về saved notifications
      const savedNotifications = await this.sendToChannels(config.channels, recipients, notification, rooms);

      return savedNotifications;

    } catch (error) {
      console.error(`❌ Error sending notification ${notificationType}:`, error);
      throw error;
    }
  }

  /**
   * Populate data theo requirements của config
   * @param {Object} data - Raw data
   * @param {Object} config - Notification config
   * @returns {Object} Populated data
   */
  async populateData(data, config) {
    if (!config.requiresPopulate || config.requiresPopulate.length === 0) {
      return data;
    }

    try {
      let Model;
      
      // Xác định model dựa trên data type hoặc config
      if (data.requestType !== undefined) {
        Model = WorkingHoursRequest;
      } else if (data.licensePlate !== undefined) {
        Model = AccessLog;
      } else {
        console.warn('Could not determine model for population');
        return data;
      }

      // Build populate options
      const populateOptions = config.requiresPopulate.map(path => {
        if (path.includes('.')) {
          // Nested populate
          const [parentPath, childPath] = path.split('.');
          return {
            path: parentPath,
            populate: {
              path: childPath,
              select: 'name code _id'
            }
          };
        } else {
          // Simple populate
          return {
            path: path,
            select: 'name username _id role department'
          };
        }
      });

      const populated = await Model.findById(data._id).populate(populateOptions);
      return populated || data;

    } catch (error) {
      console.error('Error populating data:', error);
      return data; // Fallback to original data
    }
  }

  /**
   * Build context cho audience resolution
   * @param {Object} data - Populated data
   * @param {Object} config - Notification config  
   * @param {Object} options - Additional options
   * @returns {Object} Context object
   */
  async buildContext(data, config, options) {
    const context = { ...options };

    // Build context theo audience type
    switch (config.audience) {
      case 'department_admins':
        context.departmentId = data.requestedBy?.department?._id || 
                              data.owner?.department?._id ||
                              options.departmentId;
        break;

      case 'requester':
        context.requesterId = data.requestedBy?._id || options.requesterId;
        break;

      case 'vehicle_owner':
        context.ownerId = data.owner?._id || options.ownerId;
        break;

      case 'specific_user':
        context.userId = options.userId;
        break;

      // 'supervisors' không cần context đặc biệt
    }

    return context;
  }

  /**
   * Gửi notification qua các channels
   * Database LUÔN được lưu trước (persistence), sau đó gửi qua socket kèm notification ID
   * @param {Array} channels - Danh sách delivery channels
   * @param {Array} recipients - Recipients
   * @param {Object} notification - Notification object
   * @param {Array} rooms - Socket rooms
   * @returns {Array} Saved notifications
   */
  async sendToChannels(channels, recipients, notification, rooms) {
    let savedNotifications = [];

    // BƯỚC 1: Lưu vào database trước để lấy notification IDs
    if (this.databaseChannel.isAvailable()) {
      savedNotifications = await this.databaseChannel.bulkSave(recipients, notification);
    }

    // BƯỚC 2: Gửi qua các delivery channels kèm notification IDs
    for (const channel of channels) {
      switch (channel) {
        case 'socket':
          if (this.socketChannel.isAvailable()) {
            // Gửi notification kèm IDs từ database
            const notificationWithIds = savedNotifications.map(saved => ({
              ...notification,
              _id: saved._id,
              notificationId: saved._id
            }));
            await this.socketChannel.sendWithIds(recipients, notificationWithIds, rooms);
          }
          break;

        case 'email':
          // TODO: Implement EmailChannel
          console.warn('Email channel not implemented yet');
          break;

        case 'sms':
          // TODO: Implement SMSChannel
          console.warn('SMS channel not implemented yet');
          break;

        case 'push':
          // TODO: Implement PushChannel
          console.warn('Push notification channel not implemented yet');
          break;

        default:
          console.warn(`Unknown delivery channel: ${channel}`);
      }
    }

    return savedNotifications;
  }

  // =============================================================================
  // CONVENIENCE METHODS - Wrappers cho các notification types cũ
  // =============================================================================

  /**
   * Gửi thông báo yêu cầu ra/vào mới
   */
  async notifyWorkingHoursRequest(workingHoursRequest) {
    await this.send('WORKING_HOURS_REQUEST', workingHoursRequest);
  }

  /**
   * Gửi thông báo cập nhật yêu cầu ra/vào
   */
  async notifyWorkingHoursRequestUpdate(workingHoursRequest, previousStatus) {
    await this.send('WORKING_HOURS_REQUEST_UPDATE', workingHoursRequest, { previousStatus });
  }

  /**
   * Gửi thông báo xe cần xác minh (tối giản hóa - bao gồm xe lạ và xe có độ tin cậy thấp)
   */
  async notifyVehicleVerification(accessLog, reason = 'manual_review') {
    return await this.send('VEHICLE_VERIFICATION', accessLog, { reason });
  }

  /**
   * Gửi thông báo xe đã xác minh
   */
  async notifyVehicleVerified(accessLog) {
    await this.send('VEHICLE_VERIFIED', accessLog);
  }

  // Backward compatibility methods
  async notifyAccessLogVerification(accessLog) {
    return await this.notifyVehicleVerification(accessLog, 'manual_review');
  }

  async notifyAccessLogVerified(accessLog) {
    await this.notifyVehicleVerified(accessLog);
  }

  async notifyUnknownVehicle(accessLog) {
    await this.notifyVehicleVerification(accessLog, 'unknown_vehicle');
  }

  /**
   * Gửi thông báo xe ra/vào
   */
  async notifyVehicleAccess(accessLog) {
    await this.send('VEHICLE_ACCESS', accessLog);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Gửi custom notification
   * @param {Object} customConfig - Custom notification config
   * @param {Object} data - Data object
   * @param {Object} options - Options
   */
  async sendCustom(customConfig, data, options = {}) {
    try {
      // Merge với default config
      const config = {
        channels: ['socket'], // Database luôn được lưu tự động
        priority: 'normal',
        expiryDays: 7,
        ui: {},
        ...customConfig
      };

      const context = await this.buildContext(data, config, options);
      const recipients = await AudienceResolver.resolve(config.audience, context);
      
      if (!recipients || recipients.length === 0) {
        console.warn('No recipients for custom notification');
        return;
      }

      const notification = MessageBuilder.build(config, data, options);
      const rooms = AudienceResolver.getSocketRooms(config.audience, context);

      await this.sendToChannels(config.channels, recipients, notification, rooms);
      
    } catch (error) {
      console.error('Error sending custom notification:', error);
      throw error;
    }
  }

  /**
   * Broadcast notification tới tất cả users
   * @param {Object} notification - Notification object
   */
  async broadcast(notification) {
    if (this.socketChannel.isAvailable()) {
      await this.socketChannel.broadcast(notification);
    }
  }

  /**
   * Get available notification types
   * @returns {Array} Available types
   */
  getAvailableTypes() {
    return Object.keys(NOTIFICATION_TYPES);
  }

  /**
   * Get notification config
   * @param {string} type - Notification type
   * @returns {Object} Config object
   */
  getConfig(type) {
    return NOTIFICATION_TYPES[type];
  }

  // =============================================================================
  // UTILITY METHODS FOR CONTROLLERS (Backward compatibility)
  // =============================================================================

  /**
   * Lấy danh sách thông báo chưa đọc của user
   * @param {string} userId - ID của user
   * @param {number} limit - Số lượng thông báo tối đa
   * @returns {Array} Danh sách thông báo
   */
  async getUnreadNotifications(userId, limit = 20) {
    try {
      const { Notification } = await import('../../models/index.js');
      return await Notification.find({
        userId: userId,
        isRead: false,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      })
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .populate('metadata.sender.id', 'name username');
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      return [];
    }
  }

  /**
   * Đếm số thông báo chưa đọc của user
   * @param {string} userId - ID của user
   * @returns {number} Số lượng thông báo chưa đọc
   */
  async getUnreadCount(userId) {
    try {
      const { Notification } = await import('../../models/index.js');
      return await Notification.countDocuments({
        userId: userId,
        isRead: false,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });
    } catch (error) {
      console.error('Error counting unread notifications:', error);
      return 0;
    }
  }

  /**
   * Đánh dấu thông báo đã đọc
   * @param {string} notificationId - ID của thông báo
   * @param {string} userId - ID của user (để verify quyền)
   * @returns {Object} Thông báo đã cập nhật
   */
  async markAsRead(notificationId, userId) {
    try {
      const { Notification } = await import('../../models/index.js');
      const notification = await Notification.findOne({
        _id: notificationId,
        userId: userId
      });

      if (!notification) {
        throw new Error('Notification not found or access denied');
      }

      if (!notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();
      }

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Đánh dấu tất cả thông báo của user đã đọc
   * @param {string} userId - ID của user
   * @returns {number} Số lượng thông báo đã cập nhật
   */
  async markAllAsRead(userId) {
    try {
      const { Notification } = await import('../../models/index.js');
      const result = await Notification.updateMany(
        { 
          userId: userId, 
          isRead: false,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
          ]
        },
        { 
          isRead: true, 
          readAt: new Date() 
        }
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Xóa các thông báo cũ (cleanup task)
   * @param {number} daysToKeep - Số ngày giữ lại thông báo đã đọc
   * @returns {number} Số lượng thông báo đã xóa
   */
  async cleanupOldNotifications(daysToKeep = 30) {
    try {
      const { Notification } = await import('../../models/index.js');
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      const result = await Notification.deleteMany({
        $or: [
          { expiresAt: { $exists: true, $lt: new Date() } },
          { 
            isRead: true, 
            readAt: { $lt: cutoffDate }
          }
        ]
      });
      
      console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }
}
