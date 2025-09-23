import { User } from '../models/index.js';
import { generateTokens, verifyRefreshToken } from '../utils/jwt.js';
import { sendSuccessResponse, sendErrorResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/logger.js';

// Đăng ký người dùng mới
export const register = asyncHandler(async (req, res) => {
  const { username, password, name, phone, department, employeeId, role } = req.body;

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

  // Chỉ super_admin mới có thể tạo admin
  if (role === 'admin' && req.user?.role !== 'super_admin') {
    return sendErrorResponse(res, 'Không có quyền tạo tài khoản admin', 403);
  }

  // Tạo user mới
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

  // Tạo tokens
  const tokens = generateTokens(user);

  // Lưu refresh token
  user.refreshTokens.push({
    token: tokens.refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  await user.save();

  sendSuccessResponse(res, {
    user: user.toJSON(),
    tokens
  }, 'Đăng ký thành công', 201);
});

// Đăng nhập
export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Tìm user và include password để so sánh
  const user = await User.findOne({ username }).select('+password');
  
  if (!user || !(await user.comparePassword(password))) {
    return sendErrorResponse(res, 'Username hoặc mật khẩu không chính xác', 401);
  }

  if (!user.isActive) {
    return sendErrorResponse(res, 'Tài khoản đã bị vô hiệu hóa', 401);
  }

  // Cập nhật last login
  user.lastLogin = new Date();
  
  // Clean up expired tokens
  user.cleanExpiredTokens();

  // Tạo tokens mới
  const tokens = generateTokens(user);

  // Lưu refresh token
  user.refreshTokens.push({
    token: tokens.refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  await user.save();

  sendSuccessResponse(res, {
    user: user.toJSON(),
    tokens
  }, 'Đăng nhập thành công');
});

// Refresh token
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return sendErrorResponse(res, 'Refresh token bị thiếu', 400);
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return sendErrorResponse(res, 'User không hợp lệ', 401);
    }

    // Kiểm tra refresh token có trong database
    const tokenExists = user.refreshTokens.some(
      tokenObj => tokenObj.token === refreshToken && tokenObj.expiresAt > new Date()
    );

    if (!tokenExists) {
      return sendErrorResponse(res, 'Refresh token không hợp lệ', 401);
    }

    // Tạo tokens mới
    const tokens = generateTokens(user);

    // Xóa refresh token cũ và thêm mới
    user.refreshTokens = user.refreshTokens.filter(
      tokenObj => tokenObj.token !== refreshToken
    );
    
    user.refreshTokens.push({
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await user.save();

    sendSuccessResponse(res, { tokens }, 'Token đã được làm mới');

  } catch (error) {
    return sendErrorResponse(res, 'Refresh token không hợp lệ', 401);
  }
});

// Đăng xuất
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (refreshToken) {
    // Xóa refresh token khỏi database
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { refreshTokens: { token: refreshToken } } }
    );
  }

  sendSuccessResponse(res, null, 'Đăng xuất thành công');
});

// Đăng xuất tất cả thiết bị
export const logoutAll = asyncHandler(async (req, res) => {
  await User.updateOne(
    { _id: req.user._id },
    { $set: { refreshTokens: [] } }
  );

  sendSuccessResponse(res, null, 'Đã đăng xuất khỏi tất cả thiết bị');
});

// Lấy thông tin profile
export const getProfile = asyncHandler(async (req, res) => {
  // Lấy thông tin user đầy đủ từ database
  const user = await User.findById(req.user._id).select('-password -refreshTokens');
  
  if (!user) {
    return sendErrorResponse(res, 'Không tìm thấy thông tin người dùng', 404);
  }

  // Thống kê hoạt động của user
  const stats = {
    vehiclesOwned: 0,
    accessLogsCount: 0,
    lastAccessDate: null
  };

  try {
    // Import models để tránh circular dependency
    const { Vehicle } = await import('../models/index.js');
    const { AccessLog } = await import('../models/index.js');

    // Đếm số phương tiện sở hữu
    stats.vehiclesOwned = await Vehicle.countDocuments({ owner: user._id });

    // Đếm số lần ra vào và lấy lần cuối
    const accessLogStats = await AccessLog.aggregate([
      { $match: { owner: user._id } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          lastAccess: { $max: '$createdAt' }
        }
      }
    ]);

    if (accessLogStats.length > 0) {
      stats.accessLogsCount = accessLogStats[0].count;
      stats.lastAccessDate = accessLogStats[0].lastAccess;
    }
  } catch (error) {
    console.warn('Không thể lấy thống kê profile:', error.message);
  }

  // Thông tin profile đầy đủ
  const profileData = {
    user: user.toJSON(),
    stats,
    permissions: {
      canManageVehicles: ['admin', 'super_admin'].includes(user.role),
      canManageUsers: ['admin', 'super_admin'].includes(user.role),
      canViewAllLogs: ['admin', 'super_admin'].includes(user.role),
      canVerifyAccess: ['admin', 'super_admin'].includes(user.role),
      isSuperAdmin: user.role === 'super_admin'
    },
    session: {
      loginTime: user.lastLogin,
      tokenCount: user.refreshTokens?.length || 0
    }
  };

  sendSuccessResponse(res, profileData, 'Lấy thông tin profile thành công');
});

// Cập nhật profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, department } = req.body;
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, phone, department },
    { new: true, runValidators: true }
  );

  sendSuccessResponse(res, { user }, 'Cập nhật profile thành công');
});

// Đổi mật khẩu
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  const user = await User.findById(req.user._id).select('+password');
  
  if (!(await user.comparePassword(currentPassword))) {
    return sendErrorResponse(res, 'Mật khẩu hiện tại không chính xác', 400);
  }

  user.password = newPassword;
  await user.save();

  sendSuccessResponse(res, null, 'Đổi mật khẩu thành công');
});

// Verify token (middleware endpoint)
export const verifyToken = asyncHandler(async (req, res) => {
  sendSuccessResponse(res, { 
    user: req.user,
    valid: true 
  }, 'Token hợp lệ');
});
