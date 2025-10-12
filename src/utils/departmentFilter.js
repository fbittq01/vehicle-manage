import { User } from '../models/index.js';

// Cache để lưu trữ department users trong memory (TTL: 5 phút)
const departmentCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

/**
 * Lấy danh sách user IDs trong cùng department (có cache)
 * @param {String} departmentId - ID của department
 * @param {Boolean} includeInactive - Có bao gồm user không active không
 * @returns {Array} Array of user IDs
 */
export const getDepartmentUserIds = async (departmentId, includeInactive = false) => {
  if (!departmentId) return [];

  const cacheKey = `${departmentId}_${includeInactive}`;
  const cached = departmentCache.get(cacheKey);
  
  // Kiểm tra cache còn hạn không
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.userIds;
  }

  // Query database
  const filter = { department: departmentId };
  if (!includeInactive) {
    filter.isActive = true;
  }

  const departmentUsers = await User.find(filter).select('_id');
  const userIds = departmentUsers.map(user => user._id);

  // Lưu vào cache
  departmentCache.set(cacheKey, {
    userIds,
    timestamp: Date.now()
  });

  return userIds;
};

/**
 * Xóa cache cho department cụ thể (khi có user thay đổi department)
 * @param {String} departmentId - ID của department
 */
export const clearDepartmentCache = (departmentId) => {
  if (!departmentId) return;
  
  // Xóa tất cả cache liên quan đến department này
  for (const key of departmentCache.keys()) {
    if (key.startsWith(departmentId)) {
      departmentCache.delete(key);
    }
  }
};

/**
 * Xóa toàn bộ cache (sử dụng khi cần refresh hoàn toàn)
 */
export const clearAllDepartmentCache = () => {
  departmentCache.clear();
};

/**
 * Tạo department filter cho MongoDB query
 * @param {Object} user - User object từ req.user
 * @param {Object} options - Tùy chọn filter
 * @param {String} options.ownerField - Tên field chứa user ID (default: 'owner')
 * @param {String} options.departmentField - Tên field chứa department ID
 * @param {Boolean} options.allowSelfOnly - User thường chỉ xem data của mình (default: true)
 * @returns {Object} Filter object cho MongoDB
 */
export const createDepartmentFilter = async (user, options = {}) => {
  const {
    ownerField = 'owner',
    departmentField = 'department',
    allowSelfOnly = true
  } = options;

  // Super admin xem tất cả
  if (user.role === 'super_admin') {
    return {};
  }

  // Kiểm tra user có department không
  if (!user.department) {
    throw new Error('USER_NO_DEPARTMENT');
  }

  // User thường chỉ xem data của mình
  if (user.role === 'user' && allowSelfOnly) {
    return { [ownerField]: user._id };
  }

  // Admin xem data của users cùng department
  if (user.role === 'admin' || (user.role === 'user' && !allowSelfOnly)) {
    const userIds = await getDepartmentUserIds(user.department);
    
    if (departmentField && ownerField) {
      // Trường hợp có cả department field và owner field
      return {
        $or: [
          { [departmentField]: user.department },
          { [ownerField]: { $in: userIds } }
        ]
      };
    } else if (departmentField) {
      // Chỉ có department field
      return { [departmentField]: user.department };
    } else {
      // Chỉ có owner field
      return { [ownerField]: { $in: userIds } };
    }
  }

  return {};
};

/**
 * Middleware để tự động tạo department filter
 * @param {Object} options - Tùy chọn filter
 */
export const departmentFilterMiddleware = (options = {}) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next();
      }

      const filter = await createDepartmentFilter(req.user, options);
      req.departmentFilter = filter;
      next();
    } catch (error) {
      if (error.message === 'USER_NO_DEPARTMENT') {
        return res.status(403).json({
          success: false,
          message: 'Bạn chưa được phân công vào phòng ban nào'
        });
      }
      
      console.error('Department filter error:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi hệ thống khi áp dụng filter department'
      });
    }
  };
};

/**
 * Helper function để apply department filter vào base filter
 * @param {Object} req - Request object
 * @param {Object} baseFilter - Base filter object
 * @returns {Object} Combined filter
 */
export const applyDepartmentFilter = (req, baseFilter = {}) => {
  if (req.departmentFilter && Object.keys(req.departmentFilter).length > 0) {
    return { ...baseFilter, ...req.departmentFilter };
  }
  return baseFilter;
};

/**
 * Kiểm tra quyền truy cập resource cụ thể
 * @param {Object} user - User object
 * @param {Object} resource - Resource object cần kiểm tra
 * @param {String} ownerField - Field chứa owner ID trong resource
 * @param {String} departmentField - Field chứa department ID trong resource
 * @returns {Boolean} Có quyền truy cập hay không
 */
export const checkResourceAccess = async (user, resource, ownerField = 'owner', departmentField = 'department') => {
  // Super admin có quyền truy cập tất cả
  if (user.role === 'super_admin') {
    return true;
  }

  // Kiểm tra user có department không
  if (!user.department) {
    return false;
  }

  // Nếu là owner của resource
  if (resource[ownerField] && resource[ownerField].toString() === user._id.toString()) {
    return true;
  }

  // Nếu resource thuộc cùng department
  if (resource[departmentField] && resource[departmentField].toString() === user.department.toString()) {
    return user.role === 'admin'; // Chỉ admin mới có quyền
  }

  // Nếu owner của resource thuộc cùng department
  if (resource[ownerField]) {
    const ownerUser = await User.findById(resource[ownerField]).select('department');
    if (ownerUser && ownerUser.department && ownerUser.department.toString() === user.department.toString()) {
      return user.role === 'admin'; // Chỉ admin mới có quyền
    }
  }

  return false;
};

// Cleanup cache định kỳ (chạy mỗi 10 phút)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of departmentCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      departmentCache.delete(key);
    }
  }
}, 10 * 60 * 1000);
