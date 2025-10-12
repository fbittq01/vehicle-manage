import ActivityLog from '../models/ActivityLog.js';
import { getStartOfDay, getEndOfDay } from '../utils/response.js';

class ActivityLogger {
  static async log({
    userId,
    action,
    resource = null,
    resourceId = null,
    details = null,
    ipAddress,
    userAgent,
    status = 'SUCCESS',
    errorMessage = null
  }) {
    try {
      const logEntry = new ActivityLog({
        userId,
        action,
        resource,
        resourceId,
        details,
        ipAddress,
        userAgent,
        status,
        errorMessage
      });
      
      await logEntry.save();
      return logEntry;
    } catch (error) {
      console.error('Error saving activity log:', error);
      // Không throw error để không ảnh hưởng đến luồng chính
    }
  }

  // Helper method cho user actions
  static async logUserAction({
    userId,
    action,
    targetUserId = null,
    details = null,
    ipAddress,
    userAgent,
    status = 'SUCCESS',
    errorMessage = null
  }) {
    return this.log({
      userId,
      action,
      resource: 'users',
      resourceId: targetUserId,
      details,
      ipAddress,
      userAgent,
      status,
      errorMessage
    });
  }

  // Helper method cho vehicle actions
  static async logVehicleAction({
    userId,
    action,
    vehicleId = null,
    details = null,
    ipAddress,
    userAgent,
    status = 'SUCCESS',
    errorMessage = null
  }) {
    return this.log({
      userId,
      action,
      resource: 'vehicles',
      resourceId: vehicleId,
      details,
      ipAddress,
      userAgent,
      status,
      errorMessage
    });
  }

  // Helper method cho department actions
  static async logDepartmentAction({
    userId,
    action,
    departmentId = null,
    details = null,
    ipAddress,
    userAgent,
    status = 'SUCCESS',
    errorMessage = null
  }) {
    return this.log({
      userId,
      action,
      resource: 'departments',
      resourceId: departmentId,
      details,
      ipAddress,
      userAgent,
      status,
      errorMessage
    });
  }

  // Helper method cho working hour actions
  static async logWorkingHourAction({
    userId,
    action,
    workingHourId = null,
    details = null,
    ipAddress,
    userAgent,
    status = 'SUCCESS',
    errorMessage = null
  }) {
    return this.log({
      userId,
      action,
      resource: 'working_hours',
      resourceId: workingHourId,
      details,
      ipAddress,
      userAgent,
      status,
      errorMessage
    });
  }

  // Helper method cho working hours request actions
  static async logWorkingHoursRequestAction({
    userId,
    action,
    requestId = null,
    details = null,
    ipAddress,
    userAgent,
    status = 'SUCCESS',
    errorMessage = null
  }) {
    return this.log({
      userId,
      action,
      resource: 'working_hours_requests',
      resourceId: requestId,
      details,
      ipAddress,
      userAgent,
      status,
      errorMessage
    });
  }

  // Helper method cho camera actions
  static async logCameraAction({
    userId,
    action,
    cameraId = null,
    details = null,
    ipAddress,
    userAgent,
    status = 'SUCCESS',
    errorMessage = null
  }) {
    return this.log({
      userId,
      action,
      resource: 'cameras',
      resourceId: cameraId,
      details,
      ipAddress,
      userAgent,
      status,
      errorMessage
    });
  }

  // Helper method cho access log actions
  static async logAccessLogAction({
    userId,
    action,
    accessLogId = null,
    details = null,
    ipAddress,
    userAgent,
    status = 'SUCCESS',
    errorMessage = null
  }) {
    return this.log({
      userId,
      action,
      resource: 'access_logs',
      resourceId: accessLogId,
      details,
      ipAddress,
      userAgent,
      status,
      errorMessage
    });
  }

  static async getLogs({
    page = 1,
    limit = 50,
    userId = null,
    action = null,
    resource = null,
    startDate = null,
    endDate = null,
    status = null
  }) {
    try {
      const query = {};
      
      if (userId) query.userId = userId;
      if (action) query.action = action;
      if (resource) query.resource = resource;
      if (status) query.status = status;
      
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = getStartOfDay(startDate);
        if (endDate) query.timestamp.$lte = getEndOfDay(endDate);
      }

      const logs = await ActivityLog.find(query)
        .populate({
          path: 'userId',
          select: 'username email name role department employeeId phone isActive',
          populate: {
            path: 'department',
            select: 'name code'
          }
        })
        .sort({ timestamp: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await ActivityLog.countDocuments(query);

      return {
        logs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      throw new Error('Error fetching activity logs: ' + error.message);
    }
  }

  static async getStatistics(startDate, endDate) {
    try {
      const matchQuery = {};
      if (startDate || endDate) {
        matchQuery.timestamp = {};
        if (startDate) matchQuery.timestamp.$gte = getStartOfDay(startDate);
        if (endDate) matchQuery.timestamp.$lte = getEndOfDay(endDate);
      }

      // Action statistics
      const actionStats = await ActivityLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
            }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Resource statistics
      const resourceStats = await ActivityLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$resource',
            count: { $sum: 1 },
            actions: { $addToSet: '$action' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // User activity statistics
      const userStats = await ActivityLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$userId',
            activityCount: { $sum: 1 },
            lastActivity: { $max: '$timestamp' },
            actions: { $addToSet: '$action' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            userId: '$_id',
            username: '$user.username',
            email: '$user.email',
            name: '$user.name',
            employeeId: '$user.employeeId',
            department: '$user.department',
            activityCount: 1,
            lastActivity: 1,
            actionCount: { $size: '$actions' }
          }
        },
        { $sort: { activityCount: -1 } },
        { $limit: 20 }
      ]);

      return {
        actionStats,
        resourceStats,
        userStats
      };
    } catch (error) {
      throw new Error('Error fetching statistics: ' + error.message);
    }
  }

  // Get activities by resource type
  static async getActivitiesByResource(resource, startDate, endDate) {
    try {
      const matchQuery = { resource };
      if (startDate || endDate) {
        matchQuery.timestamp = {};
        if (startDate) matchQuery.timestamp.$gte = getStartOfDay(startDate);
        if (endDate) matchQuery.timestamp.$lte = getEndOfDay(endDate);
      }

      const activities = await ActivityLog.find(matchQuery)
        .populate({
          path: 'userId',
          select: 'username email name role department employeeId',
          populate: {
            path: 'department',
            select: 'name code'
          }
        })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

      return activities;
    } catch (error) {
      throw new Error('Error fetching activities by resource: ' + error.message);
    }
  }

  // Helper để chuyển đổi action thành tiếng Việt
  static getActionDescription(action) {
    const actionMap = {
      // Authentication actions
      'LOGIN': 'Đăng nhập',
      'LOGOUT': 'Đăng xuất',
      'CHANGE_PASSWORD': 'Đổi mật khẩu',
      'RESET_PASSWORD': 'Đặt lại mật khẩu',
      'FORGOT_PASSWORD': 'Quên mật khẩu',
      
      // User management actions
      'CREATE_USER': 'Tạo người dùng',
      'UPDATE_USER': 'Cập nhật người dùng',
      'DELETE_USER': 'Xóa người dùng',
      'UPDATE_PROFILE': 'Cập nhật hồ sơ',
      'CHANGE_ROLE': 'Thay đổi vai trò',
      'ACTIVATE_USER': 'Kích hoạt người dùng',
      'DEACTIVATE_USER': 'Vô hiệu hóa người dùng',
      'VIEW_USER': 'Xem người dùng',
      'BULK_UPDATE_USERS': 'Cập nhật hàng loạt người dùng',
      
      // Vehicle management actions
      'CREATE_VEHICLE': 'Tạo phương tiện',
      'UPDATE_VEHICLE': 'Cập nhật phương tiện',
      'DELETE_VEHICLE': 'Xóa phương tiện',
      'VIEW_VEHICLE': 'Xem phương tiện',
      'ASSIGN_VEHICLE': 'Gán phương tiện',
      'UNASSIGN_VEHICLE': 'Hủy gán phương tiện',
      'CHANGE_VEHICLE_STATUS': 'Thay đổi trạng thái phương tiện',
      'BULK_CREATE_VEHICLES': 'Tạo hàng loạt phương tiện',
      'BULK_UPDATE_VEHICLES': 'Cập nhật hàng loạt phương tiện',
      'BULK_DELETE_VEHICLES': 'Xóa hàng loạt phương tiện',
      'EXPORT_VEHICLES': 'Xuất danh sách phương tiện',
      'IMPORT_VEHICLES': 'Nhập danh sách phương tiện',
      
      // Department management actions
      'CREATE_DEPARTMENT': 'Tạo phòng ban',
      'UPDATE_DEPARTMENT': 'Cập nhật phòng ban',
      'DELETE_DEPARTMENT': 'Xóa phòng ban',
      'VIEW_DEPARTMENT': 'Xem phòng ban',
      'ASSIGN_USER_TO_DEPARTMENT': 'Gán người dùng vào phòng ban',
      'REMOVE_USER_FROM_DEPARTMENT': 'Loại bỏ người dùng khỏi phòng ban',
      'CHANGE_DEPARTMENT_HEAD': 'Thay đổi trưởng phòng',
      'ACTIVATE_DEPARTMENT': 'Kích hoạt phòng ban',
      'DEACTIVATE_DEPARTMENT': 'Vô hiệu hóa phòng ban',
      
      // Working Hour management actions
      'CREATE_WORKING_HOUR': 'Tạo giờ làm việc',
      'UPDATE_WORKING_HOUR': 'Cập nhật giờ làm việc',
      'DELETE_WORKING_HOUR': 'Xóa giờ làm việc',
      'VIEW_WORKING_HOUR': 'Xem giờ làm việc',
      'APPROVE_WORKING_HOUR': 'Phê duyệt giờ làm việc',
      'REJECT_WORKING_HOUR': 'Từ chối giờ làm việc',
      'SUBMIT_WORKING_HOUR': 'Gửi giờ làm việc',
      'CALCULATE_OVERTIME': 'Tính làm thêm giờ',
      'EXPORT_WORKING_HOURS': 'Xuất báo cáo giờ làm việc',
      'IMPORT_WORKING_HOURS': 'Nhập giờ làm việc',
      'ACTIVATE_WORKING_HOUR': 'Kích hoạt cấu hình giờ làm việc',
      
      // Working Hours Request actions
      'CREATE_WORKING_HOURS_REQUEST': 'Tạo yêu cầu giờ làm việc',
      'UPDATE_WORKING_HOURS_REQUEST': 'Cập nhật yêu cầu giờ làm việc',
      'DELETE_WORKING_HOURS_REQUEST': 'Xóa yêu cầu giờ làm việc',
      'APPROVE_WORKING_HOURS_REQUEST': 'Phê duyệt yêu cầu giờ làm việc',
      'REJECT_WORKING_HOURS_REQUEST': 'Từ chối yêu cầu giờ làm việc',
      'SUBMIT_WORKING_HOURS_REQUEST': 'Gửi yêu cầu giờ làm việc',
      'VIEW_WORKING_HOURS_REQUEST': 'Xem yêu cầu giờ làm việc',
      
      // Camera management actions
      'CREATE_CAMERA': 'Tạo camera',
      'UPDATE_CAMERA': 'Cập nhật camera',
      'DELETE_CAMERA': 'Xóa camera',
      'VIEW_CAMERA': 'Xem camera',
      'ACTIVATE_CAMERA': 'Kích hoạt camera',
      'DEACTIVATE_CAMERA': 'Vô hiệu hóa camera',
      'TEST_CAMERA': 'Kiểm tra camera',
      'CONFIGURE_CAMERA': 'Cấu hình camera',
      
      // Access Log actions
      'VIEW_ACCESS_LOG': 'Xem nhật ký ra vào',
      'CREATE_ACCESS_LOG': 'Tạo nhật ký ra vào',
      'UPDATE_ACCESS_LOG': 'Cập nhật nhật ký ra vào',
      'DELETE_ACCESS_LOG': 'Xóa nhật ký ra vào',
      'EXPORT_ACCESS_LOGS': 'Xuất nhật ký ra vào',
      'PROCESS_ACCESS_LOG': 'Xử lý nhật ký ra vào',
      
      // Report and analytics actions
      'VIEW_REPORT': 'Xem báo cáo',
      'GENERATE_REPORT': 'Tạo báo cáo',
      'EXPORT_DATA': 'Xuất dữ liệu',
      'IMPORT_DATA': 'Nhập dữ liệu',
      'VIEW_ANALYTICS': 'Xem phân tích',
      'VIEW_DASHBOARD': 'Xem trang tổng quan',
      
      // System actions
      'BACKUP_DATA': 'Sao lưu dữ liệu',
      'RESTORE_DATA': 'Khôi phục dữ liệu',
      'CLEAR_LOGS': 'Xóa nhật ký',
      'SYSTEM_MAINTENANCE': 'Bảo trì hệ thống',
      'UPDATE_SETTINGS': 'Cập nhật cài đặt'
    };
    
    return actionMap[action] || action;
  }

  // Helper để chuyển đổi resource thành tiếng Việt
  static getResourceDescription(resource) {
    const resourceMap = {
      'users': 'Người dùng',
      'vehicles': 'Phương tiện',
      'departments': 'Phòng ban',
      'working_hours': 'Giờ làm việc',
      'working_hours_requests': 'Yêu cầu giờ làm việc',
      'cameras': 'Camera',
      'access_logs': 'Nhật ký ra vào'
    };
    
    return resourceMap[resource] || resource;
  }
}

export default ActivityLogger;
