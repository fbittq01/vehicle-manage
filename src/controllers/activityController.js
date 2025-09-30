import ActivityLogger from '../services/activityLogger.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';

const activityController = {
  // Lấy danh sách logs
  async getLogs(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        userId,
        action,
        resource,
        startDate,
        endDate,
        status
      } = req.query;

      const result = await ActivityLogger.getLogs({
        page: parseInt(page),
        limit: parseInt(limit),
        userId,
        action,
        resource,
        startDate,
        endDate,
        status
      });

      // Thêm mô tả tiếng Việt cho logs
      const logsWithDescriptions = result.logs.map(log => ({
        ...log,
        actionDescription: ActivityLogger.getActionDescription(log.action),
        resourceDescription: ActivityLogger.getResourceDescription(log.resource),
        statusDescription: log.status === 'SUCCESS' ? 'Thành công' : 'Thất bại'
      }));

      return sendPaginatedResponse(res, logsWithDescriptions, result.pagination, 'Lấy nhật ký hoạt động thành công');
    } catch (error) {
      return sendErrorResponse(res, error.message, 500);
    }
  },

  // Lấy thống kê
  async getStatistics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const stats = await ActivityLogger.getStatistics(startDate, endDate);
      
      return sendSuccessResponse(res, stats, 'Lấy thống kê thành công');
    } catch (error) {
      return sendErrorResponse(res, error.message, 500);
    }
  },

  // Lấy activities theo resource
  async getActivitiesByResource(req, res) {
    try {
      const { resource } = req.params;
      const { startDate, endDate } = req.query;
      
      const activities = await ActivityLogger.getActivitiesByResource(resource, startDate, endDate);
      
      // Thêm mô tả tiếng Việt cho activities
      const activitiesWithDescriptions = activities.map(log => ({
        ...log,
        actionDescription: ActivityLogger.getActionDescription(log.action),
        resourceDescription: ActivityLogger.getResourceDescription(log.resource),
        statusDescription: log.status === 'SUCCESS' ? 'Thành công' : 'Thất bại'
      }));
      
      return sendSuccessResponse(res, activitiesWithDescriptions, `Lấy hoạt động của ${ActivityLogger.getResourceDescription(resource)} thành công`);
    } catch (error) {
      return sendErrorResponse(res, error.message, 500);
    }
  },

  // Export logs
  async exportLogs(req, res) {
    try {
      const {
        userId,
        action,
        resource,
        startDate,
        endDate,
        status,
        format = 'json'
      } = req.query;

      const result = await ActivityLogger.getLogs({
        page: 1,
        limit: 10000, // Limit cho export
        userId,
        action,
        resource,
        startDate,
        endDate,
        status
      });

      if (format === 'csv') {
        const csv = convertToCSV(result.logs);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=activity_logs.csv');
        res.send(csv);
      } else {
        return sendSuccessResponse(res, result.logs, 'Xuất nhật ký hoạt động thành công');
      }
    } catch (error) {
      return sendErrorResponse(res, error.message, 500);
    }
  },

  // Lấy user activities
  async getUserActivities(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, startDate, endDate } = req.query;

      const result = await ActivityLogger.getLogs({
        page: parseInt(page),
        limit: parseInt(limit),
        userId,
        startDate,
        endDate
      });

      // Thêm mô tả tiếng Việt cho logs
      const logsWithDescriptions = result.logs.map(log => ({
        ...log,
        actionDescription: ActivityLogger.getActionDescription(log.action),
        resourceDescription: ActivityLogger.getResourceDescription(log.resource),
        statusDescription: log.status === 'SUCCESS' ? 'Thành công' : 'Thất bại'
      }));

      return sendPaginatedResponse(res, logsWithDescriptions, result.pagination, 'Lấy hoạt động người dùng thành công');
    } catch (error) {
      return sendErrorResponse(res, error.message, 500);
    }
  }
};

// Helper function để convert sang CSV
function convertToCSV(logs) {
  const headers = [
    'Thời gian',
    'Tên người dùng',
    'Email',
    'Họ tên',
    'Mã NV',
    'Phòng ban',
    'Hành động',
    'Tài nguyên',
    'ID Tài nguyên',
    'Địa chỉ IP',
    'Trạng thái',
    'Chi tiết'
  ];

  const rows = logs.map(log => [
    log.timestamp,
    log.userId ? log.userId.username : 'Không xác định',
    log.userId ? log.userId.email : 'Không xác định',
    log.userId ? log.userId.name : 'Không xác định',
    log.userId ? log.userId.employeeId : 'Không xác định',
    log.userId && log.userId.department ? log.userId.department.name : 'Không xác định',
    ActivityLogger.getActionDescription(log.action),
    ActivityLogger.getResourceDescription(log.resource),
    log.resourceId || '',
    log.ipAddress,
    log.status === 'SUCCESS' ? 'Thành công' : 'Thất bại',
    log.details ? JSON.stringify(log.details) : ''
  ]);

  return [headers, ...rows]
    .map(row => row.map(field => `"${field || ''}"`).join(','))
    .join('\n');
}

export default activityController;
