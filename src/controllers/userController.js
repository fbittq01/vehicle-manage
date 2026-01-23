import { User } from '../models/index.js';
import { sendSuccessResponse, sendErrorResponse, sendPaginatedResponse } from '../utils/response.js';
import { getPaginationParams, createPagination } from '../utils/response.js';
import { asyncHandler } from '../middleware/logger.js';
import { createDepartmentFilter, checkResourceAccess, clearDepartmentCache } from '../utils/departmentFilter.js';
import { getUserStatsByDepartment } from '../utils/departmentStats.js';

// Lấy danh sách tất cả users (admin only)
export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  const { role, isActive, search } = req.query;

  // Build base query filter
  const baseFilter = {};
  
  if (role) baseFilter.role = role;
  if (isActive !== undefined) baseFilter.isActive = isActive === 'true';
  
  if (search) {
    baseFilter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } }
    ];
  }

  try {
    // Tạo department filter
    const departmentFilter = await createDepartmentFilter(req.user, {
      ownerField: '_id', // User collection sử dụng _id làm owner
      departmentField: 'department',
      allowSelfOnly: req.user.role === 'user' // User chỉ xem thông tin của mình
    });

    const filter = { ...baseFilter, ...departmentFilter };

    // Fix conflict: baseFilter and departmentFilter both use $or
    if (baseFilter.$or && departmentFilter.$or) {
      filter.$and = [
        { $or: baseFilter.$or },
        { $or: departmentFilter.$or }
      ];
      delete filter.$or;
    }

    // Execute query
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshTokens')
        .populate('department', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    const pagination = createPagination(page, limit, total);

    sendPaginatedResponse(res, users, pagination, 'Lấy danh sách users thành công');
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    throw error;
  }
});

// Lấy thông tin user theo ID
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id)
    .select('-password -refreshTokens')
    .populate('department', 'name code');
  
  if (!user) {
    return sendErrorResponse(res, 'Không tìm thấy user', 404);
  }

  // Kiểm tra quyền truy cập
  const hasAccess = await checkResourceAccess(req.user, user, '_id', 'department');
  if (!hasAccess) {
    return sendErrorResponse(res, 'Không có quyền xem thông tin user này', 403);
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

  const user = await User.findById(id).populate('department', 'name code');
  if (!user) {
    return sendErrorResponse(res, 'Không tìm thấy user', 404);
  }

  // Kiểm tra quyền truy cập
  const hasAccess = await checkResourceAccess(req.user, user, '_id', 'department');
  if (!hasAccess) {
    return sendErrorResponse(res, 'Không có quyền cập nhật user này', 403);
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

  // Clear cache nếu department thay đổi
  if (department && department !== user.department?.toString()) {
    clearDepartmentCache(user.department); // Clear cache cũ
    clearDepartmentCache(department); // Clear cache mới
  }

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
  try {
    const stats = await getUserStatsByDepartment(req.user);
    sendSuccessResponse(res, stats, 'Lấy thống kê users thành công');
  } catch (error) {
    if (error.message === 'USER_NO_DEPARTMENT') {
      return sendErrorResponse(res, 'Bạn chưa được phân công vào phòng ban nào', 403);
    }
    throw error;
  }
});
