import { User, Department, AccessLog, WorkingHoursRequest, Notification } from '../models/index.js';

class NotificationService {
  constructor(socketService) {
    this.socketService = socketService;
  }

  /**
   * Gửi thông báo khi có yêu cầu ra/vào mới
   * @param {Object} workingHoursRequest - Yêu cầu ra/vào
   */
  async notifyWorkingHoursRequest(workingHoursRequest) {
    try {
      // Populate thông tin người yêu cầu và department
      const populatedRequest = await WorkingHoursRequest
        .findById(workingHoursRequest._id)
        .populate({
          path: 'requestedBy',
          select: 'name username department',
          populate: {
            path: 'department',
            select: 'name code manager parentDepartment',
            populate: {
              path: 'manager parentDepartment',
              select: 'name username department'
            }
          }
        });

      if (!populatedRequest) return;

      const notification = {
        type: 'working_hours_request',
        data: {
          requestId: populatedRequest._id,
          requestType: populatedRequest.requestType,
          requestedBy: {
            id: populatedRequest.requestedBy._id,
            name: populatedRequest.requestedBy.name,
            username: populatedRequest.requestedBy.username
          },
          department: populatedRequest.requestedBy.department ? {
            id: populatedRequest.requestedBy.department._id,
            name: populatedRequest.requestedBy.department.name,
            code: populatedRequest.requestedBy.department.code
          } : null,
          plannedDateTime: populatedRequest.plannedDateTime,
          plannedEndDateTime: populatedRequest.plannedEndDateTime,
          licensePlate: populatedRequest.licensePlate,
          reason: populatedRequest.reason,
          status: populatedRequest.status,
          priority: populatedRequest.priority,
          createdAt: populatedRequest.createdAt
        },
        title: 'Yêu cầu ra/vào mới',
        message: `${populatedRequest.requestedBy.name} đã tạo yêu cầu ${this.getRequestTypeText(populatedRequest.requestType)} cho xe ${populatedRequest.licensePlate}`,
        timestamp: new Date(),
        priority: populatedRequest.priority || 'normal'
      };

      // Tìm các admin cấp trên thuộc department
      await this.notifyDepartmentAdmins(populatedRequest.requestedBy.department, notification);

    } catch (error) {
      console.error('Error in notifyWorkingHoursRequest:', error);
    }
  }

  /**
   * Gửi thông báo khi có access log cần verify
   * @param {Object} accessLog - Access log cần verify
   */
  async notifyAccessLogVerification(accessLog) {
    try {
      // Populate thông tin access log
      const populatedLog = await AccessLog
        .findById(accessLog._id)
        .populate({
          path: 'owner',
          select: 'name username department',
          populate: {
            path: 'department',
            select: 'name code'
          }
        })
        .populate('vehicle', 'brand model color description');

      if (!populatedLog) return;

      const notification = {
        type: 'access_log_verification',
        data: {
          accessLogId: populatedLog._id,
          licensePlate: populatedLog.licensePlate,
          action: populatedLog.action,
          gateId: populatedLog.gateId,
          gateName: populatedLog.gateName,
          owner: populatedLog.owner ? {
            id: populatedLog.owner._id,
            name: populatedLog.owner.name,
            username: populatedLog.owner.username,
            department: populatedLog.owner.department
          } : null,
          vehicle: populatedLog.vehicle,
          confidence: populatedLog.recognitionData?.confidence,
          verificationStatus: populatedLog.verificationStatus,
          isVehicleRegistered: populatedLog.isVehicleRegistered,
          createdAt: populatedLog.createdAt
        },
        title: 'Access Log cần xác minh',
        message: `Xe ${populatedLog.licensePlate} ${populatedLog.action === 'entry' ? 'vào' : 'ra'} tại ${populatedLog.gateName || populatedLog.gateId} cần xác minh`,
        timestamp: new Date(),
        priority: populatedLog.recognitionData?.confidence < 0.8 ? 'high' : 'normal'
      };

      // Gửi thông báo tới tất cả supervisor
      await this.notifySupervisors(notification);

    } catch (error) {
      console.error('Error in notifyAccessLogVerification:', error);
    }
  }

  /**
   * Gửi thông báo cập nhật trạng thái yêu cầu ra/vào
   * @param {Object} workingHoursRequest - Yêu cầu đã được cập nhật
   * @param {string} previousStatus - Trạng thái trước đó
   */
  async notifyWorkingHoursRequestUpdate(workingHoursRequest, previousStatus) {
    try {
      const populatedRequest = await WorkingHoursRequest
        .findById(workingHoursRequest._id)
        .populate('requestedBy', 'name username')
        .populate('approvedBy', 'name username');

      if (!populatedRequest) return;

      const notification = {
        type: 'working_hours_request_update',
        data: {
          requestId: populatedRequest._id,
          status: populatedRequest.status,
          previousStatus,
          requestedBy: populatedRequest.requestedBy,
          approvedBy: populatedRequest.approvedBy,
          licensePlate: populatedRequest.licensePlate,
          requestType: populatedRequest.requestType,
          updatedAt: populatedRequest.updatedAt
        },
        title: 'Cập nhật yêu cầu ra/vào',
        message: `Yêu cầu ${this.getRequestTypeText(populatedRequest.requestType)} cho xe ${populatedRequest.licensePlate} đã được ${this.getStatusText(populatedRequest.status)}`,
        timestamp: new Date(),
        priority: 'normal'
      };

      // Gửi thông báo tới người yêu cầu
      await this.notifyUser(populatedRequest.requestedBy._id, notification);

    } catch (error) {
      console.error('Error in notifyWorkingHoursRequestUpdate:', error);
    }
  }

  /**
   * Gửi thông báo khi access log được verify
   * @param {Object} accessLog - Access log đã được verify
   */
  async notifyAccessLogVerified(accessLog) {
    try {
      const populatedLog = await AccessLog
        .findById(accessLog._id)
        .populate('owner', 'name username')
        .populate('verifiedBy', 'name username');

      if (!populatedLog || !populatedLog.owner) return;

      const notification = {
        type: 'access_log_verified',
        data: {
          accessLogId: populatedLog._id,
          licensePlate: populatedLog.licensePlate,
          action: populatedLog.action,
          verificationStatus: populatedLog.verificationStatus,
          verifiedBy: populatedLog.verifiedBy,
          verificationNote: populatedLog.verificationNote,
          verificationTime: populatedLog.verificationTime
        },
        title: 'Access Log đã được xác minh',
        message: `Xe ${populatedLog.licensePlate} đã được ${populatedLog.verificationStatus === 'approved' ? 'phê duyệt' : 'từ chối'} bởi ${populatedLog.verifiedBy?.name}`,
        timestamp: new Date(),
        priority: 'normal'
      };

      // Gửi thông báo tới chủ xe
      await this.notifyUser(populatedLog.owner._id, notification);

    } catch (error) {
      console.error('Error in notifyAccessLogVerified:', error);
    }
  }

  /**
   * Gửi thông báo tới các admin trong department và department cha
   * @param {string} departmentId - ID của department
   * @param {Object} notification - Thông báo cần gửi
   */
  async notifyDepartmentAdmins(departmentId, notification) {
    if (!departmentId) return;

    try {
      // Tìm tất cả admin trong department và department cha
      const adminUsers = await this.findDepartmentAdmins(departmentId);
      
      // Gửi thông báo tới từng admin
      for (const admin of adminUsers) {
        await this.notifyUser(admin._id, notification);
      }

      // Gửi thông báo tới room department để các admin online nhận ngay
      this.socketService.io?.to(`department_${departmentId}`).emit('notification', notification);

    } catch (error) {
      console.error('Error in notifyDepartmentAdmins:', error);
    }
  }

  /**
   * Gửi thông báo tới tất cả supervisor
   * @param {Object} notification - Thông báo cần gửi
   */
  async notifySupervisors(notification) {
    try {
      const supervisors = await User.find({ role: 'supervisor', isActive: true })
        .select('_id name username');

      // Gửi thông báo tới từng supervisor
      for (const supervisor of supervisors) {
        await this.notifyUser(supervisor._id, notification);
      }

      // Gửi thông báo tới room supervisor để các supervisor online nhận ngay
      this.socketService.io?.to('role_supervisor').emit('notification', notification);

    } catch (error) {
      console.error('Error in notifySupervisors:', error);
    }
  }

  /**
   * Gửi thông báo tới một user cụ thể
   * @param {string} userId - ID của user
   * @param {Object} notification - Thông báo cần gửi
   */
  async notifyUser(userId, notification) {
    try {
      // Gửi thông báo realtime qua socket
      this.socketService.io?.to(`user_${userId}`).emit('notification', notification);

      // TODO: Lưu thông báo vào database để user có thể xem lại sau
      await this.saveNotificationToDatabase(userId, notification);

    } catch (error) {
      console.error('Error in notifyUser:', error);
    }
  }

  /**
   * Tìm tất cả admin trong department và department cha
   * @param {string} departmentId - ID của department
   * @returns {Array} Danh sách admin users
   */
  async findDepartmentAdmins(departmentId) {
    const adminUsers = [];
    
    try {
      // Tìm department hiện tại
      const department = await Department.findById(departmentId)
        .populate('manager', '_id name username role')
        .populate('parentDepartment');

      if (!department) return adminUsers;

      // Thêm manager của department hiện tại nếu là admin
      if (department.manager && department.manager.role === 'admin') {
        adminUsers.push(department.manager);
      }

      // Tìm tất cả admin trong department hiện tại
      const departmentAdmins = await User.find({
        department: departmentId,
        role: 'admin',
        isActive: true
      }).select('_id name username role');

      adminUsers.push(...departmentAdmins);

      // Đệ quy tìm admin trong department cha
      if (department.parentDepartment) {
        const parentAdmins = await this.findDepartmentAdmins(department.parentDepartment._id);
        adminUsers.push(...parentAdmins);
      }

      // Loại bỏ trùng lặp
      const uniqueAdmins = adminUsers.filter((admin, index, self) => 
        index === self.findIndex(a => a._id.toString() === admin._id.toString())
      );

      return uniqueAdmins;

    } catch (error) {
      console.error('Error in findDepartmentAdmins:', error);
      return adminUsers;
    }
  }

  /**
   * Helper function: Chuyển đổi request type thành text
   */
  getRequestTypeText(requestType) {
    const typeMap = {
      'entry': 'vào',
      'exit': 'ra',
      'both': 'ra/vào'
    };
    return typeMap[requestType] || requestType;
  }

  /**
   * Helper function: Chuyển đổi status thành text
   */
  getStatusText(status) {
    const statusMap = {
      'pending': 'chờ duyệt',
      'approved': 'phê duyệt',
      'rejected': 'từ chối',
      'expired': 'hết hạn'
    };
    return statusMap[status] || status;
  }

  /**
   * Lưu thông báo vào database
   * @param {string} userId - ID của user nhận thông báo
   * @param {Object} notification - Dữ liệu thông báo
   */
  async saveNotificationToDatabase(userId, notification) {
    try {
      // Tạo document notification mới
      const notificationDoc = new Notification({
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        priority: notification.priority || 'normal',
        deliveryStatus: 'sent',
        sentAt: new Date(),
        metadata: {
          channels: ['socket'],
          relatedId: notification.data?.requestId || notification.data?.accessLogId,
          relatedModel: this.getRelatedModel(notification.type),
          sender: {
            type: 'system'
          }
        }
      });

      // Set thời gian hết hạn dựa trên loại thông báo
      const expiryDate = this.getExpiryDate(notification.type, notification.priority);
      if (expiryDate) {
        notificationDoc.expiresAt = expiryDate;
      }

      await notificationDoc.save();
      
      console.log(`💾 Notification saved to database for user ${userId}: ${notification.title}`);
      
      return notificationDoc;
    } catch (error) {
      console.error('Error saving notification to database:', error);
      throw error;
    }
  }

  /**
   * Xác định model liên quan dựa trên loại thông báo
   * @param {string} notificationType - Loại thông báo
   * @returns {string} Tên model liên quan
   */
  getRelatedModel(notificationType) {
    const modelMap = {
      'working_hours_request': 'WorkingHoursRequest',
      'working_hours_request_update': 'WorkingHoursRequest',
      'access_log_verification': 'AccessLog',
      'access_log_verified': 'AccessLog'
    };
    return modelMap[notificationType] || null;
  }

  /**
   * Tính toán thời gian hết hạn dựa trên loại và mức độ ưu tiên
   * @param {string} notificationType - Loại thông báo
   * @param {string} priority - Mức độ ưu tiên
   * @returns {Date} Thời gian hết hạn
   */
  getExpiryDate(notificationType, priority) {
    const now = new Date();
    let daysToExpire = 30; // Mặc định 30 ngày

    // Điều chỉnh thời gian hết hạn theo loại thông báo
    switch (notificationType) {
      case 'working_hours_request':
        daysToExpire = 7; // Yêu cầu ra/vào hết hạn sau 7 ngày
        break;
      case 'working_hours_request_update':
        daysToExpire = 3; // Cập nhật trạng thái hết hạn sau 3 ngày
        break;
      case 'access_log_verification':
        daysToExpire = 1; // Thông báo verify hết hạn sau 1 ngày
        break;
      case 'access_log_verified':
        daysToExpire = 7; // Kết quả verify hết hạn sau 7 ngày
        break;
      case 'emergency_alert':
        daysToExpire = 1; // Cảnh báo khẩn cấp hết hạn sau 1 ngày
        break;
    }

    // Điều chỉnh theo mức độ ưu tiên
    switch (priority) {
      case 'critical':
        daysToExpire = Math.max(1, Math.floor(daysToExpire / 2)); // Giảm một nửa nhưng tối thiểu 1 ngày
        break;
      case 'high':
        daysToExpire = Math.max(1, Math.floor(daysToExpire * 0.7)); // Giảm 30%
        break;
      case 'low':
        daysToExpire = daysToExpire * 2; // Tăng gấp đôi
        break;
      // 'normal' giữ nguyên
    }

    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + daysToExpire);
    return expiryDate;
  }

  /**
   * Lấy danh sách thông báo chưa đọc của user
   * @param {string} userId - ID của user
   * @param {number} limit - Số lượng thông báo tối đa
   * @returns {Array} Danh sách thông báo
   */
  async getUnreadNotifications(userId, limit = 20) {
    try {
      return await Notification.getUnreadByUser(userId, limit);
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
      return await Notification.countUnread(userId);
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
      const notification = await Notification.findOne({
        _id: notificationId,
        userId: userId
      });

      if (!notification) {
        throw new Error('Notification not found or access denied');
      }

      if (!notification.isRead) {
        await notification.markAsRead();
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
      const result = await Notification.cleanupOldNotifications(daysToKeep);
      console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }
}

export default NotificationService;
