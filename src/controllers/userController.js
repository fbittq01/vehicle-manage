import { User } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination } from '../utils/response.js';
import { asyncHandler } from '../middleware/logger.js';

// Lấy danh sách tất cả users (admin only)
export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { role, isActive, search } = req.query;

  // Build query filter
  const filter = {};
  
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } }
    ];
  }

  // Execute query
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password -refreshTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  const pagination = createPagination(page, limit, total);

  sendPaginatedResponse(res, users, pagination, 'Lấy danh sách users thành công');
});

// Lấy thông tin user theo ID
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select('-password -refreshTokens');
  
  if (!user) {
    return sendErrorResponse(res, 'Không tìm thấy user', 404);
  }

  sendSuccessResponse(res, { user }, 'Lấy thông tin user thành công');
});

// Tạo user mới (admin only)
export const createUser = asyncHandler(async (req, res) => {
  const { username, password, name, phone, department, employeeId, role } = req.body;

  // Kiểm tra quyền tạo admin
  if (role === 'admin' && req.user.role !== 'super_admin') {
    return sendErrorResponse(res, 'Không có quyền tạo tài khoản admin', 403);
  }

  // Kiểm tra username đã tồn tại
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return sendErrorResponse(res, 'Username đã được sử dụng', 400);
  }

  // Kiểm tra employeeId nếu có
  if (employeeId) {
    const existingEmployee = await User.findOne({ employeeId });
    if (existingEmployee) {
      return sendErrorResponse(res, 'Mã nhân viên đã được sử dụng', 400);
    }
  }

  const user = new User({
    username,
    password,
    name,
    phone,
    department,
    employeeId,
    role: role || 'user'
  });

  await user.save();

  sendSuccessResponse(res, { user: user.toJSON() }, 'Tạo user thành công', 201);
});

// Cập nhật user
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, department, employeeId, role, isActive } = req.body;

  const user = await User.findById(id);
  if (!user) {
    return sendErrorResponse(res, 'Không tìm thấy user', 404);
  }

  // Kiểm tra quyền cập nhật
  if (req.user.role === 'user' && req.user._id.toString() !== id) {
    return sendErrorResponse(res, 'Không có quyền cập nhật user khác', 403);
  }

  // Chỉ super_admin mới có thể thay đổi role thành admin
  if (role === 'admin' && req.user.role !== 'super_admin') {
    return sendErrorResponse(res, 'Không có quyền gán role admin', 403);
  }

  // User thường không thể thay đổi role và isActive
  if (req.user.role === 'user') {
    delete req.body.role;
    delete req.body.isActive;
  }

  // Kiểm tra employeeId nếu thay đổi
  if (employeeId && employeeId !== user.employeeId) {
    const existingEmployee = await User.findOne({ 
      employeeId, 
      _id: { $ne: id } 
    });
    if (existingEmployee) {
      return sendErrorResponse(res, 'Mã nhân viên đã được sử dụng', 400);
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    { name, phone, department, employeeId, role, isActive },
    { new: true, runValidators: true }
  ).select('-password -refreshTokens');

  sendSuccessResponse(res, { user: updatedUser }, 'Cập nhật user thành công');
});

// Xóa user (chỉ deactivate)
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return sendErrorResponse(res, 'Không tìm thấy user', 404);
  }

  // Không thể xóa chính mình
  if (req.user._id.toString() === id) {
    return sendErrorResponse(res, 'Không thể xóa chính mình', 400);
  }

  // Không thể xóa super_admin
  if (user.role === 'super_admin') {
    return sendErrorResponse(res, 'Không thể xóa super admin', 400);
  }

  // Deactivate thay vì xóa hoàn toàn
  user.isActive = false;
  await user.save();

  sendSuccessResponse(res, null, 'Đã vô hiệu hóa user');
});

// Kích hoạt lại user
export const activateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByIdAndUpdate(
    id,
    { isActive: true },
    { new: true }
  ).select('-password -refreshTokens');

  if (!user) {
    return sendErrorResponse(res, 'Không tìm thấy user', 404);
  }

  sendSuccessResponse(res, { user }, 'Đã kích hoạt user');
});

// Reset mật khẩu user (admin only)
export const resetUserPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return sendErrorResponse(res, 'Mật khẩu mới là bắt buộc', 400);
  }

  const user = await User.findById(id);
  if (!user) {
    return sendErrorResponse(res, 'Không tìm thấy user', 404);
  }

  user.password = newPassword;
  // Clear all refresh tokens để force re-login
  user.refreshTokens = [];
  await user.save();

  sendSuccessResponse(res, null, 'Reset mật khẩu thành công');
});

// Thống kê users
export const getUserStats = asyncHandler(async (req, res) => {
  const stats = await User.aggregate([
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
    },
    {
      $project: {
        totalUsers: 1,
        activeUsers: 1,
        inactiveUsers: 1,
        roleStats: {
          $reduce: {
            input: '$usersByRole',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $let: {
                    vars: {
                      role: '$$this.role',
                      key: {
                        $concat: [
                          '$$this.role',
                          { $cond: ['$$this.isActive', '_active', '_inactive'] }
                        ]
                      }
                    },
                    in: {
                      $arrayToObject: [[{
                        k: '$$key',
                        v: { $add: [{ $ifNull: [{ $getField: '$$key' }, 0] }, 1] }
                      }]]
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

  sendSuccessResponse(res, stats[0] || {}, 'Lấy thống kê users thành công');
});
