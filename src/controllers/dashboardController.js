import { sendSuccessResponse, sendErrorResponse, getStartOfDay, getEndOfDay } from '../utils/response.js';
import { asyncHandler } from '../middleware/logger.js';
import { 
  getUserStatsByDepartment, 
  getVehicleStatsByDepartment, 
  getAccessLogStatsByDepartment, 
  getCameraStatsByDepartment 
} from '../utils/departmentStats.js';

/**
 * Lấy tổng quan dashboard theo department
 */
export const getDashboardOverview = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Lấy thống kê song song để tối ưu performance
    const [userStats, vehicleStats, accessLogStats, cameraStats] = await Promise.all([
      getUserStatsByDepartment(req.user),
      getVehicleStatsByDepartment(req.user),
      getAccessLogStatsByDepartment(req.user, startDate, endDate),
      getCameraStatsByDepartment(req.user)
    ]);

    const overview = {
      users: userStats,
      vehicles: vehicleStats,
      accessLogs: accessLogStats,
      cameras: cameraStats,
      summary: {
        totalEntities: userStats.totalUsers + vehicleStats.totalVehicles + cameraStats.totalCameras,
        activeEntities: userStats.activeUsers + vehicleStats.activeVehicles + cameraStats.activeCameras,
        department: req.user.role === 'super_admin' ? 'ALL_DEPARTMENTS' : req.user.department,
        generatedAt: new Date(),
        dateRange: {
          startDate: startDate ? getStartOfDay(startDate) : null,
          endDate: endDate ? getEndOfDay(endDate) : null
        }
      }
    };

    sendSuccessResponse(res, overview, 'Lấy tổng quan dashboard thành công');
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    throw error;
  }
});

/**
 * Lấy thống kê truy cập theo thời gian (recent activity)
 */
export const getRecentActivity = asyncHandler(async (req, res) => {
  try {
    const { limit = 10, hours = 24 } = req.query;
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const stats = await getAccessLogStatsByDepartment(req.user, startDate, new Date());
    
    sendSuccessResponse(res, {
      ...stats,
      timeRange: {
        hours: parseInt(hours),
        from: startDate,
        to: new Date()
      }
    }, 'Lấy hoạt động gần đây thành công');
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    throw error;
  }
});

/**
 * Lấy xu hướng theo tuần/tháng
 */
export const getTrends = asyncHandler(async (req, res) => {
  try {
    const { period = 'week' } = req.query; // week, month
    
    let daysBack;
    switch (period) {
      case 'week':
        daysBack = 7;
        break;
      case 'month':
        daysBack = 30;
        break;
      default:
        daysBack = 7;
    }

    const endDate = new Date();
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    
    const stats = await getAccessLogStatsByDepartment(req.user, startDate, endDate);
    
    // Tính toán tỷ lệ tăng trưởng (giả định - cần logic phức tạp hơn)
    const avgLogsPerDay = stats.totalLogs / daysBack;
    
    sendSuccessResponse(res, {
      period,
      daysAnalyzed: daysBack,
      totalLogs: stats.totalLogs,
      averageLogsPerDay: Math.round(avgLogsPerDay * 100) / 100,
      entryExitRatio: stats.exitLogs > 0 ? Math.round((stats.entryLogs / stats.exitLogs) * 100) / 100 : 0,
      verificationRate: stats.totalLogs > 0 ? Math.round((stats.verifiedLogs / stats.totalLogs) * 100) : 0,
      dateRange: {
        from: startDate,
        to: endDate
      }
    }, `Lấy xu hướng ${period} thành công`);
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    throw error;
  }
});

/**
 * Lấy top entities (vehicles, users có hoạt động nhiều nhất)
 */
export const getTopEntities = asyncHandler(async (req, res) => {
  try {
    const { type = 'vehicles', limit = 5, days = 7 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Placeholder - cần implement logic aggregation phức tạp hơn
    // Đây chỉ là structure response
    const result = {
      type,
      limit: parseInt(limit),
      period: `${days} days`,
      data: [], // Sẽ chứa top entities
      generatedAt: new Date()
    };
    
    sendSuccessResponse(res, result, `Lấy top ${type} thành công`);
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    throw error;
  }
});
