import { User, Vehicle, AccessLog, WorkingHours, Camera } from '../models/index.js';
import { getDepartmentUserIds } from './departmentFilter.js';

/**
 * Tạo pipeline aggregation có department filter
 * @param {Object} user - User object
 * @param {String} ownerField - Field chứa owner ID
 * @param {Array} basePipeline - Base aggregation pipeline
 * @returns {Array} Updated pipeline với department filter
 */
export const createDepartmentAggregationPipeline = async (user, ownerField = 'owner', basePipeline = []) => {
  // Super admin không cần filter
  if (user.role === 'super_admin') {
    return basePipeline;
  }

  if (!user.department) {
    throw new Error('USER_NO_DEPARTMENT');
  }

  let matchStage = {};

  // User thường chỉ xem data của mình
  if (user.role === 'user') {
    matchStage[ownerField] = user._id;
  } else {
    // Admin xem data của users cùng department
    const userIds = await getDepartmentUserIds(user.department);
    matchStage[ownerField] = { $in: userIds };
  }

  // Thêm $match stage vào đầu pipeline
  return [{ $match: matchStage }, ...basePipeline];
};

/**
 * Lấy thống kê vehicles theo department
 */
export const getVehicleStatsByDepartment = async (user) => {
  const pipeline = await createDepartmentAggregationPipeline(user, 'owner', [
    {
      $group: {
        _id: null,
        totalVehicles: { $sum: 1 },
        activeVehicles: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        inactiveVehicles: {
          $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
        },
        vehiclesByType: {
          $push: {
            type: '$vehicleType',
            isActive: '$isActive'
          }
        }
      }
    }
  ]);

  const result = await Vehicle.aggregate(pipeline);
  return result[0] || {
    totalVehicles: 0,
    activeVehicles: 0,
    inactiveVehicles: 0,
    vehiclesByType: []
  };
};

/**
 * Lấy thống kê access logs theo department
 */
export const getAccessLogStatsByDepartment = async (user, startDate, endDate) => {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const pipeline = await createDepartmentAggregationPipeline(user, 'owner', [
    ...(Object.keys(dateFilter).length > 0 ? [{ $match: dateFilter }] : []),
    {
      $group: {
        _id: null,
        totalLogs: { $sum: 1 },
        entryLogs: {
          $sum: { $cond: [{ $eq: ['$action', 'entry'] }, 1, 0] }
        },
        exitLogs: {
          $sum: { $cond: [{ $eq: ['$action', 'exit'] }, 1, 0] }
        },
        verifiedLogs: {
          $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] }
        },
        unverifiedLogs: {
          $sum: { $cond: [{ $eq: ['$verificationStatus', 'unverified'] }, 1, 0] }
        }
      }
    }
  ]);

  const result = await AccessLog.aggregate(pipeline);
  return result[0] || {
    totalLogs: 0,
    entryLogs: 0,
    exitLogs: 0,
    verifiedLogs: 0,
    unverifiedLogs: 0
  };
};

/**
 * Lấy thống kê users theo department
 */
export const getUserStatsByDepartment = async (user) => {
  const pipeline = await createDepartmentAggregationPipeline(user, '_id', [
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        inactiveUsers: {
          $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
        },
        usersByRole: {
          $push: {
            role: '$role',
            isActive: '$isActive'
          }
        }
      }
    }
  ]);

  const result = await User.aggregate(pipeline);
  return result[0] || {
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    usersByRole: []
  };
};

/**
 * Lấy thống kê cameras theo department
 */
export const getCameraStatsByDepartment = async (user) => {
  const pipeline = await createDepartmentAggregationPipeline(user, 'managedBy', [
    {
      $group: {
        _id: null,
        totalCameras: { $sum: 1 },
        activeCameras: {
          $sum: { $cond: [{ $eq: ['$status.isActive', true] }, 1, 0] }
        },
        onlineCameras: {
          $sum: { $cond: [{ $eq: ['$status.isOnline', true] }, 1, 0] }
        },
        offlineCameras: {
          $sum: { $cond: [{ $eq: ['$status.isOnline', false] }, 1, 0] }
        }
      }
    }
  ]);

  const result = await Camera.aggregate(pipeline);
  return result[0] || {
    totalCameras: 0,
    activeCameras: 0,
    onlineCameras: 0,
    offlineCameras: 0
  };
};
