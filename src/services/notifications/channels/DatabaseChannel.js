import { Notification } from '../../../models/index.js';

/**
 * DatabaseChannel - Xử lý lưu notification vào database
 */
export class DatabaseChannel {
  
  /**
   * Lưu notification vào database cho từng recipient
   * @param {Array} recipients - Danh sách recipients  
   * @param {Object} notification - Notification object
   */
  async send(recipients, notification) {
    if (!recipients || recipients.length === 0) {
      return;
    }

    try {
      const savePromises = recipients.map(recipient => 
        this.saveNotificationForUser(recipient._id, notification)
      );

      const results = await Promise.allSettled(savePromises);
      
      const failed = results.filter(r => r.status === 'rejected').length;
      
      // Chỉ log khi có lỗi
      if (failed > 0) {
        const errors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.reason);
        console.error('Database notification errors:', errors);
      }

    } catch (error) {
      console.error('Error sending database notifications:', error);
      throw error;
    }
  }

  /**
   * Lưu notification cho một user cụ thể
   * @param {string} userId - User ID
   * @param {Object} notification - Notification object
   * @returns {Object} Saved notification document
   */
  async saveNotificationForUser(userId, notification) {
    try {
      // Validate required fields
      if (!notification.type || !notification.title || !notification.message) {
        throw new Error(`Invalid notification data: missing required fields`);
      }

      if (!userId) {
        throw new Error('UserId is required for notification');
      }

      // Calculate expiry date
      const expiryDate = this.calculateExpiryDate(
        notification.metadata?.expiryDays || 30, 
        notification.priority
      );

      // Create notification document
      const notificationDoc = new Notification({
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        priority: notification.priority || 'normal',
        deliveryStatus: 'sent',
        sentAt: new Date(),
        expiresAt: expiryDate,
        metadata: {
          channels: notification.metadata?.channels || ['database'],
          relatedId: notification.metadata?.relatedId,
          relatedModel: notification.metadata?.relatedModel,
          sender: {
            type: 'system'
          }
        }
      });

      const saved = await notificationDoc.save();
      return saved;
      
    } catch (error) {
      console.error(`Error saving notification for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate expiry date based on days and priority
   * @param {number} expiryDays - Number of days
   * @param {string} priority - Priority level
   * @returns {Date} Expiry date
   */
  calculateExpiryDate(expiryDays, priority) {
    const now = new Date();
    let adjustedDays = expiryDays;

    // Adjust based on priority
    switch (priority) {
      case 'critical':
        adjustedDays = Math.max(1, Math.floor(expiryDays / 2));
        break;
      case 'high':
        adjustedDays = Math.max(1, Math.floor(expiryDays * 0.7));
        break;
      case 'low':
        adjustedDays = expiryDays * 2;
        break;
      // 'normal' keeps original
    }

    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + adjustedDays);
    return expiryDate;
  }

  /**
   * Bulk save notifications - tối ưu cho nhiều recipients
   * @param {Array} recipients - Danh sách recipients
   * @param {Object} notification - Notification object  
   */
  async bulkSave(recipients, notification) {
    if (!recipients || recipients.length === 0) return;

    try {
      const expiryDate = this.calculateExpiryDate(
        notification.metadata?.expiryDays || 30,
        notification.priority
      );

      const notifications = recipients.map(recipient => ({
        userId: recipient._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        priority: notification.priority || 'normal',
        deliveryStatus: 'sent',
        sentAt: new Date(),
        expiresAt: expiryDate,
        metadata: {
          channels: notification.metadata?.channels || ['database'],
          relatedId: notification.metadata?.relatedId,
          relatedModel: notification.metadata?.relatedModel,
          sender: {
            type: 'system'
          }
        }
      }));

      const result = await Notification.insertMany(notifications);
      // Log disabled
      // console.log(`Bulk saved ${result.length} notifications`);
      return result;

    } catch (error) {
      console.error('Error bulk saving notifications:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra xem channel có sẵn sàng không
   * @returns {boolean}
   */
  isAvailable() {
    return true; // Database channel luôn available
  }
}
