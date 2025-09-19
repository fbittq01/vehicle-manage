import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

// Middleware xác thực JWT token
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token truy cập bị thiếu'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kiểm tra user còn tồn tại và active
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ - người dùng không tồn tại'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị vô hiệu hóa'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Lỗi xác thực'
    });
  }
};

// Middleware phân quyền
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập'
      });
    }

    next();
  };
};

// Middleware kiểm tra quyền super admin
export const requireSuperAdmin = authorize('super_admin');

// Middleware kiểm tra quyền admin trở lên
export const requireAdmin = authorize('super_admin', 'admin');

// Middleware kiểm tra người dùng có thể truy cập resource của chính họ
export const requireOwnershipOrAdmin = (resourceOwnerField = 'owner') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực'
      });
    }

    // Super admin và admin có thể truy cập tất cả
    if (['super_admin', 'admin'].includes(req.user.role)) {
      return next();
    }

    // User thường chỉ có thể truy cập resource của họ
    const resourceOwnerId = req.params.userId || req.body[resourceOwnerField] || req.user._id;
    
    if (req.user._id.toString() !== resourceOwnerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ có thể truy cập dữ liệu của chính mình'
      });
    }

    next();
  };
};

// Middleware optional authentication (không bắt buộc)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password -refreshTokens');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
  }
  
  next();
};
